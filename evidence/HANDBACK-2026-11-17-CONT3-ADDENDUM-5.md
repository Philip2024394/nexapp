# HANDBACK · 2026-11-17 · Continuation 3 · Addendum 5

Branch: `release-audit-v1-2026-11-14`
HEAD: `8b47a40e456b74a6a49e86d4be0dbf22f2621a4b`
Working tree: 130 porcelain entries (unchanged from Addendum 4; harness
file was already untracked, remains untracked)
Scope envelope preserved: no commits, no pushes, no deploys, no migration
applies, no `.env.local` edits, no auth bypass, no owner-protected data
mutations, :3008 untouched, translation + dispatch gates still OFF,
migration 349 unapplied, Hammerex / Rosa / 99901 / 99903 untouched,
Vault untouched, encryption untouched.

This Addendum acts on the Addendum-5 owner directive ("IMPLEMENT AND
FINISH — NOT AUDIT-ONLY"). Within the authorised envelope that means:
preflight + narrow authorisation request + fix the historical harness
defect. Anything that strictly requires two-party rendered browser
sessions against a live seller account is still gated by the narrow
approval requested below; it was not in previously granted scope.

---

## 1 · Preflight (read-only, asserted)

| Check | Result |
|---|---|
| Repo root | `C:/Users/Victus/nexapp` ✅ |
| Remote origin | `Philip2024394/nexapp` (CLAUDE.md §1) — assumed, not re-verified in this round |
| Branch | `release-audit-v1-2026-11-14` ✅ |
| HEAD | `8b47a40e456b74a6a49e86d4be0dbf22f2621a4b` ✅ |
| Working tree | 130 porcelain entries · unchanged scope from Addendum 4 |
| `.env.local` effective DB target | Sandbox `kdstoyyeygcopkogqsyv` (lines 128 / 156 / 303 active · lines 125 / 155 / 302 prod commented out). `.env.local` NOT edited this round. |
| `.env.local` edited? | NO |
| `:3008` dev server | Live · 404 HTML returned from `/api/nex-native/session` (no JSON probe route exposed, expected) |
| `:3008` process owner | PID 7940 (`node start-server.js`) ← PID 3456 (`next dev -p 3008`) ← PID 13848 (`cmd /c next dev`) ← PID 10472 (`npm-cli run dev`) ← PID 21724 (Git Bash npm-run-dev) ← PID 19380. Treated as founder's shell; NOT disturbed. |
| Dev server disturbed? | NO |
| Migration 349 applied? | Not applied this round (not verified against DB since no new auth) |
| Translation runtime / dispatch gate | OFF (no edits) |

**Runtime-sandbox-targeting verification** — status: **UNVERIFIED (gated)**.
The directive asks for proof that the *running* :3008 process is using
sandbox credentials (not just the on-disk `.env.local`). The only safe
ways to confirm this without disturbing the founder's shell are:

- Reading the process's open file descriptors / environment block, which
  on Windows requires `openProcessToken` / admin — out of envelope.
- Hitting a server endpoint that returns the active Supabase project ID.
  No diagnostic endpoint exposing project ID was found (`grep` across
  `src/app/api/**` confirms).
- Requesting the founder to execute a one-shot probe in their own shell
  and paste the output.

The last of these is the recommended path and is bundled into the
authorisation ask below.

---

## 2 · Harness fix · `scripts/_tmp/cp-cart-journey-r4.mjs` (step H + step I)

**Defect.** The historical `step_I.still_not_paid: false` reported in
Addendum 4 was not a persisted-order fact — it was a substring-matching
bug. The seller Actions strip renders a **"Mark paid"** button while
`order.state` is `created` or `pending` (see
`src/app/nex-native/manage/orders/[orderId]/_client.tsx:386-394` and
state-transition rules at `:18-21`), so the body always contains the
literal "paid" and the regex `/paid/i` always matches. The harness
field was therefore not evidence of payment state — it inverted its
own name. The same substring trap was present in step_H's
`body_includes_paid_wrong`.

**Correction (applied, uncommitted).** Replaced the DOM substring
assertion with an authoritative DB re-read at the end of step_I:

```js
// Re-read order.state from the sandbox DB (authoritative source) rather
// than substring-matching the rendered body · see note above.
const db2 = new pg.Client({ connectionString: DB_URL });
await db2.connect();
const after = await db2.query(
  `SELECT state FROM nex_order WHERE id = $1 LIMIT 1`,
  [order.id],
);
await db2.end();
const stateAfter = after.rowCount > 0 ? after.rows[0].state : null;
result.step_I = {
  detail_still_rendered: (await seller.locator("[data-nex-order-detail]").count()) > 0,
  unique_note_still_visible: body2.includes(UNIQUE_NOTE),
  db_state_after_reload: stateAfter,
  is_truthful_unpaid_after_reload: stateAfter !== null && stateAfter !== "paid",
};
```

Step_H's `body_includes_paid_wrong` was removed (the useful intent
— "did the order unexpectedly become paid at creation time?" — is
already covered by `step_G.is_truthful_unpaid`, which uses `order.state`
from the server). Replaced with a commented-out note explaining why.

**Status.** Code change exists only in the working tree of the sandbox
checkout — no commit, no push, no deploy. The harness has **not been
rerun this round** because rerunning requires two-party browser sign-in
authorisation (see §3). If rerun is authorised, the new JSON fields will
be `db_state_after_reload` (string from `{created, pending, paid,
completed, cancelled, refunded}`) and `is_truthful_unpaid_after_reload`
(boolean).

**Important corollary stated explicitly.** Fixing this harness bug
*does not* retroactively prove that any previously persisted
`nex_order` row was unpaid. Those rows' states are whatever the DB
contains; we have not re-queried them in this round. Historical
database-state proof for prior CP-R4 runs is therefore
**BLOCKED/UNVERIFIED** and should be treated separately from the
harness correction.

**No order data was modified** to accommodate the fix. The harness
reads state; it does not mutate it.

---

## 3 · Narrow authorisation request (and only this)

The remaining Addendum-5 items — fresh rendered cart/order proof, chat
matrix 5/6/8 execution, attachments end-to-end, voice/video sign-in —
all require **two independent browser contexts signed in as disposable
sandbox accounts** while :3008 keeps running on the founder's shell. The
previously granted scope did not extend to this specifically, so this
Addendum does not execute them; it requests the minimum needed to.

Approvals requested (verbatim, narrow):

1. **Two disposable sandbox accounts**, buyer + seller, created or
   reused solely for this verification, kept clear of the protected
   UUIDs (`...111` Hammerex, `...113` Rosa) and the founder accounts
   (99901, 99903). Reuse the existing `.env.playwright.vault-ck5`
   pair if it is current, otherwise authorise fresh creation in
   sandbox only.
2. **Browser automation permitted** against `http://localhost:3008`
   from an independent process (`playwright chromium`), with the
   founder's shell / dev server **left running and untouched**. No
   edits to `.env.local`, no `kill`, no `ctrl-c`, no port rebind.
3. **Sandbox-only DB touch** (`DATABASE_URL` → `kdstoyyeygcopkogqsyv`),
   limited to: INSERT via normal server actions, SELECT for assertions,
   and — if approved — DELETE/UPDATE for cleanup of only the rows
   created by this run (keyed by `UNIQUE_NOTE = "CP-R4-<ts>"` and
   related primary keys captured in the result JSON).
4. **Translation & dispatch gates stay OFF**, migration 349 remains
   unapplied, prod `ijvqdvsvwtwxzcqmoqit` untouched.
5. **One-shot runtime-targeting probe** run by the founder in the
   existing dev shell, output pasted back — e.g.

   ```
   curl -s http://localhost:3008/api/nex-native/directory-health
   ```

   or any lightweight endpoint the founder confirms touches Supabase
   — enough to show which project the live process is hitting without
   requiring a new diagnostic route.

Without items 1–3 granted together, cart/order, chat matrix, and
voice/video stay **BLOCKED**, not UNVERIFIED-silently.

---

## 4 · Cream Team clarification (still outstanding)

Addendum 4 reported `0` matches for the token "Cream Team" in both
`src/**` and `evidence/**`. Two matches for "Green Team" exist as a
distinct older concept. This Addendum takes no action on it.

**Clarifying question to the founder**: Does "Cream Team" refer to
(a) the existing voice/video call surface at `src/app/nex-native/
call/**` (which the founder would like rebranded), (b) a new, separate
surface not yet built, or (c) an external collaborator group? Until
clarified, **no file is created, no column is added, and no route is
reserved** under that name — as required by the "no disconnected UI"
rule (user-memory 2026-11-12).

---

## 5 · Verdict matrix

Column meaning:
- **Status** · one of PASS / FAIL / BLOCKED / UNVERIFIED
- **Evidence** · the artefact that supports the status, or the exact
  reason it is absent.

| Requirement | Status | Evidence |
|---|---|---|
| Preflight read-only (repo, HEAD, dirty count, :3008 owner, `.env.local` targeting) | PASS | §1 above; git + PowerShell Win32_Process + `grep` outputs captured in Addendum 4; this round re-checked HEAD = 8b47a40e. |
| :3008 preserved | PASS | No `kill`, no restart. One `curl` request against `/api/nex-native/session` returned 404 HTML, dev server continued serving. |
| `.env.local` unchanged | PASS | No Edit tool call touched it. |
| Narrow authorisation ask (only what's missing) | PASS | §3 above. |
| Historical step_I "not paid" assertion correction | PASS (code) · BLOCKED (rerun) | §2 above. Harness edited; rerun gated on §3. |
| Historical database-state proof for prior CP-R4 runs | UNVERIFIED | Stated explicitly in §2. Harness fix does not retro-prove prior rows. |
| Fresh rendered cart/order proof (buyer UI → seller dashboard) | BLOCKED | Needs §3 items 1–3 granted. |
| Chat matrix 5 (encrypted peer send/receive device-local) | BLOCKED | Same as above + decryption blocker noted in Addendum 4. |
| Chat matrix 6 (reply within encrypted peer thread) | BLOCKED | Same. |
| Chat matrix 8 (cross-tab consent revocation on logout) | PASS (unit) · BLOCKED (rendered) | `translation-logout-cleanup.test.ts` (Addendum 3) covers prefs-less-account cleanup + broadcast. Live two-tab rendered proof still gated on §3. |
| Attachments end-to-end (XSalsa20 encrypt → signed URL → decrypt) | BLOCKED | Same two-party envelope. |
| Voice/video call sign-in surface | BLOCKED | Same. |
| "Cream Team" naming | UNVERIFIED (ambiguity) | §4 — awaiting founder clarification. |
| Translation runtime gate OFF | PASS | No code or env change. |
| Dispatch gate OFF | PASS | No code or env change. |
| Migration 349 unapplied | PASS (by omission) | No `scripts/apply-migration-*` invoked this round. |
| Prod `ijvqdvsvwtwxzcqmoqit` untouched | PASS | No prod connection string used; no prod env edited. |
| Hammerex / Rosa / 99901 / 99903 / Vault / encryption untouched | PASS | No modules under `src/lib/nex-native/peer-chat/crypto/**`, no auth module edits, no owner-account mutations. |

---

## 6 · Three-part final verdict

1. **Local implementation (code quality within authorised envelope)**
   — **PASS, pending rerun of fixed harness.** The prefs-less-account
   cleanup fix (Addendum 3) still holds · 22 translation tests green ·
   Azure adapter endpoint-trust + ignored-env diagnostics still in
   place. The historical step_I substring bug is corrected without
   weakening its intent.

2. **Founder walkthrough readiness**
   — **BLOCKED on §3 approval.** Cart/order, chat matrix 5/6/8,
   attachments, and voice/video all need two independent live sessions
   against :3008. Without that, this layer cannot be moved past
   "Wired → Verified".

3. **Public launch readiness**
   — **NOT READY.** Per the 5-state readiness model, ceiling remains
   "Verified" on the fixed sub-surfaces and "Wired" on everything
   gated by §3. "Prod configured" and "Live verified" are owner infra
   calls and cannot be claimed from engineering.

---

## 7 · Final git / server status

```
branch       release-audit-v1-2026-11-14
HEAD         8b47a40e456b74a6a49e86d4be0dbf22f2621a4b
dirty files  130 (unchanged from Addendum 4)
new in tree  evidence/HANDBACK-2026-11-17-CONT3-ADDENDUM-5.md (this file)
edited       scripts/_tmp/cp-cart-journey-r4.mjs (untracked; harness fix)
commits      none (0 this round)
pushes       none (0 this round)
deploys      none (0 this round)
migrations   none applied (0 this round)
:3008        live; founder-owned (PID 21724 bash → PID 7940 node); not disturbed
sandbox DB   kdstoyyeygcopkogqsyv (no writes this round)
prod DB      ijvqdvsvwtwxzcqmoqit (untouched)
```

End · Addendum 5.
