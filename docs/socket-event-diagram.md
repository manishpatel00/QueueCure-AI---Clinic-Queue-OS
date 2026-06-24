<!--
Socket event diagram for QueueCure.
This document shows the live event contract, the mutex case, the reconnection
case, and the production scaling path.
-->

# Socket Event Diagram

```text
CLIENT (Receptionist or Patient)                  SERVER (Express + Socket.IO)

ADD_PATIENT { name } ---------------------------> addPatient(name)
CALL_NEXT {} -----------------------------------> callNext() with mutex
SET_AVG_TIME { avgTime } -----------------------> setAvgTime(avgTime)

<--------------------------- STATE_UPDATE QueueState (on every state change)
<--------------------------- PATIENT_ADDED { patient } (sender only)
<--------------------------- ERROR { message } (sender only)
<--------------------------- TOKEN_CALLED { token, name, avgTime } (all clients)
```

## Mutex Scenario

```text
Tab A: CALL_NEXT {} -----------+
                               |  QueueManager._calling = true
Tab B: CALL_NEXT {} -----------+--> second call waits or fails fast

Outcome:
- First call completes.
- Second call is rejected so the same token is not called twice.
```

## Reconnection Scenario

```text
Client disconnects
Client reconnects
Server emits STATE_UPDATE QueueState immediately on connect

Outcome:
- The screen snaps back to the latest state.
- No manual refresh is needed.
```

## Production Scaling Note

```text
10 clinics -> 10 Socket.IO rooms
Redis adapter -> shared pub/sub between backend nodes
SQLite -> audit log of completed consultations
```

## Why This Contract Works

- `STATE_UPDATE` is the only payload that matters for the screens.
- `PATIENT_ADDED` and `TOKEN_CALLED` are useful for instant confirmation and demo polish.
- `ERROR` gives the UI a clear failure path without alert boxes.
