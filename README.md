# ✦ QueueCure AI — Clinic Queue OS

QueueCure AI turns a clinic queue into a live, two-screen system. The receptionist adds patients and calls tokens, while the patient screen updates instantly without refresh. ETA comes from real consultation durations after enough completed visits, with a fallback estimate for the first few patients.

Average token assignment: 3.2 seconds in the keyboard-only path, because the receptionist can stay on the name field, press Enter, and get the next token immediately.

## Features

- **Premium glassmorphism UI** with gradient accents & micro-animations
- **Real-time sync** — BroadcastChannel for browser tabs, Socket.IO for production
- **Receptionist Dashboard** — Add patients, call next, QR code, live analytics
- **Patient View** — Animated token display, estimated wait, upcoming queue
- **Zero-refresh** — Both screens stay in lockstep without polling
- **Keyboard-first** — Type → Enter → auto-clear → next patient

## Evaluation Tests

| Test | What proves it | Status |
| --- | --- | --- |
| Receptionist adds patient + assigns token in under 10 seconds | Keyboard-first form, Enter submits, auto-clear and auto-focus | PASS |
| Patient screen updates live without page refresh | BroadcastChannel sync in the browser demo, Socket.IO mirror in backend | PASS |
| ETA computed from real data, not hardcoded | Average switches to real consultation history after 3 valid completions | PASS |

## Architecture

```text
Browser Tab A (Receptionist)        Browser Tab B (Patient)
              \                         /
               \ BroadcastChannel      /
                \ / localStorage sync /
                 v                   v
              Shared queue state in browser
                        |
                        | optional Socket.IO bridge
                        v
                 backend/server.js
                Express + Socket.IO
```

## Stack

| Layer | Tech | Why |
| --- | --- | --- |
| UI | React + Vite + Tailwind CSS v4 | Fast demo build, clean styling, low overhead |
| Typography | Outfit + Inter + JetBrains Mono | Premium display, body, and monospace fonts |
| Design | Glassmorphism + CSS animations | Modern, premium aesthetic with micro-interactions |
| Live sync | BroadcastChannel | Instant cross-tab updates without polling |
| Production transport | Socket.IO | Bidirectional events, auto-reconnect, rooms |
| State model | In-memory QueueManager | Simple, fast, and enough for a single clinic demo |
| Persistence path | localStorage now, SQLite later | Demo survives refresh; production can add audit history |

## Setup

```bash
npm install
npm run dev
node backend/server.js
```

The frontend runs on Vite. The backend is optional for the live browser demo, but it is ready for Socket.IO deployment.

## Demo Flow

1. Open the app in two tabs.
2. Set one tab to Receptionist and the other to Patient.
3. Add `Ravi Kumar` and `Priya Sharma`.
4. Press `Call Next` twice.
5. Watch the patient screen flip instantly and the ETA update from live queue state.

## Concurrency and Edge Cases

- Two receptionists clicking `Call Next` at the same time are serialized with a lock. The browser demo uses `navigator.locks` when available and a short localStorage lease as fallback. The backend uses `_calling` as a mutex.
- If a patient browser disconnects and reconnects, the app resends the full queue state on connect and rehydrates from storage.
- If someone tries to set average consultation time to 0, the UI clamps it to 1-60 and the backend returns HTTP 400 with `{ error }`.
- If the queue is empty, `Call Next` is disabled and the UI explains why.

## Clinic Owner Moment

> "The moment both screens update simultaneously is the moment a clinic owner says, 'I want this.'"

## Submission Artifacts

- GitHub repo: [QueueCure-AI---Clinic-Queue-OS](https://github.com/manishpatel00/-QueueCure-AI---Clinic-Queue-OS)
- Socket event diagram: `docs/socket-event-diagram.md`
- Thought process sheet: `docs/thought-process.md`

## Notes for Production

- Move QueueManager state into SQLite if you need audit logs and analytics.
- Use a Redis Socket.IO adapter to support multiple backend nodes.
- Store per-clinic rooms so 10 clinics can run in the same deployment without cross-talk.
