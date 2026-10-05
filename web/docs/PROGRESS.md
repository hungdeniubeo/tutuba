# TUTUBA web progress

## 2026-10-05 — implementation in progress

- Worktree: `feat/web-vertical-slice`. Unreal branch remains at `54961a9`; root Unreal sources are reference material only.
- Environment: macOS 26.7.1, Apple M4, 16 GiB RAM; Node 24.20.0/npm 11.19.0. Google Chrome is installed.
- Initial scaffold and dependencies installed. First test run correctly failed because the model was missing. The next run exposed erroneous test fixtures and divergences from the C++ rules; neither is accepted as verified.
- Replacing those fixtures with equivalent C++ scenarios, then adding the browser presentation. No browser/build/performance claim yet.
- Goal tracker still contains the older Unreal objective. This work follows the user's explicit replacement web request; the Unreal objective is not claimed complete.

## 2026-10-05 — browser baseline and scope change

- Deterministic TS port: 29/29 tests passed, including all 18 C++ parity cases, six web rule regressions, four solvable encounters, and defeat/restart. Evidence: `evidence/tests.txt`, `evidence/victory-plans.json`.
- Production build passes. Browser playthrough in installed Chrome 154.0.8037.95 reached all four victories, defeat and clean restart using actual canvas/button clicks. Guard, push, Echo shift, friendly fire and fixed deadlines verified. No console/page/request errors. `evidence/browser-verification.json` and PNGs record the run.
- Entire player-facing UI, unit names, field notes and combat journal translated into Vietnamese at the user's request.
- Fixed an opt-in WebGPU startup deadlock: top-level await in the entry module waited for a dynamically imported chunk that imported shared code from that entry module. Asynchronous boot now lets module evaluation finish. Production Chrome then opened WebGPU successfully and accepted gameplay input.
- A 30-second warm-up plus 180-second foreground combat performance measurement is running; result must be read before any FPS claim.
- Automated playthrough is functional evidence only. The intended 10–15 minute first-time human pacing has not been established.
- New user steering: opposing teams, play with a friend, Auto Chess-style preparation and automatic combat. Connection choice (two computers over network versus shared computer) requested; do not assume either is authorized as the selected mode. The current single-player baseline is preserved while this choice is pending. Completion criteria must be updated for the agreed multiplayer scope.

## 2026-10-05 — baseline performance / online choice confirmed

- Baseline WebGL production measurement completed on this Mac (Apple M4, 16 GiB, macOS 26.7.1), Chrome 154.0.8037.95. 30s combat warm-up + 180s recorded, 201 ordinary UI combat actions. Viewport 1920×1080, DPR 1, canvas 1550×812 plus HTML HUD. Mean 119.999 FPS, 1% low 106.498 FPS, tab remained visible, no errors. Raw intervals and GPU details: `evidence/performance.json`; summary: `evidence/performance-summary.json`. These figures apply to the single-player baseline only; the online version needs its own run.
- User confirmed: **each player on a separate computer, private room over the network**. The previous no-backend restriction is superseded only as necessary for a small room/synchronization server; no account/database/matchmaking scope is added.
- Shared preparation rules implemented and tested: mirrored home zones, 6 points/3 units, occupied/invalid positions, cost/refund, ownership, readiness locking and deterministic snapshots. Current total: 35/35 tests.
- Next: automatic battle adapter reusing the verified combat rules, authoritative two-seat WebSocket room server, Vietnamese online UI, two-browser verification and an accessible play URL.
