# Milovi Cake — exact-object IP review packet

**Packet date:** 2026-08-15  
**Issue:** `FedorMilovanov/Milovi_Cake#19`  
**Base commit:** `892623de347350c760d9cbc87477a62bf7c517a2`  
**Provider scope:** YouTube exact six-row `IP_HOLD_DO_NOT_TRANSFER` migration-gap subset  
**Decision state:** `INCOMPLETE_REVIEW_GATE`

## Hard safety contract

This packet is a review checklist, not a takedown instruction.

- `provider_mutation_authorized=false`
- `hide_authorized=false`
- `delete_authorized=false`
- `upload_authorized=false`
- `wall_mutation_authorized=false`
- `human_decision_present=false`
- `current_provider_readback_complete=false`
- `surface_complete_claim=false`

No row may be converted into a provider mutation until its missing review fields are independently completed and an explicit human decision is recorded for that exact provider object.

Historical classifier label `IP_HOLD_HIDE` is evidence provenance only. It does **not** grant hide authority. Its accepted operational mapping here is `IP_HOLD_DO_NOT_TRANSFER`: do not newly transfer/amplify while rights review remains unresolved.

## Snapshot provenance

The source evidence is intentionally time-bounded:

- 2026-08-10 read-only YouTube provider inventory proved exact channel `UCMDnxfGZiBqcDzgUV1zjFpw` / `@milovi_cake` with 152 owned videos = 148 public + 4 unlisted.
- The public `<=60s` cake triage produced the source candidate pool from which the exact named-rights IDs were recovered.
- The accepted gap collector at exact `video-channel-manager#316` base `d3f099c1761035d2261cb99db31370cdd09b7970` has blob SHA `f465f5653fb90d83424a8795436898a6ec96419f`; the same blob remains on current `video-channel-manager/main`.
- Accepted visual evidence ZIP SHA-256: `f33b119d660fef85f11ae3d85f7f6649ff70e566594e26fff785cded5c5481a3`.
- Accepted reconciliation result SHA-256: `6c99be41c3a0c068819f074b16664252c6601ed3b5f1bd49d184b2dc8ed631e0`.
- The accepted visual bundle contains 206 media evidence files and keeps all upload/delete/hide/wall/schedule authority false.
- The VK observation is bounded to 106 exact public/wall native Clip IDs and explicitly keeps `surface_complete_claim=false`.

Therefore `PUBLIC_AT_2026_08_10_SNAPSHOT` below is historical snapshot evidence, **not** a claim that the object is still public on 2026-08-15. A fresh exact-object provider readback is mandatory before any decision.

## Exact six rows

| Subject | Exact YouTube object | Source metadata | Snapshot state | Accepted migration gate | Proven VK exact object | Current exact-object readback | Human decision |
|---|---|---|---|---|---|---|---|
| Om Nom | `P2Bpt77k408` — https://www.youtube.com/watch?v=P2Bpt77k408 | `2026-04-06` · `41s` · `Торт с Ам Нямом` | `PUBLIC_AT_2026_08_10_SNAPSHOT` | `IP_HOLD_DO_NOT_TRANSFER` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` | `REQUIRED` | `REQUIRED` |
| Squid Game | `jZjDWn_MNq0` — https://www.youtube.com/watch?v=jZjDWn_MNq0 | `2025-07-05` · `42s` · `Торт Игра в Кальмара` | `PUBLIC_AT_2026_08_10_SNAPSHOT` | `IP_HOLD_DO_NOT_TRANSFER` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` | `REQUIRED` | `REQUIRED` |
| Cheburashka / Gena | `xzMgMEWz5pM` — https://www.youtube.com/watch?v=xzMgMEWz5pM | `2024-08-19` · `15s` · `Торт Чебурашка и Гена` | `PUBLIC_AT_2026_08_10_SNAPSHOT` | `IP_HOLD_DO_NOT_TRANSFER` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` | `REQUIRED` | `REQUIRED` |
| Wednesday | `7FCbopqeTYE` — https://www.youtube.com/watch?v=7FCbopqeTYE | `2024-01-18` · `30s` · `Двойной Торт Wednesday` | `PUBLIC_AT_2026_08_10_SNAPSHOT` | `IP_HOLD_DO_NOT_TRANSFER` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` | `REQUIRED` | `REQUIRED` |
| Roblox | `ZuQt6yFePO0` — https://www.youtube.com/watch?v=ZuQt6yFePO0 | `2023-12-18` · `31s` · `Торт Роблокс` | `PUBLIC_AT_2026_08_10_SNAPSHOT` | `IP_HOLD_DO_NOT_TRANSFER` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` | `REQUIRED` | `REQUIRED` |
| Rainbow Friends Roblox | `qPXHrdUgPUY` — https://www.youtube.com/watch?v=qPXHrdUgPUY | `2023-06-23` · `33s` · `Торт Радужные Друзья Roblox` | `PUBLIC_AT_2026_08_10_SNAPSHOT` | `IP_HOLD_DO_NOT_TRANSFER` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` | `REQUIRED` | `REQUIRED` |

## Per-object review fields that remain mandatory

For **each** row above, a future reviewed amendment must supply all of the following before destructive authority can even be considered:

1. `provider=YouTube` and the exact unchanged video ID.
2. Fresh provider readback proving current visibility/status for that exact ID.
3. Readback timestamp in UTC and the canonical provider URL actually checked.
4. Exact-object visual readback/screenshot sufficient to prove the reviewed object is the intended cake video, not merely a title match.
5. Rights-review basis for the exact depicted material, including any license/permission evidence if it exists.
6. Explicit human decision for that exact object: `KEEP`, `HIDE/UNPUBLISH`, `DELETE`, or `REQUIRES_MORE_REVIEW`.
7. If the human decision is destructive, a second pre-write readback immediately before execution and an operation-specific immutable plan.

A stale snapshot, a title, a franchise name, a similarity score, or absence from the bounded 106-item VK observation is insufficient.

## VK non-inference rule

No exact native VK object has been proven for any of these six rows by the accepted evidence used here. This must remain `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE`, **not** `MISSING`.

The accepted VK observation explicitly has `surface_complete_claim=false`, so the six rows are not upload candidates and are not VK cleanup candidates merely because a matching remote ID has not been proven.

## Gate result

`REVIEW_GATE_STATUS=INCOMPLETE`

Reasons:

- fresh exact-object YouTube readback is still required for all six rows;
- exact-object current visual readback is still required for all six rows;
- explicit human decision is absent for all six rows;
- no destructive operation-specific plan exists;
- provider mutation authority remains false.

This packet therefore freezes the correct review scope while authorizing **zero provider writes**.
