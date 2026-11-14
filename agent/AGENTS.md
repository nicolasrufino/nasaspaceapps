# agent/ (CAPCOM: Jules, Person 1)

Applies to everything under `agent/`. The root `AGENTS.md` still applies.

- Contract: `docs/CONTRACTS.md` §4. Replies are delayed by `delay_s` (default 20 s) on purpose.
- Tools the agent may call: `get_state`, `explain_ring`, `nearest_safe_point`. Log every tool call and show it.
- Keys (Azure / Microsoft Foundry) come from environment variables or `.env`, never the repo.
- This agent is our Azure entry for the Best Use of Technology award: it must really run on Microsoft Foundry.
- The demo must still work if this service is down (the app shows pre-recorded delayed messages).
