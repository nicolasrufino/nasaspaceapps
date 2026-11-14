# agent/ (CAPCOM: Person 3, then Person X)

Applies to everything under `agent/`. The root `AGENTS.md` still applies.

- Contract: `docs/CONTRACTS.md` §4. Replies are delayed by `delay_s` (default 20 s) on purpose.
- Tools the agent may call: `get_state`, `explain_ring`, `nearest_safe_point`. Log every tool call and show it.
- Keys (Azure / Microsoft Foundry) come from environment variables or `.env`, never the repo.
- The demo must still work if this service is down (the app shows pre-recorded delayed messages).
