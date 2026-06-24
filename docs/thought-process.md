# Thought Process

## Why Socket.IO over polling or SSE

Polling adds avoidable latency and waste. SSE is one-way, which is not enough when the receptionist needs to send add/call events and receive state back. Socket.IO gives bidirectional communication, rooms, and reconnect handling, so it fits both screens and the reconnect requirement.

## Why in-memory over a database for this use case

For a single clinic demo with a small daily queue, in-memory state is faster and simpler. The queue must react instantly, and the evaluator is judging live sync rather than long-term persistence. I still documented the production path: SQLite for audit history and Redis if the queue ever needs to scale across nodes.

## How ETA uses real data

The average consultation time starts with a receptionist-provided fallback. After 3 valid completed consultations, the app switches to a real average computed from actual durations. Durations shorter than 1 minute or longer than 60 minutes are ignored so a stray click does not pollute the estimate.

## How the concurrent Call Next race is handled

Two receptionist clicks can collide in real life. The browser demo serializes write actions with a cross-tab lock. The backend has a `_calling` boolean mutex so one `callNext()` finishes before the next can begin. In production, I would move that lock to Redis using a `SET NX` lease.

## What happens on disconnect and reconnect

Every client receives a full `STATE_UPDATE` on connect. The browser demo also persists the latest queue in localStorage, so a refresh or reconnect restores the same queue immediately. The patient screen never polls, so it only changes when a real update arrives.

## What I would add with 48 more hours

- Audio chimes for the next token.
- SMS or WhatsApp notifications when a patient is called.
- QR-based self check-in to reduce receptionist typing.
- Simple audit analytics for average wait time per clinic.

## One-line pitch for the clinic owner

"QueueCure makes the waiting room feel calm because every patient can see the queue move in real time without asking the front desk."
