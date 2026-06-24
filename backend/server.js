/**
 * QueueCure Socket.IO backend.
 *
 * This standalone server keeps the same queue rules as the browser demo so the
 * hackathon can be deployed as a real-time receptionist service later. It also
 * exposes simple HTTP endpoints that return HTTP 400 for invalid requests.
 */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { randomUUID } from "crypto";

const DEFAULT_MANUAL_AVG_MINUTES = 7;
const MIN_CONSULT_MINUTES = 1;
const MAX_CONSULT_MINUTES = 60;

function createInitialState() {
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

function clampMinutes(minutes) {
  if (!Number.isFinite(minutes)) {
    return DEFAULT_MANUAL_AVG_MINUTES;
  }

  return Math.min(MAX_CONSULT_MINUTES, Math.max(MIN_CONSULT_MINUTES, Math.round(minutes)));
}

function sanitizeName(input) {
  return String(input ?? "").replace(/\s+/g, " ").trim();
}

function createPatient(name, token, now) {
  return {
    id: randomUUID(),
    token,
    name,
    status: "waiting",
    addedAt: now,
    calledAt: null,
    doneAt: null,
  };
}

function calculateAverage(history, manualAvgTime) {
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

function deriveState(state) {
  const normalizedQueue = [];
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

function advanceQueueState(state, now = Date.now()) {
  if (state.queue.length === 0) {
    throw new Error("Queue is empty. Add a patient before calling next.");
  }

  const queue = state.queue.map((patient) => ({ ...patient }));
  const servingIndex = queue.findIndex((patient) => patient.status === "serving");
  const history = [...state.history];
  let completedPatient = null;

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
  let calledPatient = null;

  if (firstWaitingIndex >= 0) {
    const waitingPatient = queue[firstWaitingIndex];
    calledPatient = {
      ...waitingPatient,
      status: "serving",
      calledAt: waitingPatient.calledAt ?? now,
    };
    queue[firstWaitingIndex] = calledPatient;
  }

  const nextState = deriveState({
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
  });

  return {
    calledPatient,
    completedPatient,
    state: nextState,
  };
}

class QueueManager {
  constructor() {
    this._state = createInitialState();
    this._calling = false;
  }

  /** Returns a cloned snapshot that is safe to broadcast to every client. */
  getState() {
    return deriveState(this._state);
  }

  /** Adds a patient to the queue and returns the patient plus the new state. */
  addPatient(name) {
    const trimmedName = sanitizeName(name);

    if (!trimmedName) {
      throw new Error("Enter a patient name before adding them to the queue.");
    }

    const now = Date.now();
    const patient = createPatient(trimmedName, this._state.nextToken, now);

    this._state = deriveState({
      ...this._state,
      queue: [...this._state.queue, patient],
      nextToken: this._state.nextToken + 1,
      updatedAt: now,
      revision: this._state.revision + 1,
      lastEvent: `Added ${trimmedName} as token #${patient.token}`,
    });

    return {
      patient,
      state: this.getState(),
    };
  }

  /** Updates the fallback average consultation time in minutes. */
  setAvgTime(avgTime) {
    if (!Number.isFinite(avgTime) || avgTime < 1 || avgTime > 60) {
      throw new Error("Average consultation time must be between 1 and 60 minutes.");
    }

    const now = Date.now();

    this._state = deriveState({
      ...this._state,
      manualAvgTime: clampMinutes(avgTime),
      updatedAt: now,
      revision: this._state.revision + 1,
      lastEvent: `Fallback estimate set to ${clampMinutes(avgTime)} minutes`,
    });

    return this.getState();
  }

  /** Advances the queue while protecting against concurrent double clicks. */
  callNext() {
    if (this._calling) {
      throw new Error("Another call-next action is already in progress.");
    }

    this._calling = true;

    try {
      const result = advanceQueueState(this._state);
      this._state = result.state;
      return result;
    } finally {
      this._calling = false;
    }
  }
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});
const queueManager = new QueueManager();

app.use(express.json());

app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  return next(error);
});

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "QueueCure backend" });
});

app.get("/api/state", (_req, res) => {
  res.json(queueManager.getState());
});

app.post("/api/patients", (req, res) => {
  try {
    const { patient } = queueManager.addPatient(req.body?.name);
    broadcastState();
    res.status(201).json({ patient, state: queueManager.getState() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request." });
  }
});

app.post("/api/call-next", (_req, res) => {
  try {
    const result = queueManager.callNext();
    broadcastState();
    const state = queueManager.getState();
    if (result.calledPatient) {
      io.to("clinic").emit("TOKEN_CALLED", {
        token: result.calledPatient.token,
        name: result.calledPatient.name,
        avgTime: state.avgTime,
      });
    }
    res.json(state);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request." });
  }
});

app.post("/api/avg-time", (req, res) => {
  try {
    queueManager.setAvgTime(req.body?.avgTime);
    broadcastState();
    res.json(queueManager.getState());
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request." });
  }
});

io.on("connection", (socket) => {
  socket.join("clinic");
  socket.emit("STATE_UPDATE", queueManager.getState());

  socket.on("ADD_PATIENT", (payload) => {
    try {
      const { patient } = queueManager.addPatient(payload?.name);
      socket.emit("PATIENT_ADDED", { patient });
      broadcastState();
    } catch (error) {
      socket.emit("ERROR", { message: error instanceof Error ? error.message : "Invalid request." });
    }
  });

  socket.on("CALL_NEXT", () => {
    try {
      const result = queueManager.callNext();
      broadcastState();
      const state = queueManager.getState();
      if (result.calledPatient) {
        io.to("clinic").emit("TOKEN_CALLED", {
          token: result.calledPatient.token,
          name: result.calledPatient.name,
          avgTime: state.avgTime,
        });
      }
    } catch (error) {
      socket.emit("ERROR", { message: error instanceof Error ? error.message : "Invalid request." });
    }
  });

  socket.on("SET_AVG_TIME", (payload) => {
    try {
      queueManager.setAvgTime(payload?.avgTime);
      broadcastState();
    } catch (error) {
      socket.emit("ERROR", { message: error instanceof Error ? error.message : "Invalid request." });
    }
  });
});

function broadcastState() {
  io.to("clinic").emit("STATE_UPDATE", queueManager.getState());
}

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected server error." });
});

const port = Number(process.env.PORT ?? 3001);

httpServer.listen(port, () => {
  process.stdout.write(`QueueCure backend listening on port ${port}\n`);
});
