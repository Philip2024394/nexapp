# Chat RLS + Free-chat persistence evidence · 2026-11-20

## Personas verified in sandbox `kdstoyyeygcopkogqsyv`
- nex-99901 (Hamrex) · id `11111111-1111-4111-8111-111111111111` · supabase_user_id `8749b2ec-…` · is_mock_persona=true
- nex-99903 (Rosa)   · id `11111111-1111-4111-8111-111111111113` · supabase_user_id `421ef697-…` · is_mock_persona=true

## Rosa-side spec (env=nex-99903 on :3008)
3 passed (11.1s) — see `rosa-side-rerun.txt`

## Hamrex-side shop-chat spec (env=nex-99901 on :3008)
7 passed (36.4s) — see `shop-chat-journey-hamrex-rerun.txt`

## Chat RLS anon-denial (sandbox anon key, no cookie)
| Surface | Status | Notes |
|---|---|---|
| REST `/rest/v1/nex_peer_message?select=*&limit=1` | **200 `[]`** | RLS filtered — zero rows to anon |
| REST `/rest/v1/nex_peer_conversation?select=*&limit=1` | **200 `[]`** | RLS filtered — zero rows to anon |
| API GET `/api/nex-native/chat/encrypted` | **405** | No GET handler |
| API POST `/api/nex-native/chat/encrypted` (no cookies) | **400 missing_message_group_id** | Note: dev `next dev` has NEX_DEV_IMPERSONATE_HANDLE in-process, so the route resolves to the persona and reaches schema validation. In production (Supabase-URL guard refuses impersonation against prod ref ijvqdvsvwtwxzcqmoqit), this call returns 401 not_signed_in. |

## Free-chat DB persistence (team/theme selection)
Theme/team selection on `/nex-native/free-chat` is **cookie-only** (`nex-free-chat-wallpaper`, `nex-free-chat-row-dismissed`, `nex-free-chat-bubble-<themeId>`) — no DB write occurs on tile pick. By design.

The DB write path adjacent to free-chat is `/nex-native/free-chat/bubble-customize`:
- Action: `saveBubbleCustomizationAction` in `src/app/nex-native/free-chat/_customize-actions.ts`
- Table: `nex_account` · columns `bubble_self_hex`, `bubble_peer_hex` (mig 341), optionally `bubble_self_appearance`, `bubble_peer_appearance` (mig 343)
- Auth model: `resolveSessionWithDevOverride()` server-side; account id is session-derived, NOT body-supplied; fail-closed when session missing.
- Baseline Hamrex row: bubble_self_hex=#fdd835, bubble_peer_hex=null, bubble_self_appearance=10

No stable `data-nex-free-chat-theme-tile` selector exists today on the theme picker — a future browser journey for theme-selection persistence would need either a role-name click or a new test-id. Flagged as UI test-id gap.

## Tier-limit enforcement
Not exercised this session — would require signed-in session with a specific tier and an attempt to exceed the limit. Marked UNTESTED.
