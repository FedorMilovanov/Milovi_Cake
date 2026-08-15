# Milovi Cake — cross-provider IP / trademark review evidence

**Snapshot date:** 2026-08-15  
**Scope:** evidence-only review for `FedorMilovanov/Milovi_Cake#19`  
**Site baseline:** `c8426eb90378993faf7822f32d95f6402e616143`  
**YouTube channel:** `UCMDnxfGZiBqcDzgUV1zjFpw` (`@milovi_cake`)  
**VK project:** `project_key=milovi-cake`, community `68859909`, owner `-68859909`

## Safety contract

This file is a review artifact, not a legal conclusion and not a provider-write plan.

- `provider_mutation_authorized=false`
- `delete_authorized=false`
- `hide_authorized=false`
- `upload_authorized=false`
- `surface_complete_claim=false`
- absence from the accepted VK observations is **not** proof that a native VK Clip is missing
- generic animals, sports, books, shapes, colors or other generic titles are not removal candidates from title text alone; visual evidence is required
- an existing public object requires exact provider identity/evidence and a separately reviewed hide/unpublish decision before any destructive action

## Evidence provenance

Primary durable sources:

- `FedorMilovanov/Milovi_Cake#19` — exact YouTube provider inventory and rights-review scope
- `FedorMilovanov/video-channel-manager#257` — exact Milovi identity, VK Clips investigation, provider-free reconciliation and review queues
- `FedorMilovanov/video-channel-manager#323` — later rollout journal for an explicitly filtered 12-ID migration allowlist; IP/trademark review rows are outside that allowlist

Accepted evidence anchors used by the reconciliation work:

- bounded exact-owner VK UI observation: 106 native Clip IDs; output SHA-256 `cae57c99949fe818e2fe6bf05a975324a36f25bad28e25c7daa77c5e73b9be3a`; `surface_complete_claim=false`
- confectionery gap evidence ZIP SHA-256 `f33b119d660fef85f11ae3d85f7f6649ff70e566594e26fff785cded5c5481a3`
- confectionery gap result SHA-256 `6c99be41c3a0c068819f074b16664252c6601ed3b5f1bd49d184b2dc8ed631e0`
- exact-VK sequence evidence ZIP SHA-256 `23a6238bf61e8e67cf21fe768a58947a39b514c4d6dd192fddc08d3b9584c616`
- exact-VK sequence result SHA-256 `0ea7c8c8654e8f99a3252b5b629013e5fa21bbadae369a50682661a3a1f25de2`
- final 13-row media-reconciliation queue ZIP SHA-256 `8d47a14f130aa3bd892eceb309a29c9c2ca8bcceae206cba86f5cb71a28d9e7d`
- final 13-row queue result SHA-256 `ed9363ee664342205333523b3768ff81392ce1d4583f24567683771bec2202d8`

The accepted final media-reconciliation queue contains exactly 13 `MEDIA_RECONCILIATION_REQUIRED` cake/dessert rows and explicitly excludes IP/trademark review rows.

### Exact six-row migration-gap IP hold

The narrower six-row `IP_HOLD_DO_NOT_TRANSFER` subset is now provenance-backed rather than reconstructed by arithmetic. The gap collector at the exact base of `video-channel-manager#316` (`d3f099c1761035d2261cb99db31370cdd09b7970`) has blob SHA `f465f5653fb90d83424a8795436898a6ec96419f`; that blob is unchanged on current `video-channel-manager/main`. Its exact 25-row `_CANDIDATE_ROWS` input contains six rows with source classifier label `IP_HOLD_HIDE`, and its deterministic `_transfer_gate()` maps that label to `IP_HOLD_DO_NOT_TRANSFER`.

| Subject | YouTube ID | Source classifier | Final transfer gate |
|---|---|---|---|
| Om Nom | `P2Bpt77k408` | `IP_HOLD_HIDE` | `IP_HOLD_DO_NOT_TRANSFER` |
| Squid Game | `jZjDWn_MNq0` | `IP_HOLD_HIDE` | `IP_HOLD_DO_NOT_TRANSFER` |
| Cheburashka / Gena | `xzMgMEWz5pM` | `IP_HOLD_HIDE` | `IP_HOLD_DO_NOT_TRANSFER` |
| Wednesday | `7FCbopqeTYE` | `IP_HOLD_HIDE` | `IP_HOLD_DO_NOT_TRANSFER` |
| Roblox | `ZuQt6yFePO0` | `IP_HOLD_HIDE` | `IP_HOLD_DO_NOT_TRANSFER` |
| Rainbow Friends Roblox | `qPXHrdUgPUY` | `IP_HOLD_HIDE` | `IP_HOLD_DO_NOT_TRANSFER` |

`IP_HOLD_HIDE` is a historical source-classifier name, **not hide authority**. The accepted evidence result and this review both keep `hide_authorized=false`; the operational meaning here is only **do not transfer/amplify while review remains unresolved**.

This six-row subset is narrower than the broader named-rights inventory below. Items can remain in named-rights review without belonging to this exact 25-row migration-gap hold.

## Named character / franchise rights review

`NAMED_RIGHTS_REVIEW` means: do not newly amplify/migrate while rights remain unresolved. It does **not** mean infringement has been adjudicated and does **not** authorize deletion or hiding.

| Subject | YouTube ID | Review status | Proven native VK representation from accepted evidence |
|---|---|---|---|
| Om Nom | `P2Bpt77k408` | `NAMED_RIGHTS_REVIEW` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` |
| Ladybug / Cat Noir | `R9Bsduj1De8` | `NAMED_RIGHTS_REVIEW` | `-68859909_456239192` |
| Ladybug / Cat Noir | `vByaC26Rxqc` | `NAMED_RIGHTS_REVIEW` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` |
| Squid Game | `jZjDWn_MNq0` | `NAMED_RIGHTS_REVIEW` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` |
| Naruto | `lEpaHkg6D5A` | `NAMED_RIGHTS_REVIEW` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` |
| Shrek | `p3xZaajOMvc` | `NAMED_RIGHTS_REVIEW` | `-68859909_456239130` |
| Cheburashka / Gena | `xzMgMEWz5pM` | `NAMED_RIGHTS_REVIEW` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` |
| LEGO | `Vin9ATN9xuA` | `NAMED_RIGHTS_REVIEW` | `-68859909_456239074` |
| Wednesday | `7FCbopqeTYE` | `NAMED_RIGHTS_REVIEW` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` |
| Roblox / Rainbow Friends Roblox | `ZuQt6yFePO0` | `NAMED_RIGHTS_REVIEW` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` |
| Roblox / Rainbow Friends Roblox | `qPXHrdUgPUY` | `NAMED_RIGHTS_REVIEW` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` |
| Cinnamoroll | `MbwyXxM5tXE` | `NAMED_RIGHTS_REVIEW` | `-68859909_456239064` |
| Among Us | `suurVa6w5U4` | `NAMED_RIGHTS_REVIEW` | `-68859909_456239026` |

`NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` is intentionally not `MISSING`: the accepted VK surface is bounded evidence with `surface_complete_claim=false`.

## Minecraft — guideline review, not automatic takedown

These rows remain `GUIDELINE_REVIEW`. They must not be collapsed into the character/franchise hold or treated as automatic removal candidates.

| YouTube ID | Review status | Proven native VK representation |
|---|---|---|
| `BUF6CG3rvZU` | `GUIDELINE_REVIEW` | `-68859909_456239164` |
| `1AHaYiru8VI` | `GUIDELINE_REVIEW` | `-68859909_456239132` |
| `94KbvcOuNzw` | `GUIDELINE_REVIEW` | `-68859909_456239098` |

The site gallery also has explicit Minecraft entries `p20`, `p21`, `p24`; any guideline assessment should be applied consistently across site and video rather than deleting one surface independently.

## Trademark / commercial naming review

These are separate naming/trademark review signals, not automatic character-IP takedowns.

| Subject | YouTube ID | Review status | Proven native VK representation from accepted evidence |
|---|---|---|---|
| BMW cake | `S3Aga1UDFdE` | `TRADEMARK_REVIEW` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` |
| Ozon / Ferrero cake | `2yhQ4nMWm3I` | `TRADEMARK_REVIEW` | `NOT_PROVEN_FROM_ACCEPTED_EVIDENCE` |

## Exact duplicate / migration controls established separately

The accepted sequence review also proved five previously unresolved confectionery YouTube candidates already have native VK representations. These are migration/duplicate controls, **not** rights findings:

- `FQGxV4DRPQw` → `-68859909_456239159`
- `MdQ0kNBSsa8` → `-68859909_456239176`
- `cE0ofu6WV3s` → `-68859909_456239162`
- `CQ29P1F8Hfo` → `-68859909_456239100`
- `R-LknUy9BEs` → `-68859909_456239031`

Negative controls remained visibly distinct:

- `SiluLt5Bz1c` vs `-68859909_456239076`
- `BAVKrQQ00XI` vs `-68859909_456239061`

This is why title/date/duration or thumbnail similarity alone must not be promoted to exact cross-provider identity.

## Operational next gate

Before any hide/unpublish/delete decision for an existing public object, freeze a separate immutable candidate list containing, for each exact object:

1. exact provider (`YouTube` / `VK`),
2. exact video/remote ID and canonical provider URL,
3. publication date/status,
4. screenshot or provider readback proving the exact object,
5. review class and evidence basis,
6. explicit human decision for that exact object.

Until that separate reviewed gate exists, this document authorizes **zero provider mutations**.