/**
 * Shared queue domain logic for QueueCure.
 *
 * This module keeps the queue state model, validation rules, ETA math, and
 * derived view helpers in one place so the browser demo and the Socket.IO
 * backend use the same business rules.
 */

export const QUEUE_STORAGE_KEY = "queuecure:state";
export const QUEUE_CHANNEL_NAME = "queuecure:clinic";
export const QUEUE_LOCK_KEY = "queuecure:lock";
export const LOCK_LEASE_MS = 1500;

export const DEFAULT_MANUAL_AVG_MINUTES = 7;
export const MIN_CONSULT_MINUTES = 1;
export const MAX_CONSULT_MINUTES = 60;

export type PatientStatus = "waiting" | "serving" | "done";

export interface Patient {
  id: string;
  token: number;
  name: string;
  status: PatientStatus;
  addedAt: number;
  calledAt: number | null;
  doneAt: number | null;
}

export interface HistoryEntry {
  id: string;
  token: number;
  name: string;
  durationMinutes: number;
  startedAt: number;
  endedAt: number;
  counted: boolean;
  note?: string;
}

export interface QueueState {
  queue: Patient[];
  currentToken: number | null;
  currentName: string;
  currentPatientId: string | null;
  avgTime: number;
  manualAvgTime: number;
  served: number;
  history: HistoryEntry[];
  totalWaiting: number;
  dataPoints: number;
  nextToken: number;
  revision: number;
  updatedAt: number;
  clinicName: string;
  lastEvent: string;
  isRealAverage: boolean;
}

export interface QueueInsights {
  currentPatient: Patient | null;
  waitingPatients: Patient[];
  upcomingPatients: Patient[];
  waitingCount: number;
  tokensAhead: number;
  estimatedWaitMinutes: number;
  averageLabel: string;
  averageSourceLabel: string;
  queueStatusLabel: string;
  queueClear: boolean;
  recentHistory: HistoryEntry[];
}

/** Returns a fresh queue state. */
export function createInitialQueueState(): QueueState {
  return {
    queue: [],
    currentToken: null,
    currentName: "",
    currentPatientId: null,
    avgTime: DEFAULT_MANUAL_AVG_MINUTES,
    manualAvgTime: DEFAULT_MANUAL_AVG_MINUTES,
    served: 0,
    history: [],
    totalWaiting: 0,
    dataPoints: 0,
    nextToken: 1,
    revision: 0,
    updatedAt: Date.now(),
    clinicName: "QueueCure Clinic",
    lastEvent: "Queue ready",
    isRealAverage: false,
  };
}

/** Clamps and rounds consultation minutes into the allowed range. */
export function clampMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) {
    return DEFAULT_MANUAL_AVG_MINUTES;
  }

  return Math.min(MAX_CONSULT_MINUTES, Math.max(MIN_CONSULT_MINUTES, Math.round(minutes)));
}

/** Normalizes a receptionist-entered name into a safe display value. */
export function sanitizePatientName(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/** Creates a stable patient record. */
export function createPatient(name: string, token: number, now: number): Patient {
  return {
    id: makeId(),
    token,
    name,
    status: "waiting",
    addedAt: now,
    calledAt: null,
    doneAt: null,
  };
}

/** Calculates the real average if enough valid consultations exist. */
export function calculateAverage(history: HistoryEntry[], manualAvgTime: number): {
  avgTime: number;
  dataPoints: number;
  isRealAverage: boolean;
} {
  const countedDurations = history.filter((entry) => entry.counted).map((entry) => entry.durationMinutes);
  const dataPoints = countedDurations.length;

  if (dataPoints >= 3) {
    const totalMinutes = countedDurations.reduce((total, duration) => total + duration, 0);
    return {
      avgTime: totalMinutes / dataPoints,
      dataPoints,
      isRealAverage: true,
    };
  }

  return {
    avgTime: clampMinutes(manualAvgTime),
    dataPoints,
    isRealAverage: false,
  };
}

/**
 * Rebuilds the derived fields so the queue state stays authoritative in one
 * place after every mutation.
 */
export function deriveQueueState(state: QueueState): QueueState {
  const normalizedQueue: Patient[] = [];
  let servingFound = false;

  for (const patient of state.queue) {
    if (patient.status === "serving") {
      if (servingFound) {
        normalizedQueue.push({ ...patient, status: "waiting" });
      } else {
        normalizedQueue.push({ ...patient });
        servingFound = true;
      }
      continue;
    }

    normalizedQueue.push({ ...patient });
  }

  const currentPatient = normalizedQueue.find((patient) => patient.status === "serving") ?? null;
  const waitingPatients = normalizedQueue.filter((patient) => patient.status === "waiting");
  const average = calculateAverage(state.history, state.manualAvgTime);
  const nextToken = Math.max(
    state.nextToken,
    ...normalizedQueue.map((patient) => patient.token + 1),
    ...state.history.map((entry) => entry.token + 1),
  );

  return {
    ...state,
    queue: normalizedQueue,
    currentToken: currentPatient?.token ?? null,
    currentName: currentPatient?.name ?? "",
    currentPatientId: currentPatient?.id ?? null,
    avgTime: average.avgTime,
    manualAvgTime: clampMinutes(state.manualAvgTime),
    served: state.history.length,
    totalWaiting: waitingPatients.length,
    dataPoints: average.dataPoints,
    nextToken,
    isRealAverage: average.isRealAverage,
  };
}

/** Adds a patient to the waiting queue. */
export function addPatientToState(state: QueueState, inputName: string, now = Date.now()): {
  patient: Patient;
  state: QueueState;
} {
  const name = sanitizePatientName(inputName);

  if (!name) {
    throw new Error("Enter a patient name before adding them to the queue.");
  }

  const patient = createPatient(name, state.nextToken, now);
  const queue = [...state.queue, patient];

  return {
    patient,
    state: deriveQueueState({
      ...state,
      queue,
      nextToken: state.nextToken + 1,
      updatedAt: now,
      revision: state.revision + 1,
      lastEvent: `Added ${name} as token #${patient.token}`,
    }),
  };
}

/**
 * Advances the queue. If nobody is serving yet, the first waiting patient is
 * called. If someone is already serving, their consultation is closed and the
 * next waiting patient is promoted.
 */
export function callNextInState(state: QueueState, now = Date.now()): {
  calledPatient: Patient | null;
  completedPatient: HistoryEntry | null;
  state: QueueState;
} {
  if (state.queue.length === 0) {
    throw new Error("Queue is empty. Add a patient before calling next.");
  }

  const queue = state.queue.map((patient) => ({ ...patient }));
  const servingIndex = queue.findIndex((patient) => patient.status === "serving");
  const history = [...state.history];
  let completedPatient: HistoryEntry | null = null;

  if (servingIndex >= 0) {
    const servingPatient = queue[servingIndex];
    const startedAt = servingPatient.calledAt ?? now;
    const durationMinutes = Math.max(0, (now - startedAt) / 60000);
    const counted = durationMinutes >= MIN_CONSULT_MINUTES && durationMinutes <= MAX_CONSULT_MINUTES;

    completedPatient = {
      id: servingPatient.id,
      token: servingPatient.token,
      name: servingPatient.name,
      durationMinutes,
      startedAt,
      endedAt: now,
      counted,
      note: counted
        ? "Counted toward the real average"
        : durationMinutes < MIN_CONSULT_MINUTES
          ? "Ignored because it was shorter than 1 minute"
          : "Ignored because it was longer than 60 minutes",
    };

    history.push(completedPatient);
    queue.splice(servingIndex, 1);
  }

  const firstWaitingIndex = queue.findIndex((patient) => patient.status === "waiting");
  let calledPatient: Patient | null = null;

  if (firstWaitingIndex >= 0) {
    const waitingPatient = queue[firstWaitingIndex];
    calledPatient = {
      ...waitingPatient,
      status: "serving",
      calledAt: waitingPatient.calledAt ?? now,
    };
    queue[firstWaitingIndex] = calledPatient;
  }

  return {
    calledPatient,
    completedPatient,
    state: deriveQueueState({
      ...state,
      queue,
      history: history.slice(-10),
      updatedAt: now,
      revision: state.revision + 1,
      lastEvent: calledPatient
        ? `Called token #${calledPatient.token}${completedPatient ? ` after closing token #${completedPatient.token}` : ""}`
        : completedPatient
          ? `Closed token #${completedPatient.token}`
          : "Queue advanced",
    }),
  };
}

/** Updates the manual fallback average consultation time. */
export function setManualAvgTimeInState(state: QueueState, minutes: number, now = Date.now()): QueueState {
  const clampedMinutes = clampMinutes(minutes);

  return deriveQueueState({
    ...state,
    manualAvgTime: clampedMinutes,
    updatedAt: now,
    revision: state.revision + 1,
    lastEvent: `Fallback estimate set to ${clampedMinutes} minutes`,
  });
}

/** Builds the UI-friendly queue summary used by both screens. */
export function buildQueueInsights(state: QueueState): QueueInsights {
  const currentIndex = state.queue.findIndex((patient) => patient.status === "serving");
  const currentPatient = currentIndex >= 0 ? state.queue[currentIndex] ?? null : null;
  const waitingPatients = state.queue.filter((patient) => patient.status === "waiting");
  const upcomingPatients = currentPatient ? waitingPatients : waitingPatients.slice(0);
  const waitingCount = waitingPatients.length;
  const tokensAhead = currentPatient ? waitingCount : Math.max(waitingCount - 1, 0);
  const estimatedWaitMinutes = tokensAhead * state.avgTime;

  return {
    currentPatient,
    waitingPatients,
    upcomingPatients,
    waitingCount,
    tokensAhead,
    estimatedWaitMinutes,
    averageLabel: state.isRealAverage ? `Real avg (${state.dataPoints} consultations)` : "Estimated",
    averageSourceLabel: state.isRealAverage ? "from real data" : "fallback estimate",
    queueStatusLabel: waitingCount === 0 ? "Queue clear" : currentPatient ? `${waitingCount} waiting` : `${waitingCount} ready to start`,
    queueClear: waitingCount === 0,
    recentHistory: [...state.history].slice(-5).reverse(),
  };
}

/** Formats a consultation length for the UI. */
export function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const roundedMinutes = Math.abs(safeMinutes - Math.round(safeMinutes)) < 0.05 ? Math.round(safeMinutes) : Math.round(safeMinutes * 10) / 10;
  return `${roundedMinutes} min`;
}

/** Formats token numbers as the clinic expects. */
export function formatToken(token: number | null): string {
  return token === null ? "--" : `#${token}`;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `patient-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
