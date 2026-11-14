# CAPCOM — Jules, R7 / #42

This is the **offline integration stage**, not a live Microsoft Foundry agent.
It implements CONTRACTS §4 without keys or network access. The response itself
identifies offline mode. Issue #42 stays open until Foundry and the demo UI work.

```sh
python -m pip install -r agent/requirements.txt
python -m uvicorn agent.service:create_app --factory --host 127.0.0.1 --port 8000
```

`POST /capcom` accepts `{ "state": <CONTRACTS §3 state>, "message": "optional" }`
and returns `{ "text": "..." }`. `buddy` is optional to match Nico's current
`appState()` output. The fixed offline response explains the snapshot's energy
margin; free-text questions do not execute code or select additional tools.

`CAPCOM_DELAY_S` configures `delay_s` (default 20 seconds, range 0–120).
The async delay leaves other requests running. A response describes the state
at send time and tells the crew to use the current onboard display. It recomputes
the ring from energy/reserve/cost and flags inconsistent `inside_ring` values.

All three allowlisted tools run in a separate session per request. Their results
are logged to `capcom.tools` at INFO and shown in the response text, with a
request ID in logs. Configure Python logging at INFO to retain the audit stream;
store logs outside Git. User question text and credentials are not logged.

`nearest_safe_point` explicitly reports unavailable: the contract request carries
no world identity, grid, scouted coverage or traversable path. It does not guess
a cell from the synthetic world or call a geometrically close cell safe.

## Integration handoff to Nico

- Keep CAPCOM optional/off until ready. A pending request must not block walking,
  the ring, scout or energy calculations. Display the tool trace with the reply.
- For the default delay, use a timeout greater than 20 seconds. On service failure,
  schedule a clearly labeled prerecorded fallback locally with the same demo
  delay. Offline service responses are already delayed: do not delay twice.
- Same-origin proxy integration is preferred; no permissive CORS is enabled.
- No app files are changed here. A real phone/service-down test is still needed.

## Remaining Foundry work

No Azure/Foundry project configuration was available in this workspace. Before
connecting the real backend, use the team's project endpoint, model deployment
and authorized environment authentication. Do not create substitute resources or
claim award eligibility from this offline stage. Preserve the controlled tools,
audit, delay and app fallback in the real backend; test with a mocked client first.
The official [Foundry SDK quickstart](https://learn.microsoft.com/en-us/azure/ai-foundry/quickstarts/get-started-code?pivots=fdp-project&tabs=python)
documents current project endpoints and authentication. A verified world binding
is also required before nearest-safe-point recommendations can be implemented.

Tests: `pytest -q` (HTTP contract, validation, delay, concurrent request isolation,
tool logs and offline imports). On Windows, an accessible ignored `--basetemp`
may be needed. Async HTTP tests use FastAPI's documented ASGI transport approach.
