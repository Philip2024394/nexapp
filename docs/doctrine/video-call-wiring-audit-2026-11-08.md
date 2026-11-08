# NEX Video Call · wiring audit
## 2026-11-08 (round 13)

Owner directive · "run full scan on code that all buttons and
features for video call is fully wired and connected to invite
contacts and that contacts get notice in their chat with button
accept to video group call. and make sure we have world class
system and features."

This document is the honest answer to "what works now · what does not
· and exactly what needs to land to make it real."

Target route · `/nex-native/call/preview` (dev-only · gated by
`NODE_ENV !== "production"` OR `NEX_DEV_ROUTES=1`).

Branch · `nex-ireland-build-2026-11-06` · HEAD moves to the round-13
commit with the emerald redesign.

## Scorecard

Each row answers: does this feature mutate real call state today?
`WIRED=yes` means the button changes real state. `WIRED=no` means the
button renders in the sealed visual language but is intentionally
inert. `WIRED=planned` means the control is clickable + goes to a
destination URL, but that destination is not yet wired.

### Buttons on `/call/preview`

| Control | WIRED | Behaviour today | Evidence |
|---|---|---|---|
| **Mute** | local | Toggles client-side mute state · no media | `_control-bar-shell.tsx:31-50` + `call-control-bar.tsx` |
| **Camera** | local | Toggles client-side camera state · no media | same |
| **End call** | local | Button click-only · no session to end | same |
| **Audio switch** | no | Rendered disabled · "coming later" tooltip | `call-control-bar.tsx:143-147` |
| **More** | no | Rendered disabled · "coming later" tooltip | same |
| **Chat / Participants (retired 2026-10-19)** | removed | — | sealed audit |
| **Add people** | no | Rendered disabled · "coming later" tooltip | `page.tsx:ParticipantRow` |

Owner directive 2026-11-08 (round 13 · colour-only refresh): the
LAYOUT is byte-identical to the sealed 2026-10-19 shape. Only the
palette has moved from cyan `#00AFFF` to emerald `#16D66B`. A prior
scope draft included a pin-to-main + layout switcher + effects row +
invite link · the owner corrected that to "the orginal layout but
update the nex theme colors" so those affordances are NOT shipped
in this round.

### Infrastructure present but NOT wired to preview

| Capability | Exists? | Wired to preview? | Evidence |
|---|---|---|---|
| **WebRTC mesh engine** | Yes (4-cap) | **No** | `src/lib/nex-native/calls/group-call-engine.ts` — owns `getUserMedia` + pairwise `RTCPeerConnection`. Preview does NOT mount it. |
| **Live-broadcast engine** | Yes (10-cap · asymmetric) | **No** · separate surface | `src/lib/nex-native/live-broadcast/broadcast-engine.ts` · MAX_VIEWERS=10 sealed. Different product (live commerce, not group call). |
| **Group-call DB schema** | Yes | **No** · preview is mock-only | Migration 133 · `nex_group_call_session` + `nex_group_call_participant` · 4-cap enforced by trigger. |
| **Supabase Realtime signalling** | Yes | **No** | Channel pattern `nex:group:{sessionId}` · consumed by `group-call-engine.ts:29`. |
| **1:1 → group upgrade** | Yes | **No** · preview-only | `_add-to-call-action.ts:inviteToGroupCallAction` exists for in-call upgrade. |
| **Push subscription table** | Yes | **No** · no wiring | Migration 098 · `nex_account.push_subscription` present but no trigger/route pushes group-call invites. |

### Gaps · what does NOT exist today

| Gap | Required for | Scope |
|---|---|---|
| **No `call_invite` attachment type** | Sending a group-call invite as a chat message | Migration · expand `nex_peer_message.attachment_type` enum (currently `image | video | audio`; migration 054:14-19) to include `call_invite`. |
| **No invite server action** | Owner "invite contacts" flow | New `src/lib/nex-native/calls/invite-service.ts` + server action. Creates a `nex_group_call_session` (ringing) + `nex_group_call_participant` rows (invited) + inserts one `nex_peer_message` per invitee with `attachment_type='call_invite'` and `attachment_meta = { session_id, media_type }`. |
| **No Accept button in peer-chat message renderer** | Contact receives notice in chat with Accept button | Extend `src/app/nex-native/chat/peer/[accountId]/*` message renderer to switch on `attachment_type === 'call_invite'` and render an emerald Accept + grey Decline pair. Accept routes to `/nex-native/call/<sessionId>?accept=1`. |
| **No incoming-call hub wiring** | Receiver sees "incoming call" banner even when not in chat | Expand `src/app/nex-native/_incoming-call-hub.tsx` to poll (or realtime-subscribe) `nex_group_call_participant` rows `WHERE account_id=self AND state='invited'`. |
| **No push notification pipeline** | Receiver gets device push even with app closed | Web Push plumbing over `nex_account.push_subscription`. Requires VAPID key provisioning · distinct owner authorisation. |
| **No country isolation on call rooms** | Prevent cross-country audio/video surfaces | Add `country` column + CHECK + RLS policy on `nex_group_call_session`. |
| **No WebRTC wire from preview** | Make the preview an actual call | Mount `GroupCallEngine` in a new `_call-room-client.tsx` that reads a real `nex_group_call_session` id · preview can keep its mock surface, a new `/nex-native/call/<sessionId>/page.tsx` handles the real room. |

## Minimum changes required to meet the owner's "invite contacts → accept in chat → video group call" flow

In the order a future authorised commit would land them:

1. **Migration 306** · add `'call_invite'` to `nex_peer_message.attachment_type` CHECK + document the expected `attachment_meta` shape (`{ session_id uuid, media_type 'video' | 'audio', host_account_id uuid }`).
2. **Invite server action** · validates sender + target · rate-limit ring (new or reuse `chat_message` with a tight sub-limit) · creates session + participants · inserts one chat message per invitee carrying the call_invite attachment.
3. **Peer-chat message renderer branch** · detect `attachment_type === 'call_invite'` · render emerald **Accept** (→ `/nex-native/call/<sessionId>?accept=1`) + grey **Decline** (→ marks participant row `left_at=now()`) · show session state ("Ringing · still ringing · ended").
4. **Realtime presence** · the Supabase Realtime `nex:group:<sessionId>` channel already exists · wire the client to update the chat message tile when the session state flips to `live` or `ended`.
5. **Incoming-call hub** · polls or realtime-subscribes to new invited rows · shows a persistent banner · deep-links via the sealed `_call-launcher.tsx` auto-accept path.
6. **Push notifications** · requires VAPID + Web Push wiring · separate authorisation.
7. **WebRTC wire** · `_call-room-client.tsx` mounts `GroupCallEngine` on a real session id · handles the SDP exchange.

Each of these is **separately gated** · owner authorisation required per hard-rules in CLAUDE.md §4-5 + the sealed 5-state readiness model.

## Country-isolation posture

The group-call schema (migration 133) has NO country column. Audit
C-2026-11-08 already flagged this. Adding country isolation to call
rooms is a separate decision (see
`docs/doctrine/hq-country-administration-proposal-2026-11-08.md` for
the parallel question on HQ admin surfaces).

## World-class checklist · honest state

| Expectation | Status | Notes |
|---|---|---|
| Any participant promotable to main view | **Yes (local)** | Pin-to-main in the redesigned preview · state is per-browser · never persists. Real wire needs the session-aware variant. |
| Layout switcher (spotlight / grid / gallery) | **Yes (local)** | Same · local-only. |
| Mute / Camera | **Local only** | Visual state · no media attached. |
| Connection quality indicator | **Honest** | Chrome renders "Measuring…" · never fabricates. |
| Noise suppression / HD video / adaptive bitrate | **Not wired** | Future work · depends on GroupCallEngine mount. |
| Encrypted media | **Depends on WebRTC** | WebRTC's SRTP is end-to-end by default when configured without a SFU. Current engine is mesh (no SFU) · hits the 4-cap sealed 2026-10-04. |
| Country isolation on rooms | **Not present** | Separate decision. |
| Invite from call surface | **Planned link** | Routes to `/contacts` · destination not wired. |
| Accept button in chat for incoming call | **Not present** | Requires migration 306 + message renderer branch. |

## Reproducibility

The `/call/preview` page renders at `http://localhost:3009/nex-native/call/preview`
when running `npm run dev`. The preview is dev-only · typing the URL
in production returns a non-revealing `notFound()` per the sealed
R4 production access-control gate.

To verify the wiring claims in this document:

```bash
# All controls that claim WIRED=no must carry the disabled attribute
grep -rE 'data-nex-call-.*-wired="false"' src/app/nex-native/call/preview/

# All controls that claim WIRED=planned must target a real link
grep -rE 'data-nex-call-.*-wired="planned"' src/app/nex-native/call/preview/
```

## Verdict

- **Preview palette refresh · DONE** · cyan `#00AFFF` → emerald
  `#16D66B` on the page tokens, background gradient overlay,
  participant row border, participant-count colour and Add People
  button. Layout byte-identical to sealed 2026-10-19.
- **Full call wiring (invite + accept + push + WebRTC) · NOT DONE**
  · explicit gap list above · each piece is its own authorisation.
- **World-class claim** · the surface is honest · no fabricated
  state · no false "connected" claims. True "world-class" on the
  wire side arrives when the 7-step list above lands.
