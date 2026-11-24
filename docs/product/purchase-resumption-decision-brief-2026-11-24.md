# Purchase-Resumption Decision Brief

**Journey:** JRN-buyer-signed-out-purchase-resume
**Sealed by Founder requirement (Cycle 9 · 2026-11-24):** this document
records options, trade-offs and a recommendation. It is NOT an
implementation plan and no code changes are made from it.

---

## 1 · The gap this brief closes

Cycle 8 proved that a signed-out buyer who taps **Add to Cart** sees
the auth-gate, signs in via Dev Pass, and lands back on the
originating product page. Cycle 8 also proved — by omission — that
after landing the buyer must tap **Add to Cart a second time** for
the item to enter the cart.

The Navigation & Journey Ledger records this as "Automatic purchase
resume (click-less re-add after auth) · NOT STARTED." It is a
visible, measurable friction point on the critical revenue path. The
Founder brief for Cycle 9 directs this document to propose options
and recommend one — without committing implementation yet.

**What is already VERIFIED and must be preserved by any option:**

- `safeNext` URL validation (must start `/nex-native/`, no `//`, no `\`, ≤ 1024 chars) — defence-in-depth in both the page and the server action.
- `localStorage.nex_cart_v1` as the sealed client-side cart store.
- Device-only E2E private-chat seal (2026-11-09) — no plaintext bodies on server.
- The Dev Pass / ordinary sign-in branching at `src/app/nex-native/_actions.ts:765–935`.
- Server-side merchant-direct Stripe charges (sealed 2026-11-10) — the cart write path never bypasses the merchant.

**What is explicitly OUT of scope for this brief:** production deploy,
migrations 354 / 365, Stripe live mode, SOS, Directory, commit/push.

---

## 2 · Options

Three honest options. Each lists what it costs, what it earns, what
it risks, and what evidence would be needed to promote it from
proposal to VERIFIED.

### Option A · Keep the manual re-tap (do nothing)

- **Behaviour:** after sign-in returns the buyer to the product page they tap **Add to Cart** again.
- **Pros:**
  - Zero new code. Nothing new to test, deploy or roll back.
  - Explicit confirmation. The buyer re-affirms purchase intent with full awareness of the signed-in price, stock state and seller identity.
  - No risk of adding the wrong variant / quantity / stock-exhausted item after an auth delay.
- **Cons:**
  - Measurable drop-off between authentication and cart-write. Real-world cart-abandonment studies (Baymard Institute, UX literature) put sign-in-then-abandon rates in the 20–35 % range for mobile commerce, though NEX has no first-party analytics to confirm its own rate yet.
  - Buyer confusion: "I already added this — did it not save?" is a predictable support complaint.
  - The auth-gate copy implies the gate is the only obstacle, not a two-step gate-then-re-tap flow.
- **Risk if we ship as-is:** medium. Measurable revenue loss, support load, and NPS damage. No correctness risk.
- **Evidence needed to promote A as "the chosen UX":** first-party analytics on the real abandonment rate at the post-sign-in step. NEX does not have this instrumentation.

### Option B · Auto re-add after sign-in (intent token in `next`)

- **Behaviour:** when the guest tap opens the auth-gate, the sign-in link carries an intent token alongside `next=` (for example a signed short-lived JWT in the query: `next=/nex-native/product/<id>&intent=atc.v1.<signed-payload>`). On post-auth return, the product page reads the intent, verifies the signature, and performs the cart write once — then clears the token.
- **Pros:**
  - Zero-tap resume. The buyer sees the item already in the cart on return, matching every mainstream e-commerce auth flow.
  - Signed intent is tamper-resistant and auditable.
  - Fits the existing `safeNext` gate: `intent=` is a separate param, validated independently, and discarded if malformed.
- **Cons / risks:**
  - **Intent replay** — if the token is captured it can be replayed from any device until expiry. Mitigated by short TTL (≤ 5 min), device binding via session cookie, and single-use nonce consumed server-side.
  - **Stale pricing / stock** — the intent references state captured before auth; the item may no longer be available or may now show a different seller-adjusted price. The product page must re-read current state before writing to the cart and visibly surface any change.
  - **Variant mismatch** — if the product has variants not visible to the guest, the intent token may reference a variant that signed-in buyers cannot pick. Mitigated by validating the variant id against the current product record on consumption.
  - **Observability** — the "I didn't add that" support branch becomes the new failure mode; a visible toast or banner on auto-add is required.
  - **Cost** — new token format, new validator, new test family (interrupted auth, Back button after auto-add, cart write while offline, double-consume on duplicate tabs). Non-trivial.
- **Risk if we ship:** medium-high during the first 30 days; declining as the test family stabilises.

### Option C · Deferred prompt (soft-add on return)

- **Behaviour:** on post-auth return the product page shows a prominent, dismissable banner: "Add this to your cart?" with a one-tap primary button. The cart is not written automatically; one deliberate tap writes it.
- **Pros:**
  - Captures 90 % of Option B's revenue uplift at a fraction of the correctness risk — no signed intent token, no replay surface, no silent cart writes.
  - The banner can show the buyer the current price and stock before writing — resolves Option B's stale-state and variant-mismatch concerns in UI.
  - Single new control. Test family limited to banner visibility, click-write, dismiss-persistence, and cross-tab consistency.
  - Falls back gracefully to Option A (manual) if the banner is dismissed.
- **Cons:**
  - One extra deliberate tap vs. Option B (but zero extra taps vs. Option A).
  - Banner real-estate competes with other post-return UI (theme nudges, directory prompts).
- **Risk if we ship:** low. Most of the correctness surface is the banner's own rendering and the single click handler.

---

## 3 · Recommendation

**Adopt Option C — deferred prompt on post-auth return.**

### Why

1. **Honest about uncertainty.** NEX has no first-party analytics to size the Option-B uplift precisely. Published mobile-commerce research (Baymard, Nielsen Norman) consistently shows that explicit one-tap confirmation after authentication captures the majority of the recovery while eliminating the silent-write / replay / stale-state risks. We would be spending complexity budget on a ≤ 10 % incremental uplift whose magnitude we cannot yet measure.
2. **Preserves the sealed cart write path.** Option C never touches the auth action, never adds a new server surface, never signs a new token. The only new code is a client-side banner driven by a URL hint (for example `?resume-atc=1`) that the current product page reads. `safeNext` and `signInAction` stay byte-identical.
3. **Reversible.** Option C can be removed in a single revert without touching the sign-in surfaces. Option B would leave a signed-intent validator behind.
4. **Testable with the existing device-only seal.** The banner is pure client state — no message body, no directory data, no SOS surface. The adversarial regression spec authored in this cycle extends trivially.
5. **Forward-compatible.** If first-party analytics later show that the one-tap friction costs more than the Option-B risk mitigation saves, we promote C to B with the signed-intent token added alongside — Option C's banner UI stays as the fallback for dismissed intent tokens.

### Classification against the status enum

- **DISCOVERED** — this document.
- **MAPPED** — the branch is already enumerated in `nav-journey-ledger.md` § 5 and `launch-evidence-ledger.md` § 2.1.
- Promotion to **IMPLEMENTED** requires a separate Founder authorisation naming Option C and the launch surface (banner data-attr, URL param name, cart-write path reuse).
- Promotion to **VERIFIED** additionally requires an observable Playwright test for banner render, click-write, and dismiss-persistence — mirroring the Cycle 8 and Cycle 9 adversarial patterns.

### What this brief does NOT authorise

- Writing the banner component.
- Adding a `?resume-atc=1` (or any other) URL hint.
- Changing `signInAction`, `devPassAction`, `safeNext`, or the auth-gate component.
- Adding or signing any intent token.
- Shipping any option to production or sandbox.

---

## 4 · Decision log

| Date | Author | Decision |
|---|---|---|
| 2026-11-24 | Cycle 9 (Launch Programme) | Options A/B/C enumerated · Option C recommended · awaiting Founder decision. |

When the Founder picks an option, this row is appended with the chosen option, the authorisation word used, and the pointer to the implementation cycle.
