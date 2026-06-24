/**
 * Browser queue hook for QueueCure.
 *
 * The hook owns local state, localStorage persistence, BroadcastChannel sync,
 * and the optional Socket.IO bridge. It keeps the receptionist and patient
 * screens in lockstep without polling.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  addPatientToState,
  buildQueueInsights,
  callNextInState,
  createInitialQueueState,
  deriveQueueState,
  formatMinutes,
  LOCK_LEASE_MS,
  QUEUE_CHANNEL_NAME,
  QUEUE_LOCK_KEY,
  QUEUE_STORAGE_KEY,
  sanitizePatientName,
  setManualAvgTimeInState,
  type QueueInsights,
  type QueueState,
} from "@/lib/queue";

type PendingAction = "add-patient" | "call-next" | "set-avg" | null;

export interface UseQueueResult {
  state: QueueState;
  insights: QueueInsights;
  connectionLabel: string;
  isConnected: boolean;
  pendingAction: PendingAction;
  error: string | null;
  addPatient: (name: string) => Promise<void>;
  callNext: () => Promise<void>;
  setAvgTime: (minutes: number) => Promise<void>;
  clearError: () => void;
  queueClearLabel: string;
  averageDisplayLabel: string;
}

interface BroadcastMessage {
  sourceId: string;
  state: QueueState;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL?.trim();

export function useQueue(): UseQueueResult {
  const tabIdRef = useRef<string>(createTabId());
  const stateRef = useRef<QueueState>(createInitialQueueState());
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<QueueState>(() => loadStoredState());
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(Boolean(SOCKET_URL) || typeof window !== "undefined");
  const [connectionLabel, setConnectionLabel] = useState<string>(SOCKET_URL ? "Connecting to Socket.IO" : "BroadcastChannel live");

  const insights = useMemo(() => buildQueueInsights(state), [state]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const stored = loadStoredState();

    if (stored.revision >= stateRef.current.revision) {
      stateRef.current = stored;
      setState(stored);
    }

    if (typeof window === "undefined") {
      return;
    }

    const applyIncomingState = (incomingState: QueueState) => {
      const currentRevision = stateRef.current.revision;

      if (incomingState.revision > currentRevision) {
        const normalizedState = deriveQueueState(incomingState);
        stateRef.current = normalizedState;
        setState(normalizedState);
        persistState(normalizedState);
      }
    };

    if (typeof BroadcastChannel !== "undefined") {
      const broadcastChannel = new BroadcastChannel(QUEUE_CHANNEL_NAME);
      broadcastRef.current = broadcastChannel;

      broadcastChannel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
        if (event.data.sourceId === tabIdRef.current) {
          return;
        }

        applyIncomingState(event.data.state);
      };
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== QUEUE_STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        const incoming = deriveQueueState(JSON.parse(event.newValue) as QueueState);
        applyIncomingState(incoming);
      } catch {
        // Ignore malformed storage payloads. The local state remains safe.
      }
    };

    window.addEventListener("storage", handleStorage);

    if (SOCKET_URL) {
      const socket = io(SOCKET_URL, {
        transports: ["websocket", "polling"],
        autoConnect: true,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        setConnectionLabel("Socket.IO live");
      });

      socket.on("disconnect", () => {
        setIsConnected(false);
        setConnectionLabel("Socket.IO disconnected");
      });

      socket.on("STATE_UPDATE", (incomingState: QueueState) => {
        applyIncomingState(incomingState);
      });

      socket.on("ERROR", (payload: { message?: string }) => {
        if (payload?.message) {
          setError(payload.message);
        }
      });

      socket.on("connect_error", () => {
        setIsConnected(false);
        setConnectionLabel("Socket.IO offline, local sync active");
      });
    } else {
      setIsConnected(true);
      setConnectionLabel(typeof BroadcastChannel !== "undefined" ? "BroadcastChannel live" : "Local sync only");
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      broadcastRef.current?.close();
      broadcastRef.current = null;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const broadcastState = useCallback((nextState: QueueState) => {
    persistState(nextState);

    if (broadcastRef.current) {
      const message: BroadcastMessage = {
        sourceId: tabIdRef.current,
        state: nextState,
      };

      broadcastRef.current.postMessage(message);
    }
  }, []);

  const withMutation = useCallback(
    async <T>(
      actionLabel: PendingAction,
      action: (currentState: QueueState) => T,
      socketEvent?: string,
      socketPayloadFactory?: (nextState: QueueState, result: T) => Record<string, unknown>,
    ): Promise<T> => {
      setError(null);
      setPendingAction(actionLabel);

      try {
        return await withCrossTabLock(async () => {
          const result = action(stateRef.current);

          if (result && typeof result === "object" && "state" in result) {
            const nextState = deriveQueueState((result as { state: QueueState }).state);
            stateRef.current = nextState;
            setState(nextState);
            broadcastState(nextState);

            if (socketRef.current?.connected && socketEvent) {
              socketRef.current.emit(socketEvent, socketPayloadFactory?.(nextState, result) ?? {});
            }

            return result;
          }

          return result;
        });
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : "Something went wrong while updating the queue.";
        setError(message);
        throw caughtError instanceof Error ? caughtError : new Error(message);
      } finally {
        setPendingAction(null);
      }
    },
    [broadcastState],
  );

  const addPatient = useCallback(
    async (name: string) => {
      const trimmedName = sanitizePatientName(name);

      if (!trimmedName) {
        throw new Error("Enter a patient name before adding them to the queue.");
      }

      await withMutation(
        "add-patient",
        (currentState) => addPatientToState(currentState, trimmedName),
        "ADD_PATIENT",
        (_, result) => {
          const payload = result as { patient: { name: string } };
          return { name: payload.patient.name };
        },
      );
    },
    [withMutation],
  );

  const callNext = useCallback(async () => {
    await withMutation(
      "call-next",
      (currentState) => callNextInState(currentState),
      "CALL_NEXT",
      () => ({}),
    );
  }, [withMutation]);

  const setAvgTime = useCallback(
    async (minutes: number) => {
      const sanitizedMinutes = Number.isFinite(minutes) ? minutes : 0;

      await withMutation(
        "set-avg",
        (currentState) => ({ state: setManualAvgTimeInState(currentState, sanitizedMinutes) }),
        "SET_AVG_TIME",
        (nextState) => ({ avgTime: nextState.manualAvgTime }),
      );
    },
    [withMutation],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    state,
    insights,
    connectionLabel,
    isConnected,
    pendingAction,
    error,
    addPatient,
    callNext,
    setAvgTime,
    clearError,
    queueClearLabel: insights.queueClear ? "Queue clear" : `${insights.waitingCount} waiting`,
    averageDisplayLabel: `${formatMinutes(state.avgTime)}${state.isRealAverage ? "*" : ""}`,
  };
}

async function withCrossTabLock<T>(callback: () => Promise<T>): Promise<T> {
  const navigatorWithLocks = navigator as Navigator & { locks?: LockManager };

  if (navigatorWithLocks.locks?.request) {
    return navigatorWithLocks.locks.request("queuecure:clinic", { mode: "exclusive" }, callback);
  }

  const ownerId = `${tabIdFromStorage()}-${Date.now().toString(36)}`;
  const deadline = Date.now() + 1500;

  while (Date.now() < deadline) {
    try {
      const lockValue = localStorage.getItem(QUEUE_LOCK_KEY);
      const lock = lockValue ? (JSON.parse(lockValue) as { ownerId: string; expiresAt: number }) : null;

      if (!lock || lock.expiresAt < Date.now()) {
        localStorage.setItem(QUEUE_LOCK_KEY, JSON.stringify({ ownerId, expiresAt: Date.now() + LOCK_LEASE_MS }));

        const confirmedLock = localStorage.getItem(QUEUE_LOCK_KEY);
        if (confirmedLock) {
          const parsedLock = JSON.parse(confirmedLock) as { ownerId: string; expiresAt: number };
          if (parsedLock.ownerId === ownerId) {
            try {
              return await callback();
            } finally {
              const currentLock = localStorage.getItem(QUEUE_LOCK_KEY);
              if (currentLock) {
                const currentParsed = JSON.parse(currentLock) as { ownerId: string };
                if (currentParsed.ownerId === ownerId) {
                  localStorage.removeItem(QUEUE_LOCK_KEY);
                }
              }
            }
          }
        }
      }
    } catch {
      return callback();
    }

    await new Promise((resolve) => window.setTimeout(resolve, 24));
  }

  throw new Error("Another receptionist is already updating the queue. Try again in a moment.");
}

function loadStoredState(): QueueState {
  if (typeof window === "undefined") {
    return createInitialQueueState();
  }

  try {
    const stored = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) {
      return createInitialQueueState();
    }

    return deriveQueueState(JSON.parse(stored) as QueueState);
  } catch {
    return createInitialQueueState();
  }
}

function persistState(state: QueueState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures. The current tab still keeps the in-memory copy.
  }
}

function createTabId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `tab-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function tabIdFromStorage(): string {
  if (typeof window === "undefined") {
    return "tab";
  }

  const existingTabId = window.sessionStorage.getItem("queuecure:tab-id");
  if (existingTabId) {
    return existingTabId;
  }

  const generatedTabId = createTabId();
  window.sessionStorage.setItem("queuecure:tab-id", generatedTabId);
  return generatedTabId;
}
