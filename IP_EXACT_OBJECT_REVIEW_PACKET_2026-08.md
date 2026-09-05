# Milovi Cake — exact-object IP review packet

**Packet date:** 2026-08-15; fresh exact-six readback amended 2026-09-06  
**Issue:** `FedorMilovanov/Milovi_Cake#19`  
**Original base commit:** `892623de347350c760d9cbc87477a62bf7c517a2`  
**Fresh readback source:** `FedorMilovanov/video-channel-manager` GitHub Actions run `33997648511`, job `101390861047`  
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
- `current_public_exact_url_readback_complete=true`
- `current_provider_readback_complete=false`
- `current_visual_readback_complete=false`
- `surface_complete_claim=false`

No row may be converted into a provider mutation until its missing review fields are independently completed and an explicit human decision is recorded for that exact provider object.

Historical classifier label `IP_HOLD_HIDE` is evidence provenance only. It does **not** grant hide authority. Its accepted operational mapping here is `IP_HOLD_DO_NOT_TRANSFER`: do not newly transfer/amplify while rights review remains unresolved.

## Snapshot provenance

The original source evidence is intentionally time-bounded:

- 2026-08-10 read-only YouTube provider inventory proved exact channel `UCMDnxfGZiBqcDzgUV1zjFpw` / `@milovi_cake` with 152 owned videos = 148 public + 4 unlisted.
- The public `<=60s` cake triage produced the source candidate pool from which the exact named-rights IDs were recovered.
- The accepted gap collector at exact `video-channel-manager#316` base `d3f099c1761035d2261cb99db31370cdd09b7970` has blob SHA `f465f5653fb90d83424a8795436898a6ec96419f`; the same blob remains on current `video-channel-manager/main`.
- Accepted visual evidence ZIP SHA-256: `f33b119d660fef85f11ae3d85f7f6649ff70e566594e26fff785cded5c5481a3`.
- Accepted reconciliation result SHA-256: `6c99be41c3a0c068819f074b16664252c6601ed3b5f1bd49d184b2dc8ed631e0`.
- The accepted visual bundle contains 206 media evidence files and keeps all upload/delete/hide/wall/schedule authority false.
- The VK observation is bounded to 106 exact public/wall native Clip IDs and explicitly keeps `surface_complete_claim=false`.

Therefore `PUBLIC_AT_2026_08_10_SNAPSHOT` below remains historical provider evidence, not a claim about strict current YouTube `privacyStatus`.

## Fresh exact-six public readback — 2026-09-05 UTC / 2026-09-06 local

A new bounded diagnostic was executed from exact `video-channel-manager/main` lineage for only the six frozen YouTube IDs. The diagnostic:

- used YouTube's official public oEmbed endpoint against each canonical `https://www.youtube.com/watch?v=<id>` URL;
- used no OAuth credential;
- performed no provider mutation;
- did not enumerate unrelated channel content;
- was implemented on a temporary diagnostic branch and that branch was force-reset to its original `main` SHA after evidence capture.

GitHub Actions evidence:

- workflow run: `33997648511`;
- job: `101390861047`;
- conclusion: `success`;
- `provider_write_performed=false` for every row;
- all six exact URLs returned HTTP `200` through YouTube oEmbed;
- all six returned `author_name=Milovi Cake` and `author_url=https://www.youtube.com/@milovi_cake`.

This proves the exact six objects are currently reachable through YouTube's public exact-URL embed/read surface and still resolve to Milovi Cake. It does **not** prove whether YouTube Data API currently classifies an object as `public` versus `unlisted`; an unlisted object can remain reachable by exact URL. It also does not replace an exact-object visual/human rights decision.

## Exact six rows

| Subject | Exact YouTube object | Historical source metadata | Historical snapshot state | Accepted migration gate | Fresh exact-URL readback | Current thumbnail URL | Human decision |
|---|---|---|---|---|---|---|---|
| Om Nom | `P2Bpt77k408` — https://www.youtube.com/watch?v=P2Bpt77k408 | `2026-04-06` · `41s` · `Торт с Ам Нямом` | `PUBLIC_AT_2026_08_10_SNAPSHOT` | `IP_HOLD_DO_NOT_TRANSFER` | `OEMBED_HTTP_200` · title `Торт с Ам Нямом` · author `Milovi Cake` | `https://i.ytimg.com/vi/P2Bpt77k408/hqdefault.jpg` | `REQUIRED` |
| Squid Game | `jZjDWn_MNq0` — https://www.youtube.com/watch?v=jZjDWn_MNq0 | `2025-07-05` · `42s` · `Торт Игра в Кальмара` | `PUBLIC_AT_2026_08_10_SNAPSHOT` | `IP_HOLD_DO_NOT_TRANSFER` | `OEMBED_HTTP_200` · title `Торт Игра в кальмара / Squid game cake` · author `Milovi Cake` | `https://i.ytimg.com/vi/jZjDWn_MNq0/hqdefault.jpg` | `REQUIRED` |
| Cheburashka / Gena | `xzMgMEWz5pM` — https://www.youtube.com/watch?v=xzMgMEWz5pM | `2024-08-19` · `15s` · `Торт Чебурашка и Гена` | `PUBLIC_AT_2026_08_10_SNAPSHOT` | `IP_HOLD_DO_NOT_TRANSFER` | `OEMBED_HTTP_200` · title `Торт Чебурашка и Гена` · author `Milovi Cake` | `https://i.ytimg.com/vi/xzMgMEWz5pM/hqdefault.jpg` | `REQUIRED` |
| Wednesday | `7FCbopqeTYE` — https://www.youtube.com/watch?v=7FCbopqeTYE | `2024-01-18` · `30s` · `Двойной Торт Wednesday` | `PUBLIC_AT_2026_08_10_SNAPSHOT` | `IP_HOLD_DO_NOT_TRANSFER` | `OEMBED_HTTP_200` · title `Торт Wednesday / Addams Family Cake` · author `Milovi Cake` | `https://i.ytimg.com/vi/7FCbopqeTYE/hqdefault.jpg` | `REQUIRED` |
| Roblox | `ZuQt6yFePO0` — https://www.youtube.com/watch?v=ZuQt6yFePO0 | `2023-12-18` · `31s` · `Торт Роблокс` | `PUBLIC_AT_2026_08_10_SNAPSHOT` | `IP_HOLD_DO_NOT_TRANSFER` | `OEMBED_HTTP_200` · title `Торт Roblox` · author `Milovi Cake` | `https://i.ytimg.com/vi/ZuQt6yFePO0/hqdefault.jpg` | `REQUIRED` |
| Rainbow Friends Roblox | `qPXHrdUgPUY` — https://www.youtube.com/watch?v=qPXHrdUgPUY | `2023-06-23` · `33s` · `Торт Радужные Друзья Roblox` | `PUBLIC_AT_2026_08_10_SNAPSHOT` | `IP_HOLD_DO_NOT_TRANSFER` | `OEMBED_HTTP_200` · title `Торт Rainbow Friends Roblox` · author `Milovi Cake` | `https://i.ytimg.com/vi/qPXHrdUgPUY/hqdefault.jpg` | `REQUIRED` |

## What the fresh readback closes — and what it does not

Completed now:

1. Exact canonical YouTube IDs were re-read, not rediscovered by title search.
2. Every exact object is reachable today through an official YouTube public read surface.
3. Every exact object resolves to the expected Milovi Cake author identity.
4. Current titles still explicitly carry the named character/franchise references that caused the hold.
5. Current YouTube thumbnail URLs are now frozen in this packet for the next visual-review step.
6. Provider writes during this evidence pass were exactly zero.

Still mandatory before destructive authority can even be considered:

1. Fresh owner-authenticated YouTube Data API readback if an operation requires strict current `privacyStatus` / owner-only metadata rather than exact-URL reachability.
2. Exact-object visual readback sufficient to prove the reviewed cake/video content, not merely the title and thumbnail URL string.
3. Rights-review basis for the exact depicted material, including any license/permission evidence if it exists.
4. Explicit human decision for each exact object: `KEEP`, `HIDE/UNPUBLISH`, `DELETE`, or `REQUIRES_MORE_REVIEW`.
5. If the human decision is destructive, a second pre-write exact-object readback immediately before execution plus an immutable operation-specific plan.
6. A supported provider-write credential/path explicitly bound to `milovi-cake`; credential-name guessing is prohibited.

The repository-owned `video-channel-manager` has a safe owner-authenticated reader (`YouTubeReleaseProvider.read_video()` / YouTube Data API `videos.list`) capable of returning `status.privacyStatus`, but no existing GitHub Actions YouTube-auth workflow/secret mapping was found that can be safely invoked here without inventing credential names. That gap is therefore recorded rather than bypassed.

## VK non-inference rule

No exact native VK object has been proven for any of these six rows by the accepted evidence used here. This must remain `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE`, **not** `MISSING`.

The accepted VK observation explicitly has `surface_complete_claim=false`, so the six rows are not upload candidates and are not VK cleanup candidates merely because a matching remote ID has not been proven.

## Gate result

`REVIEW_GATE_STATUS=INCOMPLETE`

Reasons now narrowed to:

- strict owner-authenticated current provider status is not yet recorded for the exact six;
- exact-object current visual readback is not yet completed for the exact six;
- explicit human decision is absent for all six rows;
- no destructive operation-specific plan exists;
- provider mutation authority remains false.

The previous broad question "do these exact YouTube objects still exist/reach Milovi Cake?" is no longer open: the bounded 2026-09-05 UTC oEmbed run answered **yes for all six**.

This packet therefore advances current-state evidence while authorizing **zero provider writes**.
