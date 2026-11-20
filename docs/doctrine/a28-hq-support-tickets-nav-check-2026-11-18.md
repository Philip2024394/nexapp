# A28 · HQ sidebar · Support Tickets navigation check

Date · 2026-11-18
Scope · Response to A28 ("HQ Support navigation check and proposal").
Outcome · verified against source. NO code change applied.

---

## 1 · Observed state

| Fact | Evidence |
|---|---|
| Route exists on disk | `src/app/nex-native/hq/support-tickets/page.tsx` + `_client.tsx` |
| Route is self-described as sealed 2026-11-10 | `page.tsx:3` + `_client.tsx:5` |
| HQ sidebar component | `src/app/nex-native/hq/_hq-nav.tsx:53-233` |
| `NAV` array entries | HQ Home · Harvest · Pages · Members (section) · Communities · Chat Themes · Security Audit (section) · Security & Recovery · Alerts · Translation · Dev previews (section) |
| Support Tickets entry in `NAV` | **Not present** |

Verified by direct read of `_hq-nav.tsx`. The 11 top-level NAV items
are listed exhaustively above; none is a link to
`/nex-native/hq/support-tickets`.

## 2 · Interpretation against the sealed 2026-11-10 doctrine

The memory entry
"🔒🎫 NEX Support Tickets · PROD SEALED 2026-11-10 · migrations 315/316/317 sandbox-only · DO NOT APPLY TO PROD"
spells out the controlling seal:

> Do not apply migrations 315, 316 or 317 to production. Keep
> production ijvqdvsvwtwxzcqmoqit sealed and unchanged. Do not
> modify production grants, admin access, environment configuration
> or deployment. Sandbox remains as already applied. … Phase 2
> feature stays sandbox-only until owner re-opens the question.

Mig 315/316/317 are the schema (`support_ticket`, `support_message`,
`support_admin_grant`, `sequence_number`, `resolved_at`, index). In
production those tables do not exist. A nav entry linking to
`/nex-native/hq/support-tickets` in a production build would:

- Render the admin surface.
- Immediately fail every DB call (table missing).
- Create a confusing "feature broken in prod" impression for any
  operator with HQ access.

**The current nav has no Support Tickets link. That is correct
behaviour under the 2026-11-10 seal for production.**

## 3 · Finding

**No defect in production.** The sealed rule is honoured: Support
Tickets is a sandbox-only surface, and the nav does not expose it.

There IS a minor usability gap *in sandbox builds only*: an operator
testing the feature in the sandbox environment has to type the URL
`/nex-native/hq/support-tickets` directly, because no sidebar link
leads there. This is friction, not a bug.

## 4 · Proposed change (NOT APPLIED)

A single sandbox-gated nav entry can be added to `_hq-nav.tsx`
*if* the owner wants the friction removed in sandbox. The gate
must be build-time, not runtime, so the entry does not even ship
in the production bundle.

Shape (DRAFT · NOT APPLIED) ·

```ts
// src/app/nex-native/hq/_hq-nav.tsx · near the Alerts entry
const SUPPORT_TICKETS_SANDBOX_ENABLED =
  process.env.NEX_SUPPORT_TICKETS_SANDBOX_ENABLED === "1";

// then conditionally include a NavLeaf in the NAV array
...(SUPPORT_TICKETS_SANDBOX_ENABLED
  ? [{
      kind: "leaf",
      href: "/nex-native/hq/support-tickets",
      label: "Support Tickets",
      glyph: "🎫",
      match: (p: string) => p.startsWith("/nex-native/hq/support-tickets"),
    }]
  : []),
```

Operator workflow ·
- Sandbox `.env.local` sets `NEX_SUPPORT_TICKETS_SANDBOX_ENABLED=1`
  → link appears.
- Production env never sets the var → link is not rendered, no
  build-time fetch, no runtime surface.

Why env-var rather than `NODE_ENV !== "production"` · the Vault
PIN-reset pattern (sealed 2026-11-14) pins fail-closed defaults in
production. A namespaced `NEX_SUPPORT_TICKETS_*` var is explicit
and auditable per the owner's "no silent dev-mode in prod" rule.

### Alternative · no code change at all

The friction of typing the URL in sandbox is small. If the owner
would rather wait until Support Tickets reaches prod before
wiring any nav entry, A28 closes with no action and "the seal
is honoured" as the outcome.

## 5 · Explicit exclusions

- **No prod nav change.** The seal 2026-11-10 is binding.
- **No prod migration.** 315/316/317 remain sandbox-only.
- **No change to admin-grant logic.** The `support_admin_grant`
  table + its grants are unchanged.
- **No RLS change.**
- **No test added.** A28 is a nav check; the proposal is a shape
  only, not an implementation.

## 6 · Honest classification

| State | Value |
|---|---|
| A28 status | **AUDITED · no defect vs sealed rule · optional sandbox-only nav wire proposed** |
| Prod nav | Correct under 2026-11-10 seal · no change needed |
| Sandbox nav | Friction (URL must be typed); env-gated link would remove it |
| Remaining founder-only action | Decide whether the sandbox env-gated nav wire is worth doing; otherwise close A28 as "no action" |
