# Checkpoint 2 · Drawer reconciliation (read-only)

**Checkpoint boundary**: stopped before any writes. Owner clarification about drawer semantics required this.
**Repo**: `C:/Users/Victus/nexapp` · remote `Philip2024394/nexapp.git` · branch `release-audit-v1-2026-11-14`
**HEAD**: `132bc24daaaec90881ee9dbcdd7d2dbaa83c6f0b`
**Dirty**: inherited from checkpoint 1 (same working tree; nothing new modified this turn)
**Prod DB** `ijvqdvsvwtwxzcqmoqit`: untouched · no connection attempted
**Agent roles**: unavailable in this turn · performed sequentially as Lead → Independent QA (read-only); no Builder work started.

---

## 1 · Drawer semantics (owner-stated, verified against code)

| Drawer | Owner statement | Code reality |
|---|---|---|
| **LEFT** | notifications / inbox drawer for orders, messages, notifications | `src/components/nex-native/notifications-drawer/notifications-drawer-client.tsx` · bell trigger, slides in from `left: 0`, has sections **Chats / Shop / Orders / Follows**, header unread pill, section-level unread pills |
| **RIGHT** | navigation links to pages | referenced as "right navigation drawer" in the same file's header comment: *"slides in from the left so it reads as a separate 'awareness' surface distinct from the right 'navigation' drawer"* |

The LEFT drawer is a full notifications surface in its own right, not a container that needs a sibling badge bolted on. The prior report's *"left-drawer order-count badge"* framing conflated it with the RIGHT nav drawer. That framing is withdrawn.

---

## 2 · Current wiring of the LEFT drawer

- Mounted in: `free-chat/page.tsx`, `chat/peer/[accountId]/page.tsx`, `shop-drawer-client.tsx`, `chat-chrome/free-chat-header.tsx`.
- **Not** mounted on any `/nex-native/manage/*` seller route.
- Data flow:
  - Chat notifications: real — built from `incomingInviteNotifsFC` + `unreadChatNotifsFC`.
  - Non-chat sections (Shop / **Orders** / Follows): sourced from `MOCK_NOTIFICATIONS` filtered by section.
  - Confirmed in `src/lib/nex-native/notifications/mock-notifications-data.ts:147,157` — two mock entries under `section: "orders"`.
- File header comment states explicitly: *"Phase 2 (NOT authorised) will replace the mock import with a server-pushed event stream + persistent read state."*

---

## 3 · Verification of seller order alerts in the LEFT drawer

- **Chat section**: live-wired · would reflect a real unread cart_order chat message (per checkpoint 1 observation `apiBody.chat` positive).
- **Orders section**: **mock-only**. A newly created `nex_order` (state='created') does not appear in this drawer's "Orders" section. There is no server path mapping `nex_order` → `NotificationItem` for this UI.
- **Exact-order navigation**: tapping an orders-section row goes to a `Link` whose `href` is mock-derived; no production code fills `href` with a real order id.
- Therefore the LEFT drawer today does **not** carry live seller-order alerts, by the component's own Phase 1 design.

---

## 4 · Reconciliation with the /manage badge fix (checkpoint 1)

- `git diff src/app/nex-native/manage/page.tsx` shows the owner-authorised 2026-11-16 change still in place: the import of `ManageInboxUnreadBadgeClient` and its render inside `<SectionLabel>Orders & Fulfilment</SectionLabel>`.
- That fix remains the only live in-UI seller order indicator. Unchanged by this checkpoint.

---

## 5 · Is there a demonstrated defect I can fix within this checkpoint?

**No.** Analysis:

1. The visible gap between "`/manage` in-page badge is live" and "LEFT drawer orders section is mock" is **not a bug**; it is the sealed Phase 1 design of `notifications-drawer-client.tsx`. The component's own header comment reserves live wiring for a future authorised Phase 2.
2. Wiring real `nex_order` creation into the LEFT drawer's orders section would require:
   - A server data source (query seller's `nex_order` rows and map to `NotificationItem`).
   - A delivery mechanism (poll endpoint or event stream).
   - A read-state persistence table (`notifIds` currently uses session-local `useState`).
   - A route rewrite from the component's mock `href` to real `/nex-native/manage/orders/[orderId]`.
   
   That is a feature addition, not a defect fix. The checkpoint rule is *"Fix only a demonstrated defect. Do not reopen completed checkpoints or add features."*
3. Mounting the existing LEFT drawer on `/manage` as-is would show mock order rows to the seller, which would be a worse state than the honest-null `/manage` badge shipped in checkpoint 1.

**Verdict: BLOCKED pending owner decision.** No write performed.

---

## 6 · Exact decision needed from the owner

Please choose one:

- **(A) Authorise Phase 2 wiring of the LEFT notifications drawer's "Orders" section.** This is a new scoped checkpoint. Deliverables: server query of seller's recent `nex_order` rows, mapping to `NotificationItem` with real `href=/nex-native/manage/orders/[orderId]`, polling via existing `/api/nex-native/unread-count` or a sibling endpoint that returns a small order list, and a read-state persistence design (table name + migration number to be proposed before writing). Est. scope beyond a 60-minute checkpoint; propose splitting into "read path" and "ack path" sub-checkpoints.
- **(B) Keep the LEFT drawer's "Orders" section mock-only for now** and treat the `/manage` in-page badge (checkpoint 1) as the single source of live seller order signalling until the broader notifications Phase 2 is authorised. No action required from me; the prior "left-drawer order-count badge" suggestion is retracted.
- **(C) Different direction** you specify.

---

## 7 · Items explicitly OUT OF SCOPE for this checkpoint (per your instruction)

- Payment-sharing popup — not touched.
- Expiring bank-details card — not touched.
- Reusable seller Q&A — not touched.

Hammerex / Rosa / 99901 / protected artifacts — untouched. No secrets rotated. No commits, pushes, migrations, deploys, resets, env switches, device-auth bypasses.

---

## 8 · Scoped verdicts

- **Founder-testing**: unchanged from checkpoint 1 — `/manage` in-page badge is live. LEFT drawer order-section remains mock by design.
- **Public-launch**: unchanged from checkpoint 1 — NOT READY. Blockers retained: build, Vault regression, phone verification, typecheck remediation, second-seller fixture for CP4 denial, production migration/deploy gates.

---

## 9 · Next agreed checkpoint (named · not started)

**If owner selects (A) in §6**: *"Notifications drawer · Phase 2 orders read-path"* — a bounded checkpoint to add a server-sourced orders feed into the LEFT drawer's "Orders" section only, preserving the `/manage` in-page badge, with a separate later checkpoint for ack/read-state persistence.

**If owner selects (B)**: no new NEX checkpoint created from this turn. Returns to the previously agreed backlog ordering.

Not starting either. Stopping for review. The whole app is not finished.
