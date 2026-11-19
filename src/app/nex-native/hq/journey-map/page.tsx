// src/app/nex-native/hq/journey-map/page.tsx
//
// Journey Map · prompt-7 2026-11-18
// ---------------------------------------------------------------------
// Owner-authorised 2026-11-18 (prompt-7 continuation). This page is the
// HQ-visible companion to §16 of the Reconciliation Ledger · it maps
// the nine user-journey lanes (A–I) that make up the NEX product so
// admins can see at a glance which journeys are implementation-
// complete, which are founder-walkthrough-ready, and which remain
// blocked on an external prerequisite (disposable inbox, provider
// capability, owner product decision).
//
// Access control:
//   The page inherits `src/app/nex-native/hq/layout.tsx` which:
//     · requires ≥ 900 px viewport (shows a plain desktop-only
//       message otherwise)
//     · wraps the subtree in <SectionBoundary section="hq"> so a
//       render failure here NEVER takes down /chat or /shop
//     · sets the shared emerald HQ palette
//   It is NOT a public page · HQ admin grant (migration 213) is
//   enforced upstream by the existing HQ middleware/tests. This file
//   does not read, mutate, or expose any user-identifying data
//   (handles, emails, device fingerprints, chat bodies, products).
//
// Evidence discipline (sealed 2026-11-18 by owner · extended 2026-11-19):
//   Every row carries an evidence tier — SOURCE_INSPECTED / UNIT /
//   OFFLINE_TESTED / BROWSER / PERSISTED / PROVIDER / PHYSICAL_DEVICE.
//
//   Evidence-tier rules (owner-sealed 2026-11-19 prompt-7 continuation):
//     · SOURCE_INSPECTED = conclusion from reading the file in this
//       repo at this HEAD; does NOT mean the file ran.
//     · UNIT = a unit test file exists for the module.
//     · OFFLINE_TESTED = a NAMED test suite ACTUALLY RAN in this
//       session with no network/DB dependency and the outcome is
//       captured in the ledger. Different from UNIT (existence of a
//       test file ≠ a successful run here).
//     · BROWSER / PERSISTED / PROVIDER / PHYSICAL_DEVICE are higher
//       tiers requiring external observation and are NOT producible
//       from engineering alone.
//
//   A journey is NEVER marked VERIFIED on the strength of a passing
//   unit test alone; the ledger rule is that engineering can claim a
//   ceiling of VERIFIED, never LIVE VERIFIED. Rows link back to the
//   authoritative ledger anchor.
//
//   The legacy label SOURCE (undated · 2026-11-18 rows) is preserved
//   so old entries render. New 2026-11-19 entries SHOULD prefer
//   SOURCE_INSPECTED so the stronger / weaker claim is explicit.
//
// Diagram discipline:
//   The text diagram below is deliberately NOT a Mermaid render (no
//   live client-side JS, no third-party CDN). It is a pre-formatted
//   text block so the page is cacheable, printable, and doesn't
//   introduce any new provider dependency for HQ admins.

import type * as React from "react";
import Link from "next/link";

// ─── Palette (matches _hq-nav.tsx) ───────────────────────────────────

const INK = "#F2F5F8";
const INK_DIM = "#B5C3D6";
const INK_MUTED = "#7D9BC0";
const SURFACE = "#071A12";
const ACCENT = "#16D66B";
const BORDER = "rgba(22,214,107,0.18)";
const BORDER_HI = "rgba(22,214,107,0.48)";

// ─── Status tokens ───────────────────────────────────────────────────

type Status =
  | "PASS"
  | "PARTIAL"
  | "BLOCKED"
  | "UNVERIFIED"
  | "FAIL"
  | "HELD";

type Evidence =
  | "SOURCE"
  | "SOURCE_INSPECTED"
  | "UNIT"
  | "OFFLINE_TESTED"
  | "BROWSER"
  | "PERSISTED"
  | "PROVIDER"
  | "PHYSICAL_DEVICE";

interface JourneyRow {
  readonly lane: string;
  readonly role: "guest" | "buyer" | "seller" | "admin" | "all";
  readonly summary: string;
  readonly entry: string;
  readonly connected: readonly string[];
  readonly data: string;
  readonly status: Status;
  readonly evidence: readonly Evidence[];
  readonly blocker: string;
  readonly ledgerAnchor: string;
}

const LEDGER_PATH = "/evidence/master-flow/RECONCILIATION-LEDGER-2026-11-18.md";

// ─── Shared Live-Auth Verification Gate (§16.23 · 2026-11-19 r4) ─────
//
// One gate reference that every lane needing authenticated-session
// evidence points to. Replaces the repetitive "blocked at A (same
// disposable gate)" language that lanes A/C/E/I previously carried
// independently. Clearing this gate does NOT automatically clear any
// downstream journey — lanes C/E/I retain their own
// BROWSER/PERSISTENCE/PROVIDER/DEVICE evidence requirements, listed in
// each lane's blocker field.
//
// The gate has two independent verification branches (email + Google)
// that can clear separately. Email and Google are NOT substitutes for
// each other for verification purposes — a passing email live check
// does NOT prove the Google journey, and vice versa.

interface AuthGateBranch {
  readonly name: "Email branch" | "Google branch";
  readonly sourceOfflineStatus: string;
  readonly operatorPrerequisites: readonly string[];
  readonly outstandingLiveChecks: readonly string[];
}

const SHARED_AUTH_GATE_ID = "shared-live-auth-gate";

const SHARED_AUTH_GATE_SHARED_PREREQS: readonly string[] = [
  "Rotate any credentials previously exposed in tool output (prior " +
    "session's .env.local read exposed a DB password). Status " +
    "2026-11-19 r7: rotation ran (round 6) · the authorised " +
    "sandbox-only SELECT-1 credential check " +
    "(scripts/verify-pg-password-sandbox.mjs) ran and FAILED with " +
    "sanitised category auth_failed_password (SQLSTATE 28P01). " +
    "target_classification = sandbox on both DATABASE_URL + " +
    "NEX_POSTGRES_URL against ref kdstoyyeygcopkogqsyv, so the " +
    "failure is a password-mismatch, NOT a target-mismatch. Live " +
    "work is stopped per the authorising prompt. The two commented " +
    "hex strings from the original exposure remain UNKNOWN-type and " +
    "still require rotation. Next operator action: re-run the " +
    "rotation with the Supabase-project-correct password through the " +
    "operator's secure workflow, then re-authorise this narrow " +
    "SELECT-1 check. Do NOT print values into source, tests, chat or " +
    "evidence files.",
  "Reconcile three targets before any backend access: (a) the " +
    "AUTHORISED Supabase project (per CLAUDE.md §8 = " +
    "ijvqdvsvwtwxzcqmoqit for production), (b) the CONFIGURED project " +
    "in .env.local on disk (currently sandbox per 2026-11-12 memory), " +
    "(c) the running :3008 process's LOADED project (snapshotted at " +
    "boot; UNKNOWN from this workstation until an operator-trusted " +
    "diagnostic or controlled restart confirms). All three MUST agree " +
    "with the test intent before any live sign-in is attempted.",
  "Obtain explicit, separately-worded owner authorisation to resume " +
    "database/backend testing. The DB pause (2026-11-19) remains in " +
    "force; this reconciliation session does not lift it.",
];

const SHARED_AUTH_GATE_BRANCHES: readonly AuthGateBranch[] = [
  {
    name: "Email branch",
    sourceOfflineStatus:
      "SOURCE/OFFLINE COMPLETE. createNexAccountAction, signInAction, " +
      "prelaunch server-side guard, sign-in page UI, and the three-" +
      "layer enforcement (allowlist + server guard + UI suppression) " +
      "are source-reviewed. Four prelaunch offline-test files passed " +
      "in prior sessions (allowlist / feature-flag / email-normalise / " +
      "signup-service · 39 tests). These are SOURCE_INSPECTED + " +
      "OFFLINE_TESTED tiers only — they do NOT prove the live journey.",
    operatorPrerequisites: [
      "Confirm an email-receiving address or approved test-inbox the " +
        "operator will use for verification-link retrieval. Prior " +
        "memory (§16.18.4) establishes NEX_DEV_IMPERSONATE_HANDLE is " +
        "read-only and NOT suitable as a signup target. The 2026-11-19 " +
        "prompt-7 continuation named an operator-approved inbox but " +
        "DB operations were PAUSED before the e2e ran. Any live test " +
        "requires the owner to re-name (or re-confirm) that inbox.",
      "Confirm NEX_PRELAUNCH_MODE flag intent for the test (OFF for " +
        "normal signup e2e; ON for prelaunch-gate enforcement e2e).",
    ],
    outstandingLiveChecks: [
      "Signup form submission writes a valid auth.users + nex_account " +
        "row pair against the reconciled Supabase target.",
      "Confirmation email is delivered to the approved inbox and the " +
        "confirm link lands on /nex-native/auth/confirm with cookies " +
        "set.",
      "Sign-in with correct password produces an active nex_session " +
        "row (single-session enforcement, mig 348).",
      "Sign-in with wrong password surfaces the honest banner and " +
        "writes NO session row.",
      "Session restoration after browser reload preserves the signed-" +
        "in UID without re-prompt.",
      "Sign-out clears both Supabase cookies and the nex_session row " +
        "and returns the user to /nex-native/sign-in.",
      "Prelaunch gate denial: non-founder signup during flag-ON is " +
        "redirected to /nexcorner BEFORE any auth.users row is written.",
      "Founder re-entry: a signed-out founder authenticating through " +
        "/nex-native/sign-in during prelaunch reaches the authenticated " +
        "landing.",
    ],
  },
  {
    name: "Google branch",
    sourceOfflineStatus:
      "SOURCE/OFFLINE COMPLETE (Round 3 · 2026-11-19 r3). " +
      "continueWithGoogleAction, /nex-native/auth/callback route handler " +
      "and the pure decideCallbackOutcome/sanitiseOAuthReturnPath/" +
      "buildGoogleOAuthRedirectUrl/decideSignOutRedirect helpers are " +
      "source-reviewed. 18/18 pure-decision tests passed in this " +
      "session's prior turn (redirect-sanitising, exchange-success, " +
      "provider-cancellation, provider-error, exchange-failure, " +
      "new/returning routing, prelaunch gate denial for non-founder, " +
      "founder allow, unsafe-linking refusal, sign-out). Allowlist " +
      "defence-in-depth: /nex-native/auth/callback and /auth/confirm " +
      "are the only /auth/* paths reachable anonymously; the negative " +
      "test proves arbitrary /auth/* remains 302'd. SOURCE_INSPECTED + " +
      "OFFLINE_TESTED tiers only.",
    operatorPrerequisites: [
      "Enable the Google provider in the authorised Supabase project " +
        "under Authentication → Providers → Google.",
      "Configure the Google OAuth client ID and secret in the Supabase " +
        "provider panel. Both values come from Google Cloud Console; " +
        "handle them through the operator's secret workflow and do NOT " +
        "print them into any source, test, chat or evidence file.",
      "In Google Cloud Console → OAuth client configuration, register " +
        "the Supabase project's exact callback URL (shape: " +
        "https://<supabase-project-ref>.supabase.co/auth/v1/callback) " +
        "as an authorised redirect URL.",
      "Confirm the app-side redirect config: continueWithGoogleAction " +
        "builds redirectTo = <origin>/nex-native/auth/callback[?next=…] " +
        "from the inbound request headers. The <origin> of the live " +
        "deployment (apex vs *.vercel.app) must match the URLs the " +
        "operator has authorised in both Supabase and Google Cloud.",
      "Confirm NEXT_PUBLIC_NEX_SUPABASE_URL and the service-role key " +
        "in the running environment both resolve to the same project " +
        "ref whose provider was enabled.",
    ],
    outstandingLiveChecks: [
      "'Continue with Google' button on sign-in opens the Google " +
        "consent screen and does NOT render the oauth_unavailable " +
        "banner.",
      "Consent granted + code returned: exchangeCodeForSession " +
        "succeeds, cookies are set, the user is routed to " +
        "/nex-native/welcome (new) or next || /nex-native/contacts " +
        "(returning). Session restoration after reload preserves " +
        "the identity.",
      "Consent cancelled (error=access_denied): user lands on " +
        "/nex-native/sign-in?e=oauth_cancelled with the honest banner, " +
        "no session cookies are left behind.",
      "Provider error (error=server_error or similar): user lands on " +
        "/nex-native/sign-in?e=oauth_provider_error with the exact " +
        "error_description surfaced, no session cookies leak.",
      "Prelaunch gate denial: a non-founder Google identity triggers " +
        "the in-handler signOut() and 303 to /nexcorner — verify the " +
        "cookies set by exchange are actually cleared before the " +
        "redirect lands (measure with browser devtools).",
      "Founder allow: a founder-UID Google identity completes the " +
        "callback without signOut and reaches /nex-native/welcome or " +
        "a sanitised next path.",
      "Safe linking: a Google email that collides with an existing " +
        "unlinked password nex_account does NOT auto-merge — verify by " +
        "observing Supabase's own exchange-error behaviour rather than " +
        "the client-side collision flag (which we deliberately leave " +
        "false; see ledger §16.22.5).",
      "Sign-out from a Google-authenticated session clears cookies and " +
        "returns to the normal gate (not a provider-specific exit).",
    ],
  },
];

const SHARED_AUTH_GATE_DEPENDENT_LANES: readonly string[] = [
  "Lane A · direct host · OFFLINE COMPLETE · LIVE BLOCKED",
  "Lane C · downstream · session needed for seller 4-step browser proof",
  "Lane E · downstream · session needed for buyer + seller cart/order proof",
  "Lane I · downstream · session needed for account-deletion browser proof",
];

// ─── Proven Green Flow Registry (§16.24 · 2026-11-19 r5) ─────────────
//
// Slot for lanes that have cleared live BROWSER + PERSISTED + PROVIDER /
// PHYSICAL_DEVICE evidence under the discipline of §16.20.2. The
// registry is EMPTY at 2026-11-19 r5 — no lane has produced a live
// run in this session or a prior session that would satisfy the
// rubric. Rubric + capture shape are pre-filled per lane so that
// whichever operator runs the live check knows in advance what to
// screenshot, which rows to inspect, and which cookies / session
// state to confirm.
//
// Engineering ceiling is VERIFIED; only the owner can elevate a lane
// to LIVE VERIFIED. A passing offline test NEVER promotes a lane into
// this registry.

interface GreenFlowRubric {
  readonly lane: string;
  readonly requiredTiers: readonly Evidence[];
  readonly screenshots: readonly string[];
  readonly dbRows: readonly string[];
  readonly cookiesAndSessionState: readonly string[];
  readonly entryState: "EMPTY (no live run · rubric pre-filled)";
}

const GREEN_FLOW_REGISTRY_ID = "proven-green-flow-registry";

const GREEN_FLOW_REGISTRY: readonly GreenFlowRubric[] = [
  {
    lane:
      "A · Signup + session (email + Google sub-journeys · depends on shared gate)",
    requiredTiers: ["BROWSER", "PERSISTED", "PROVIDER"],
    screenshots: [
      "Email signup form filled with the operator-approved inbox + " +
        "post-submit landing on /nex-native/welcome.",
      "Confirmation email in the approved inbox + confirm-link landing " +
        "on /nex-native/auth/confirm with signed-in UI state.",
      "Sign-in with correct password → authenticated landing. Sign-in " +
        "with wrong password → honest banner with no session cookies " +
        "set.",
      "Sign-out → /nex-native/sign-in with Supabase cookies cleared.",
      "'Continue with Google' → Google consent screen (no " +
        "oauth_unavailable banner).",
      "Google consent granted → /nex-native/welcome (new) or " +
        "next || /nex-native/contacts (returning).",
      "Google consent cancelled → /nex-native/sign-in?e=oauth_cancelled " +
        "with no session cookies left behind.",
      "Prelaunch gate denial on a non-founder Google identity → 303 to " +
        "/nexcorner with cookies cleared BEFORE the redirect lands " +
        "(verify in devtools Application → Cookies).",
    ],
    dbRows: [
      "auth.users row exists for the test email after confirm.",
      "nex_account row exists keyed to the auth UID with expected " +
        "display_name + phone_country_code + locale fields.",
      "nex_session row exists for the current cookie pair; a second " +
        "sign-in supersedes it (single-session enforcement, mig 348).",
      "Cancelled or errored Google attempts write NO auth.users and " +
        "NO nex_account rows.",
    ],
    cookiesAndSessionState: [
      "sb-<ref>-auth-token cookie present after signup confirm, sign-in " +
        "and Google exchange.",
      "Cookies cleared after sign-out and after the in-handler " +
        "signOut() on non-founder Google callback (verify BEFORE the " +
        "303 to /nexcorner lands).",
      "Session restoration after full browser reload preserves the " +
        "signed-in UID with no re-prompt.",
    ],
    entryState: "EMPTY (no live run · rubric pre-filled)",
  },
  {
    lane: "B · Guest storefront / /nexcorner prelaunch surface",
    requiredTiers: ["BROWSER", "PERSISTED", "PROVIDER"],
    screenshots: [
      "/nexcorner form submission success state on mobile + desktop.",
      "Duplicate submit returns the dedupe envelope (not a second " +
        "silent save).",
      "Invalid email returns a validation envelope with no row written.",
      "Operator-side Resend delivery of the launch-interest " +
        "notification to NEX_PRELAUNCH_NOTIFY_TO (not a mock).",
      "Flag ON: an unauthenticated GET /nex-native/<any-non-" +
        "allowlisted> returns 302 → /nexcorner.",
    ],
    dbRows: [
      "nex_prelaunch_signup row exists AFTER migration 352 is applied " +
        "against the reconciled Supabase target; absent-migration " +
        "envelope returns reason='migration_not_applied' before apply.",
      "Row fields (email_normalised, source, created_at) match input.",
      "Repeat submit does not duplicate — unique-on-email constraint " +
        "or service-level dedupe produces a single row.",
    ],
    cookiesAndSessionState: [
      "No auth cookies written by /nexcorner submit.",
      "ShopDrawer interaction on /nex-native/free-chat opens the " +
        "GuestCreateAccountContainer path and renders NO real product " +
        "names.",
    ],
    entryState: "EMPTY (no live run · rubric pre-filled)",
  },
  {
    lane: "C · Shop setup",
    requiredTiers: ["BROWSER", "PERSISTED"],
    screenshots: [
      "Business-details → appearance → first-product → review 4-screen " +
        "dispatcher walkthrough (corrected §16.27 · the legacy identity/" +
        "location/contact ladder is NOT the live flow).",
      "Browser reload mid-flow routes back through the dispatcher to the " +
        "next incomplete step (no browser-local draft · the nex_business " +
        "row IS the draft).",
      "Completed state after 'Open your shop' CTA on the review step.",
    ],
    dbRows: [
      "nex_business row keyed to owner_account_id with display_name, " +
        "logo_url, country/city/address, business_category, subtype, " +
        "shop_cover_image_url all populated by the time the dispatcher " +
        "resolves to the review step.",
      "No separate draft table / draft JSONB · incomplete state lives " +
        "as NULL columns on the single nex_business row.",
      "Owner-scoped update verified from source: " +
        "business-details/_actions.ts gates businessId via " +
        "requireBusiness() AND round-11 (2026-11-19) added a " +
        "service-layer owner_account_id scope to " +
        "business-service.updateBusinessProfile — the UPDATE issues " +
        ".eq('id', id).eq('owner_account_id', ownerAccountId) and " +
        "throws owner-mismatch on zero rows. 3 OFFLINE_TEST assertions " +
        "in src/lib/nex-native/__tests__/update-business-profile-" +
        "owner-scope.test.ts cover O1 missing-identity, O2 happy-path " +
        "filters, O3 zero-row refusal (Lane C C-1 CLOSED at SOURCE " +
        "+ OFFLINE_TEST tiers · RLS verification is a separate live tier).",
      "Lane C C-3 (safe error fall-through) CLOSED at SOURCE + " +
        "OFFLINE_TEST: errorCopy default now returns stable copy and " +
        "console.warns the raw code · 4 tests in business-details/" +
        "__tests__/error-copy-safe-fallthrough.test.ts prove known " +
        "codes map, unknown codes never echo raw, empty short-circuits, " +
        "+ structural guard on _client.tsx.",
      "Lane C C-2 (persisted setup-step idempotency) BLOCKED at " +
        "SOURCE tier · root cause: provisionDefaultBusiness relies on " +
        "a tier-count SELECT inside assertCanCreateBusiness which is " +
        "not race-safe (two concurrent tabs both see count=0 → both " +
        "insert → owner gets 2 nex_business rows under Gratis tier). " +
        "Precise schema dependency: either (a) a partial unique index " +
        "on nex_business(owner_account_id) scoped to Gratis tier, or " +
        "(b) a SECURITY DEFINER RPC wrapping assertCanCreateBusiness + " +
        "insert in a SERIALIZABLE tx, or (c) a pg_advisory_xact_lock " +
        "on hashtext(owner_account_id). All three require a migration · " +
        "none is authorised in round 11 (no schema change allowed). " +
        "Reported BLOCKED with the above options for owner review.",
    ],
    cookiesAndSessionState: [
      "Authenticated nex_session throughout (shared gate must have " +
        "cleared first).",
      "Unauthenticated GET /nex-native/manage/shop/setup/* redirects " +
        "to /nex-native/sign-in?next=… without exposing partial form " +
        "state.",
    ],
    entryState: "EMPTY (no live run · rubric pre-filled · route labels " +
      "corrected 2026-11-19 r6 · C-1/C-3 closed, C-2 BLOCKED on schema " +
      "· round 11 2026-11-19)",
  },
  {
    lane: "D · Chat (peer, encrypted)",
    requiredTiers: ["BROWSER", "PERSISTED"],
    screenshots: [
      "Two-account chat thread exchanging an encrypted message bubble.",
      "Full browser reload preserves the ciphertext bubble.",
      "Any attempted plaintext-fallback write surfaces an honest error " +
        "(not a silent success).",
    ],
    dbRows: [
      "nex_peer_message row with non-empty ciphertext column.",
      "attachment_meta carries NO plaintext snapshot.",
      "No FREEZE-guard-bypassed rows exist for the test thread.",
    ],
    cookiesAndSessionState: [
      "Both accounts have independent nex_session rows with no " +
        "cross-session cookie leakage.",
      "Vault lock does not strand chat decryption keys — chat remains " +
        "readable after vault lock on an unrelated route.",
    ],
    entryState: "EMPTY (no live run · rubric pre-filled)",
  },
  {
    lane: "E · Cart + orders",
    requiredTiers: ["BROWSER", "PERSISTED"],
    screenshots: [
      "Cart build + send-to-seller confirm from buyer side.",
      "Seller /nex-native/manage/orders list entry appearing.",
      "Order detail page at /nex-native/manage/orders/[orderId].",
    ],
    dbRows: [
      "nex_peer_message with attachment_meta.cart snapshot. HONESTY " +
        "NOTE (§16.27 · 2026-11-19 r6): the snapshot is currently " +
        "stored as PLAINTEXT JSONB (server-readable) · the 2026-11-09 " +
        "sealed Phase 2 doctrine owes Path A separation to remove " +
        "plaintext product/menu/order and delivery_address PII from " +
        "attachment_meta. The 'encrypted envelope' phrasing applies " +
        "to the chat ciphertext column, NOT the cart snapshot.",
      "nex_order row with customer_account_id (buyer), business_id " +
        "(seller), product_id (representative-product rule · first " +
        "kind='product' item), state='created' (unpaid semantics), " +
        "price_pence + currency from server records; row contents " +
        "match cart payload field-for-field after live run.",
      "Idempotency assertion (§16.27): submit the SAME send_intent_id " +
        "twice (simulated double-tap via two FormData submissions) · " +
        "live run must show exactly ONE nex_peer_message row AND " +
        "exactly ONE nex_order row (both deduped by send_intent_id · " +
        "message via Migration 102 UNIQUE index · order via the new " +
        "idempotency_key column).",
      "Round 11 cross-retry linkage (2026-11-19): futureOrderId is " +
        "now derived from sendIntentId when the client supplied a " +
        "valid UUID (_actions.ts:3397). This closes the drift where " +
        "a buyer retry would mint a different order id than the one " +
        "stamped into attachment_meta.cart.order_id · after the fix, " +
        "retry and double-tap both converge on the SAME UUID so the " +
        "snapshot's order_id always points at the canonical nex_order " +
        "row. Regression: send-cart-order-idempotency.test.ts T1 now " +
        "asserts createOrderArg.id === VALID_INTENT_ID (supersedes " +
        "the 2026-11-16 'distinct random UUID' convention for " +
        "intent-carrying sends). 42/42 cart-order regressions green.",
      "Partial-failure semantics (round 11 analysis): current fail-" +
        "soft at _actions.ts:3667 preserves the chat message when " +
        "nex_order insert fails · buyer redirect still shows " +
        "cart_sent=1 (true for the message layer). Buyer retry with " +
        "same send_intent_id now deterministically targets the same " +
        "order id · createOrder's idempotency path then either " +
        "creates the missing row (if previous insert never persisted) " +
        "or returns the canonical row (if it did). No code change " +
        "beyond the futureOrderId derivation · the sealed Path A " +
        "doctrine keeps the message path independent.",
    ],
    cookiesAndSessionState: [
      "Buyer and seller sessions are distinct; buyer order write " +
        "authored by buyer UID.",
      "Unauthenticated GET /nex-native/manage/orders redirects to " +
        "/nex-native/sign-in (seller surface requires seller session).",
    ],
    entryState: "EMPTY (no live run · rubric pre-filled · cross-retry " +
      "linkage CLOSED at SOURCE + OFFLINE_TEST round 11 2026-11-19)",
  },
  {
    lane: "F · Delivery quote + radius",
    requiredTiers: ["BROWSER", "PERSISTED"],
    screenshots: [
      "In-range quote display inside cart.",
      "Out-of-range refusal honest banner.",
      "Tampered-payload refusal honest banner (modify quote client-side " +
        "then submit — server must reject).",
    ],
    dbRows: [
      "nex_business.location_lat/lng + nex_product.spec.__delivery " +
        "read-back matches the quote displayed.",
      "Server-recomputed quote matches client-displayed quote " +
        "(isSubmittedLocalQuoteAuthentic returns true in the trace).",
    ],
    cookiesAndSessionState: [
      "Buyer session active during quote verify.",
      "No seller session required for buyer-side quote display.",
    ],
    entryState: "EMPTY (no live run · rubric pre-filled)",
  },
  {
    lane: "G · Calls (invite/response/ended)",
    requiredTiers: ["BROWSER", "PERSISTED", "PROVIDER"],
    screenshots: [
      "Caller preview send on /nex-native/call/preview.",
      "Invitee ring surface + accept flow.",
      "Session-ended state.",
      "Chat bubble on /nex-native/chat/peer/[accountId] showing the " +
        "call_invite attachment.",
    ],
    dbRows: [
      "nex_call_session row created for the invite.",
      "nex_peer_message row with attachment_type='call_invite' written " +
        "via sendPeerMessage (post-§16.19 routing), NOT via the direct " +
        "admin insert at invite-service.ts:317-335.",
    ],
    cookiesAndSessionState: [
      "Both accounts' nex_session active throughout.",
      "TURN relay credentials never surface to client-side source / " +
        "devtools / console.",
    ],
    entryState: "EMPTY (no live run · rubric pre-filled)",
  },
  {
    lane: "H · Vault (idle + hidden lock)",
    requiredTiers: ["BROWSER", "PHYSICAL_DEVICE"],
    screenshots: [
      "Unlocked vault route.",
      "Automatic lock after 5 min of idle.",
      "Automatic lock after 1 min of hidden-tab state (switch tabs, " +
        "wait, switch back).",
      "Cross-tab unlock propagation (two vault tabs; unlock in one, " +
        "second tab reflects without re-prompt).",
    ],
    dbRows: [
      "No server-side VMK row expected (in-memory only).",
      "Any nex_vault_* rows contain only ciphertext or metadata, never " +
        "plaintext key material.",
    ],
    cookiesAndSessionState: [
      "VMK lives in memory only — verify via devtools that no " +
        "localStorage / sessionStorage / cookie carries the key or any " +
        "derived plaintext between lock events.",
      "Blob URLs for decrypted attachments are revoked on lock.",
    ],
    entryState: "EMPTY (no live run · rubric pre-filled)",
  },
  {
    lane: "I · Account deletion",
    requiredTiers: ["BROWSER", "PERSISTED", "PROVIDER"],
    screenshots: [
      "6-step destructive workflow on /nex-native/settings/security/" +
        "delete-account.",
      "Final irreversible-confirm step.",
      "Post-delete sign-out landing.",
      "Subsequent sign-in attempt with the deleted email → honest " +
        "denied banner.",
    ],
    dbRows: [
      "nex_account deletion-marker (per nex_account_mark_deleted RPC) " +
        "written for the test account.",
      "nex_security_audit_erase_actor row written for the actor.",
      "auth.users row removed (auth.admin.deleteUser evidence).",
      "session_revoke_all 3/hour quota increment visible in its " +
        "rate-limit tracker.",
      "MUST NEVER be exercised against Hammerex nex-99901 or Rosa " +
        "nex-99903 — use a disposable test account that was NEWLY " +
        "created inside the same session.",
    ],
    cookiesAndSessionState: [
      "Server-side session invalidated; cookies cleared client-side.",
      "A deleted account cannot be signed back in; a Google re-attempt " +
        "with the same email does NOT auto-revive the row.",
    ],
    entryState: "EMPTY (no live run · rubric pre-filled)",
  },
];

// ─── Journey data · rendered server-side ─────────────────────────────

const JOURNEYS: readonly JourneyRow[] = [
  {
    lane: "A · Signup + session (incl. prelaunch gate sub-journeys)",
    role: "guest",
    summary:
      "Guest lands on root, chooses signup, submits form, gets session. " +
      "2026-11-19 extension: the prelaunch gate wraps this lane with " +
      "email-signup / email-verification / password-sign-in / Google-OAuth " +
      "/ founder-re-entry sub-journeys — none of which are confirmable " +
      "from engineering alone.",
    entry: "/ → /nex-native/{welcome | sign-in | home}",
    connected: [
      "/nex-native/sign-in (createNexAccountAction, signInAction, continueWithGoogleAction)",
      "supabase.auth.signUp · no emailRedirectTo passed (confirm URL set in Supabase project · operator surface)",
      "supabase.auth.signInWithPassword · nexAppSsrServerClient",
      "cookie nex_session · claimSingleSession (nex_session table)",
      "OAuth / Google · WIRED locally 2026-11-19 r3 · continueWithGoogleAction (src/app/nex-native/_actions.ts) → supabase.auth.signInWithOAuth({provider:'google', redirectTo:/nex-native/auth/callback}) → /nex-native/auth/callback/route.ts (GET) → supabase.auth.exchangeCodeForSession → decideCallbackOutcome (src/lib/nex-native/auth/google-oauth.ts, pure) → redirect | signout_then_redirect | error_banner. Provider enablement + client-id + authorised-redirect-URL still OPERATOR-SIDE (BLOCKED/UNVERIFIED).",
      "middleware.ts:96-121 readAuthedNexUidOrNull · founder bypass via NEX_PRELAUNCH_FOUNDER_UIDS",
    ],
    data: "auth.users · nex_account · nex_session (single-session enforcement, mig 348)",
    status: "BLOCKED",
    evidence: ["SOURCE_INSPECTED", "OFFLINE_TESTED"],
    blocker:
      "SOURCE/OFFLINE COMPLETE · LIVE BLOCKED. Lane A is the direct " +
      "host of the Shared Live-Auth Verification Gate (see dedicated " +
      "section below). Source engineering + offline tests for email " +
      "signup, email sign-in, Google OAuth code-exchange outcome, " +
      "founder re-entry (owner-sealed 2026-11-19 r2) and sign-out are " +
      "complete; see shared gate for exact branches + operator " +
      "prerequisites + outstanding live checks. Lane A owns no " +
      "additional browser/persistence/provider/device checks beyond " +
      "those enumerated by the shared gate. Clearing the shared gate " +
      "does NOT automatically clear Lanes C/E/I — each retains its " +
      "own downstream evidence requirements.",
    ledgerAnchor: "#1621",
  },
  {
    lane: "B · Guest storefront / shop drawer + /nexcorner prelaunch surface",
    role: "guest",
    summary:
      "Guest opens drawer from /free-chat; sees signup CTA, never real " +
      "product names. 2026-11-19 extension: /nexcorner is the public " +
      "prelaunch surface and the sole 302-target when NEX_PRELAUNCH_MODE " +
      "is on. Launch-interest form is a real server action gated by " +
      "feature flag + in-process rate limiter + migration-missing fallback.",
    entry:
      "/nex-native/free-chat (FAB → ShopDrawer) · /nexcorner (prelaunch surface)",
    connected: [
      "GuestCreateAccountContainer",
      "/nex-native/sign-in?mode=signup",
      "/nexcorner · src/app/nexcorner/page.tsx (RSC, force-dynamic, nodejs runtime)",
      "notifyAtLaunchAction · src/app/nexcorner/_actions.ts",
      "recordPrelaunchSignup · src/lib/nex-native/prelaunch/signup-service.ts",
      "POST /api/nex-native/prelaunch/notify (duplicate non-RSC endpoint)",
      "sendLaunchInterestNotification · src/lib/nex-native/prelaunch/launch-interest-notifier.ts (fire-and-forget operator notifier, recipient = NEX_PRELAUNCH_NOTIFY_TO server-side env, Resend adapter, never throws · delivery outcome MUST NOT alter saved envelope)",
      "Allowlist: src/lib/nex-native/prelaunch/allowlist.ts (exactPaths: /, /nexcorner, /nex-generated/buying-guides, /nex-native/privacy, /nex-native/terms, /nex-native/sign-in [+ /forgot, /new-password] · exactApis: /api/nex-native/prelaunch/notify)",
    ],
    data:
      "none for guest storefront · nex_prelaunch_signup (migration 352 · " +
      "PROPOSAL, not applied · absent table returns envelope reason=" +
      "`migration_not_applied` via Postgres error 42P01)",
    status: "PASS",
    evidence: ["SOURCE_INSPECTED", "UNIT", "OFFLINE_TESTED"],
    blocker:
      "Prelaunch surface is engineering-complete AT SOURCE LEVEL. Four " +
      "offline test files ran successfully in this session (see §16.20): " +
      "allowlist.test.ts · feature-flag.test.ts · email-normalise.test.ts " +
      "· signup-service.test.ts (39 tests / 4 files / 377 ms / no I/O). " +
      "Unverified from engineering: (a) the live Vercel environment " +
      "actually has NEX_PRELAUNCH_MODE=true (operator surface); " +
      "(b) migration 352 applied against the authoritative Supabase " +
      "project (owner-gated — currently PROPOSAL only); " +
      "(c) any apex-domain rewrite from nexcorner.com → /nexcorner · " +
      "next.config.mjs inspected and carries NO such rewrite (apex " +
      "routing is a Vercel/DNS concern outside the code).",
    ledgerAnchor: "#1619",
  },
  {
    lane: "C · Shop setup",
    role: "seller",
    summary:
      "Seller completes business-details → appearance → first-product → " +
      "review (dispatcher pattern · §16.27).",
    entry: "/nex-native/manage/shop/setup",
    connected: [
      "/nex-native/manage/shop/setup (dispatcher · page.tsx:52-87)",
      "/nex-native/manage/shop/setup/business-details (step 1 · name + " +
        "logo + country + city + address + category + subtype)",
      "/nex-native/manage/shop/setup/appearance (step 2 · routes out to " +
        "/manage/shop/themes + /manage/shop/backgrounds · no setup write)",
      "/nex-native/manage/shop/setup/first-product (step 3 · routes out " +
        "to /create/product/category · no setup write)",
      "/nex-native/manage/shop/setup/review (step 4 · read-only summary " +
        "+ 'Open your shop' CTA · no server action)",
    ],
    data:
      "nex_business (one row per owner_account_id · Gratis tier · the " +
      "row IS the draft · no separate draft store · completion computed " +
      "from NULL columns per dispatcher)",
    status: "UNVERIFIED",
    evidence: ["SOURCE", "UNIT"],
    blocker:
      "SOURCE RECONCILED 2026-11-19 r6 (§16.27): HQ's earlier identity/" +
      "location/contact bullets were out of date · the live flow is the " +
      "4-step dispatcher above. The legacy identity/location/category/" +
      "hours/story/policies/contact/finish routes still exist as deep-" +
      "link editors from /manage/shop but are NOT the setup ladder. " +
      "Session evidence (buyer not applicable · seller only) gated by " +
      "the Shared Live-Auth Verification Gate · email branch applies. " +
      "LANE-SPECIFIC outstanding: end-to-end 4-step completion through " +
      "the dispatcher · nex_business row persistence on each save · " +
      "re-hydration on reload · owner-scoped update (service-layer " +
      "updateBusinessProfile has no owner_account_id gate · action-" +
      "layer requireBusiness() is the current gate · noted in §16.27) · " +
      "all remain BROWSER/PERSISTENCE tier UNVERIFIED after the shared " +
      "gate clears. UNIT already covers keypad wiring (15 tests PASS).",
    ledgerAnchor: "#161",
  },
  {
    lane: "D · Chat (peer, encrypted)",
    role: "buyer",
    summary:
      "Two signed-in users exchange encrypted messages; reload persists " +
      "ciphertext; FREEZE guard refuses any plaintext-fallback write.",
    entry: "/nex-native/chat/peer/[accountId]",
    connected: [
      "sendEncryptedPeerMessages (crypto/encrypted-send.ts)",
      "sendPeerMessage (peer-message-service.ts)",
      "sendGenericNotice (code-owned templates)",
    ],
    data: "nex_peer_message (ciphertext + attachment_meta)",
    status: "HELD",
    evidence: ["SOURCE", "UNIT"],
    blocker:
      "FREEZE guard code + 13 regression tests PASS (§16.18.1). " +
      "Caller-migration decisions A1–A3 settled by owner 2026-11-18 " +
      "prompt-7 continuation (§16.19). Remaining: encrypted routing " +
      "of commercial callers (cart-order, product-inquiry, share-card).",
    ledgerAnchor: "#1618",
  },
  {
    lane: "E · Cart + orders",
    role: "buyer",
    summary:
      "Buyer builds cart, sends to seller shop, cart-snapshot peer-" +
      "message written and (for product carts) a deterministic " +
      "nex_order row keyed by the same UUID that was pre-minted into " +
      "attachment_meta.cart.order_id.",
    entry: "/nex-native/cart",
    connected: [
      "sendCartOrderAction (_actions.ts:2791)",
      "sendPeerMessage (peer-message-service.ts · Bridge-99 dedup on " +
        "send_intent_id · Migration 102 Part C)",
      "orderService.createOrder (order-service.ts · idempotency_key " +
        "wired 2026-11-19 r6 · §16.27)",
      "/nex-native/manage/orders (seller · nex_order RLS by " +
        "business_id → owner_account_id)",
      "/nex-native/manage/orders/[orderId] (notFound on owner mismatch)",
    ],
    data:
      "nex_peer_message.attachment_meta.cart (JSONB point-in-time " +
      "snapshot · all prices from server records · delivery_address " +
      "PII currently plaintext · Phase 2 Path A separation pending) · " +
      "nex_order (state='created' · unpaid semantics · representative-" +
      "product row for carts containing ≥1 kind='product' item · pure " +
      "menu_item carts write NO nex_order row)",
    status: "UNVERIFIED",
    evidence: ["SOURCE", "UNIT", "OFFLINE_TEST"],
    blocker:
      "SOURCE RECONCILED + LOCAL FIX LANDED 2026-11-19 r6 (§16.27): one-" +
      "line fix at _actions.ts:3633 propagates send_intent_id into " +
      "nex_order.idempotency_key so a double-tap that races past " +
      "sendPeerMessage dedup still converges on ONE order row. OFFLINE_" +
      "TEST: 3/3 new tests PASS (send-cart-order-idempotency.test.ts · " +
      "T1 valid UUID forwards · T2 missing falls back to null · T3 " +
      "malformed falls back to null) + 39/39 slice-0 security " +
      "regressions STILL PASS + 15/15 Lane C keypad baseline still " +
      "PASS. REMAINING local gaps (deferred · not fixed this round · " +
      "require broader scope): (a) message insert + order insert are " +
      "NOT atomic (fail-soft documented at _actions.ts:3620-24 · if " +
      "order fails after message succeeds, seller sees chat but no " +
      "order detail), (b) sendCartOrderAction does NOT call " +
      "notifySellerNewOrder (unlike placeOrderAction · seller must " +
      "poll chat / /manage/orders), (c) delivery_address PII stored " +
      "plaintext in attachment_meta JSONB (Phase 2 Path A separation " +
      "owed per sealed doctrine 2026-11-09). Session evidence (buyer " +
      "+ seller) still gated by the Shared Live-Auth Verification " +
      "Gate · email branch, two accounts. LANE-SPECIFIC outstanding: " +
      "cart snapshot write into attachment_meta.cart · nex_order row " +
      "creation + idempotency-under-double-tap · seller-side " +
      "/manage/orders surface · order-detail route · all remain " +
      "BROWSER/PERSISTENCE tier UNVERIFIED after the shared gate " +
      "clears. Source trace: ledger §16.13 + §16.27.",
    ledgerAnchor: "#1613_1627",
  },
  {
    lane: "F · Delivery quote + radius",
    role: "buyer",
    summary:
      "Buyer sees delivery quote; server re-verifies against the seller's " +
      "pricing model (per-ring OR rate-card) and refuses on tamper or " +
      "out-of-range.",
    entry: "/nex-native/cart (delivery quote)",
    connected: [
      "quoteLocalDelivery (delivery/local-delivery-quote.ts)",
      "isSubmittedLocalQuoteAuthentic",
      "estimateBikeFare (bike-delivery-service.ts)",
      "_actions.ts:2967-3029 (server verify)",
    ],
    data: "nex_business.location_lat/lng · nex_product.spec.__delivery",
    status: "HELD",
    evidence: ["SOURCE", "UNIT"],
    blocker:
      "Owner decision F resolved 2026-11-18 (§16.19) · F-A: per-ring " +
      "when configured, rate-card otherwise. Wiring change in " +
      "_actions.ts awaits the §16.19 implementation slice.",
    ledgerAnchor: "#1619",
  },
  {
    lane: "G · Calls (invite/response/ended)",
    role: "all",
    summary:
      "Caller sends call-invite; invitee sees ring, accepts or declines; " +
      "session ends.",
    entry: "/nex-native/call/preview",
    connected: [
      "calls/invite-service.ts (createCallInvite)",
      "/nex-native/chat/peer/[accountId] (chat row)",
      "/nex-native/call/preview?session=…&accept=1",
    ],
    data: "nex_call_session · nex_peer_message (attachment_type='call_invite')",
    status: "PARTIAL",
    evidence: ["SOURCE", "UNIT"],
    blocker:
      "G-FIX CLOSED (§16.29.1 · 2026-11-19 Lane G) — inviteToCall and " +
      "notifyInviteDeclined now route through sendCallInviteNotice + " +
      "sendCallStatusNotice (peer-message-service.ts), which call " +
      "sendPeerMessage under the module-private bypass symbol. FREEZE " +
      "guard and participant check now both apply. Decline body no " +
      "longer embeds user-typed display name (prompt-7 §4 doctrine). " +
      "15/15 structural + rendering tests PASS. BROWSER/PERSISTENCE " +
      "tier still UNVERIFIED (accept/decline/cancel/end transitions · " +
      "cross-country disclosure render · Web Push fallback).",
    ledgerAnchor: "#1629",
  },
  {
    lane: "H · Vault (idle + hidden lock)",
    role: "all",
    summary:
      "Unlocked vault auto-locks after 5 min idle or 1 min of hidden tab; " +
      "activity resets; teardown clean.",
    entry: "/nex-native/vault/*",
    connected: [
      "startVaultIdleGuard (vault/client/vault-session.ts)",
      "_vault-idle-guard.tsx (mount)",
      "startVaultCrossTabListener",
    ],
    data: "in-memory VMK (never persisted)",
    status: "PASS",
    evidence: ["SOURCE", "UNIT"],
    blocker:
      "UNIT · 5/5 pass (§16.18.1). Component-level evidence (decrypted " +
      "React state blockage, blob-URL revocation, multi-tab cross-check) " +
      "remains BROWSER-tier work.",
    ledgerAnchor: "#1618",
  },
  {
    lane: "I · Account deletion",
    role: "all",
    summary:
      "User with recent auth confirms destructive intent, 6-step workflow " +
      "runs, account rows marked deleted, auth user deleted.",
    entry: "/nex-native/settings/security/delete-account",
    connected: [
      "api/nex-native/security/account/delete/route.ts",
      "account-deletion-service.ts (deleteOwnAccount)",
      "session_revoke_all rate quota (3/hour)",
    ],
    data:
      "nex_account_mark_deleted RPC · nex_security_audit_erase_actor · " +
      "auth.admin.deleteUser",
    status: "UNVERIFIED",
    evidence: ["SOURCE"],
    blocker:
      "Surface built + authorised 2026-11-08. Session evidence gated by " +
      "the Shared Live-Auth Verification Gate (see below · email branch). " +
      "LANE-SPECIFIC outstanding: 6-step destructive workflow · " +
      "nex_account_mark_deleted RPC side-effects · " +
      "nex_security_audit_erase_actor write · auth.admin.deleteUser " +
      "irreversibility · session_revoke_all 3/hour quota. All remain " +
      "BROWSER/PERSISTENCE/PROVIDER tier UNVERIFIED after the shared " +
      "gate clears. MUST NEVER be tested on Hammerex nex-99901 or " +
      "Rosa nex-99903.",
    ledgerAnchor: "#161318",
  },
];

// ─── Text diagram (pre-formatted; no live JS) ────────────────────────

const DIAGRAM = `
                          ┌──────────────────┐
                          │     GUEST  (/)   │
                          └────────┬─────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
     B · free-chat           A · sign-in?mode       (seller onboard
     (ShopDrawer,             =signup → session        · same gate)
      no mock names)              │
            │                     ▼
            │             ┌────────────────┐
            └────────────▶│   BUYER/USER   │◀──────────────┐
                          └────┬────┬──────┘               │
                               │    │                      │
            ┌──────────────────┘    └───────────────┐      │
            │                                       │      │
      D · chat/peer                       E · cart → orders│
      (encrypted)                         (buyer sends cart)
            │                                       │      │
   sendEncryptedPeerMessages             sendCartOrderAction
   sendPeerMessage ← FREEZE guard        (uses attachment_meta.cart)
   sendGenericNotice (enum templates)              │
                                                   ▼
                                       F · delivery quote verify
                                       (quoteLocalDelivery
                                        | estimateBikeFare)
                                                   │
                                                   ▼
                                             nex_order row
                                                   │
                                                   ▼
                                           SELLER · /manage/orders
                                                   │                  │
                                                   ▼                  │
                                        /manage/orders/[orderId]      │
                                                                      │
                                           C · shop setup  ◀──────────┘
                                           (dispatcher: business-details
                                            → appearance → first-product
                                            → review · §16.27)

   G · calls/preview ──invite-service.ts──▶ chat/peer bubble
        (direct admin insert · NOT through sendPeerMessage today)

   H · vault idle/hidden lock (5 min / 1 min, startVaultIdleGuard)
        · locks every /vault/* route; unrelated journeys untouched.

   I · settings/security/delete-account
        · 6-step workflow; audit/soft-delete/auth-delete; irreversible.

   ADMIN · /nex-native/hq/*  (DESKTOP-ONLY · admin grant required)
        └─ this page · HQ journey map · evidence tier per lane.


   ╔═══════════════════════════════════════════════════════════════╗
   ║ PRELAUNCH GATE OVERLAY · NEX_PRELAUNCH_MODE env flag          ║
   ║ (src/middleware.ts + src/lib/nex-native/prelaunch/*)          ║
   ╚═══════════════════════════════════════════════════════════════╝

   Flag OFF (default · isPrelaunchModeOn() returns false):
     · Non-legacy path (anything not /nex, /nex/chat, /nex-native/*,
       /nex/*) → middleware early-returns NextResponse.next() ·
       NO gate, no auth read, no cookie writes.
     · Legacy path → CID header + auth refresh + directory seed
       cookie (unchanged pre-2026-11-18 behaviour).

   Flag ON (operator opts in · env-only · no DB flip, no UI toggle):
     · Non-allowlisted PAGE  → 302 redirect to /nexcorner.
     · Non-allowlisted API   → 404 "Not Found".
     · RSC server action     → 404 (detected via \`next-action\` header).
     · /nexcorner itself IS allowlisted · its RSC server action POST
       is permitted because the containing path is on the allowlist
       BEFORE the server-action 404 branch runs.
     · Allowlisted PAGES (exact): /, /nexcorner,
       /nex-generated/buying-guides, /nex-native/privacy,
       /nex-native/terms, /nex-native/sign-in, /nex-native/sign-in/forgot,
       /nex-native/sign-in/new-password, /robots.txt, /sitemap.xml,
       /manifest.webmanifest, /nex-manifest.json, /favicon.ico,
       /apple-touch-icon.png, /favicon-16.png, /favicon-32.png.
     · Allowlisted PAGES (prefix): /nexcorner/,
       /nex-generated/buying-guides/, /_next/, /icons/.
     · Allowlisted APIS (exact): /api/nex-native/prelaunch/notify.
     · Founder re-entry (owner-sealed 2026-11-19 r2): the existing
       sign-in route is the authorised re-entry path. Allowlist entries
       above let a signed-OUT founder reach /nex-native/sign-in; the
       companion server-side guard in createNexAccountAction redirects
       any non-founder signup attempt to /nexcorner BEFORE the DB write,
       and the sign-in page UI hides the Sign Up link during prelaunch.
     · Google OAuth gate (wired 2026-11-19 r3): /nex-native/auth/callback
       is allowlisted so anonymous returns from Google can reach the
       handler (middleware would otherwise 302 the inbound hit before
       cookies are set). The IN-HANDLER gate is the authoritative
       denial point: decideCallbackOutcome returns
       signout_then_redirect for a non-founder UID, and the route
       handler calls supabase.auth.signOut() to CLEAR the just-set
       cookies BEFORE redirecting to /nexcorner. Net: a non-founder
       Google identity never reaches a NEX-native surface in a
       signed-in state. /nex-native/auth/confirm is allowlisted on
       the same basis for the email-confirmation callback.
     · Founder bypass (SESSION layer): readAuthedNexUidOrNull(req) →
       isFounderUid(uid). Reads existing Supabase SSR cookies · DOES NOT
       create a session. Grants unrestricted navigation to an ALREADY-
       authenticated founder (orthogonal to the sign-in allowlist above
       which is what makes re-authentication possible after a logout).
     · nexcorner.com is the live apex domain (owner-asserted
       2026-11-19); the :3008 dev-server loaded target and the Vercel
       prod env flag value are UNKNOWN from this workstation until
       an operator-side diagnostic or a controlled restart confirms.
`;

// ─── Server component render ─────────────────────────────────────────

export default function HqJourneyMapPage(): React.ReactElement {
  return (
    <div
      style={{
        color: INK,
        display: "flex",
        flexDirection: "column",
        gap: 20,
        maxWidth: 1200,
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: INK_MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          NEX · HQ
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>
          Journey Map
        </h1>
        <p
          style={{
            fontSize: 13,
            color: INK_DIM,
            lineHeight: 1.55,
            maxWidth: 820,
            margin: 0,
          }}
        >
          Per-lane status for the nine user journeys that make up NEX. Each
          row links back to the authoritative Reconciliation Ledger anchor.
          Evidence tier ceiling is <strong>VERIFIED</strong>; the owner is
          the only authority for <strong>LIVE VERIFIED</strong>. No row
          below claims live-verified status.
        </p>
      </header>

      <section
        aria-label="Legend"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          padding: "10px 14px",
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          fontSize: 12,
        }}
      >
        <StatusChip status="PASS" />
        <StatusChip status="UNVERIFIED" />
        <StatusChip status="HELD" />
        <StatusChip status="BLOCKED" />
        <StatusChip status="FAIL" />
        <span style={{ color: INK_MUTED, marginLeft: 8 }}>
          Evidence: SOURCE_INSPECTED · UNIT · OFFLINE_TESTED · BROWSER · PERSISTED · PROVIDER · PHYSICAL_DEVICE
          <span style={{ color: INK_MUTED, opacity: 0.7, marginLeft: 6 }}>
            (legacy &quot;SOURCE&quot; preserved for 2026-11-18 rows)
          </span>
        </span>
      </section>

      <section
        aria-label="Text diagram"
        style={{
          padding: 14,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 800,
            margin: "0 0 8px",
            color: INK,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Lane diagram
        </h2>
        <pre
          style={{
            margin: 0,
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
            fontSize: 12,
            color: INK_DIM,
            whiteSpace: "pre",
            overflowX: "auto",
            lineHeight: 1.5,
          }}
        >
          {DIAGRAM}
        </pre>
      </section>

      <section aria-label="Lane table">
        <h2
          style={{
            fontSize: 13,
            fontWeight: 800,
            margin: "0 0 10px",
            color: INK,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Lanes A–I
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {JOURNEYS.map((row) => (
            <JourneyCard key={row.lane} row={row} />
          ))}
        </div>
      </section>

      <section
        id={GREEN_FLOW_REGISTRY_ID}
        aria-label="Proven Green Flow Registry"
        style={{
          padding: 14,
          background: SURFACE,
          border: `1px solid ${BORDER_HI}`,
          borderRadius: 10,
          fontSize: 12,
          color: INK_DIM,
          lineHeight: 1.55,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 800,
            margin: "0 0 8px",
            color: INK,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Proven Green Flow Registry
        </h2>
        <p style={{ margin: "0 0 10px" }}>
          Registry entries: <strong>0 / {GREEN_FLOW_REGISTRY.length} lanes</strong>.
          No lane in this registry today (2026-11-19 r5). A lane enters
          only after a live run produces the evidence named in its own
          rubric row below, captured by an operator — never inferred from
          a passing offline test. Engineering ceiling remains
          <strong> VERIFIED</strong>; only the owner can elevate a lane to
          <strong> LIVE VERIFIED</strong>. Adding an entry to this
          registry is NOT within this reconciliation session&apos;s
          authorisation.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          Rubric discipline: each lane below names its <strong>required
          evidence tiers</strong> (per §16.20.2) + the exact{" "}
          <strong>screenshots</strong>,{" "}
          <strong>DB rows</strong>, and{" "}
          <strong>cookies / session state</strong> the operator must
          capture to promote the lane. A subset is insufficient — all
          three capture categories are required for a lane to enter.
        </p>
        {GREEN_FLOW_REGISTRY.map((rubric) => (
          <div
            key={rubric.lane}
            style={{
              borderTop: `1px solid ${BORDER}`,
              paddingTop: 10,
              marginTop: 10,
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontWeight: 800,
                margin: "0 0 6px",
                color: INK,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              {rubric.lane}
            </h3>
            <p style={{ margin: "0 0 6px" }}>
              <strong>Required tiers:</strong>{" "}
              {rubric.requiredTiers.join(" · ")}
              {" · "}
              <strong>Current state:</strong> {rubric.entryState}
            </p>
            <p style={{ margin: "0 0 4px", fontWeight: 700, color: INK }}>
              Screenshots (capture + annotate with timestamp)
            </p>
            <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
              {rubric.screenshots.map((item) => (
                <li key={item} style={{ marginBottom: 4 }}>
                  {item}
                </li>
              ))}
            </ul>
            <p style={{ margin: "0 0 4px", fontWeight: 700, color: INK }}>
              DB rows (confirm against reconciled Supabase target)
            </p>
            <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
              {rubric.dbRows.map((item) => (
                <li key={item} style={{ marginBottom: 4 }}>
                  {item}
                </li>
              ))}
            </ul>
            <p style={{ margin: "0 0 4px", fontWeight: 700, color: INK }}>
              Cookies / session state
            </p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {rubric.cookiesAndSessionState.map((item) => (
                <li key={item} style={{ marginBottom: 4 }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section
        id={SHARED_AUTH_GATE_ID}
        aria-label="Shared Live-Auth Verification Gate"
        style={{
          padding: 14,
          background: SURFACE,
          border: `1px solid ${BORDER_HI}`,
          borderRadius: 10,
          fontSize: 12,
          color: INK_DIM,
          lineHeight: 1.55,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 800,
            margin: "0 0 8px",
            color: INK,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Shared Live-Auth Verification Gate
        </h2>
        <p style={{ margin: "0 0 10px" }}>
          One reference for every lane that needs an authenticated session
          as its evidence prerequisite. Lanes A, C, E and I point here
          rather than repeating the same blocker text. Clearing this gate
          does <strong>not</strong> automatically clear any downstream
          journey — each dependent lane retains its own
          BROWSER / PERSISTENCE / PROVIDER / DEVICE evidence requirements,
          named in that lane&apos;s own blocker field.
        </p>
        <p style={{ margin: "0 0 10px" }}>
          Status labels used below:{" "}
          <strong>SOURCE/OFFLINE COMPLETE</strong> (engineering ceiling),{" "}
          <strong>LIVE BLOCKED</strong> (operator prerequisites outstanding),{" "}
          <strong>DEPENDENT JOURNEY UNVERIFIED</strong> (downstream lane
          still requires its own browser/persistence/device proof even
          after the gate clears). No branch below is marked
          LIVE-VERIFIED by engineering.
        </p>
        <h3
          style={{
            fontSize: 12,
            fontWeight: 800,
            margin: "10px 0 6px",
            color: INK,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Shared operator prerequisites (apply to both branches)
        </h3>
        <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
          {SHARED_AUTH_GATE_SHARED_PREREQS.map((item) => (
            <li key={item} style={{ marginBottom: 4 }}>
              {item}
            </li>
          ))}
        </ul>
        {SHARED_AUTH_GATE_BRANCHES.map((branch) => (
          <div
            key={branch.name}
            style={{
              borderTop: `1px solid ${BORDER}`,
              paddingTop: 10,
              marginTop: 10,
            }}
          >
            <h3
              style={{
                fontSize: 12,
                fontWeight: 800,
                margin: "0 0 6px",
                color: INK,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              {branch.name}
            </h3>
            <p style={{ margin: "0 0 8px" }}>
              <strong>Source/offline:</strong> {branch.sourceOfflineStatus}
            </p>
            <p style={{ margin: "0 0 4px", fontWeight: 700, color: INK }}>
              Operator prerequisites (branch-specific)
            </p>
            <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
              {branch.operatorPrerequisites.map((item) => (
                <li key={item} style={{ marginBottom: 4 }}>
                  {item}
                </li>
              ))}
            </ul>
            <p style={{ margin: "0 0 4px", fontWeight: 700, color: INK }}>
              Outstanding live checks (only runnable after shared +
              branch prerequisites are met AND the DB/backend pause is
              separately lifted by the owner)
            </p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {branch.outstandingLiveChecks.map((item) => (
                <li key={item} style={{ marginBottom: 4 }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            paddingTop: 10,
            marginTop: 10,
          }}
        >
          <h3
            style={{
              fontSize: 12,
              fontWeight: 800,
              margin: "0 0 6px",
              color: INK,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            Dependent lanes
          </h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {SHARED_AUTH_GATE_DEPENDENT_LANES.map((item) => (
              <li key={item} style={{ marginBottom: 4 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-label="Flag-OFF vs Flag-ON routing matrix"
        style={{
          padding: 14,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          fontSize: 12,
          color: INK_DIM,
          lineHeight: 1.5,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 800,
            margin: "0 0 10px",
            color: INK,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Flag-OFF vs Flag-ON routing matrix
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              borderCollapse: "collapse",
              fontSize: 11.5,
              width: "100%",
              minWidth: 720,
            }}
          >
            <thead>
              <tr>
                <RoutingTh>Request</RoutingTh>
                <RoutingTh>Flag OFF (default)</RoutingTh>
                <RoutingTh>Flag ON · anonymous</RoutingTh>
                <RoutingTh>Flag ON · founder UID in env</RoutingTh>
              </tr>
            </thead>
            <tbody>
              <RoutingRow
                req="GET /"
                off="early-return (unchanged; page.tsx redirects per session)"
                onAnon="allowlisted · page renders"
                onFounder="allowlisted · page renders"
              />
              <RoutingRow
                req="GET /nexcorner"
                off="early-return · page renders"
                onAnon="allowlisted · page renders"
                onFounder="allowlisted · page renders"
              />
              <RoutingRow
                req="POST /nexcorner (RSC server action)"
                off="early-return · notifyAtLaunchAction runs"
                onAnon="allowlisted (page in exact list · server-action 404 branch skipped) · action runs"
                onFounder="allowlisted · action runs"
              />
              <RoutingRow
                req="POST /api/nex-native/prelaunch/notify"
                off="early-return · route runs"
                onAnon="allowlisted (exactApis) · 200/400/429/503"
                onFounder="allowlisted · 200/400/429/503"
              />
              <RoutingRow
                req="GET /nex-native/sign-in (incl. /forgot, /new-password)"
                off="legacy matched · CID + auth refresh · page renders"
                onAnon="allowlisted (owner-sealed 2026-11-19 r2) · page renders · signup link HIDDEN during prelaunch · typing an email in the public form grants NO access (authentication remains the gate)"
                onFounder="allowlisted · page renders; if cookies carry a founder UID the founder bypass additionally applies, but is not required to reach the surface"
              />
              <RoutingRow
                req="POST createNexAccountAction (RSC server action)"
                off="normal server-action behaviour"
                onAnon="prelaunch guard at action top: resolveNexAppSessionFromContext() → isFounderUid? NO → redirect('/nexcorner') BEFORE any DB write"
                onFounder="prelaunch guard: isFounderUid(uid) YES → falls through to rate-limit + normal signup"
              />
              <RoutingRow
                req="POST continueWithGoogleAction (RSC server action)"
                off="signInWithOAuth → redirect to Google consent"
                onAnon="supabase.auth.signInWithOAuth({provider:'google', redirectTo:/nex-native/auth/callback[?next=...]}) → if data.url: redirect to Google; if provider disabled: redirect to /sign-in?e=oauth_unavailable&m=... (HONEST FAIL, no mock success)"
                onFounder="same as onAnon; downstream callback gate recognises founder UID"
              />
              <RoutingRow
                req="GET /nex-native/auth/callback?code=...&next=..."
                off="code exchange → resolve user → nex_account lookup → decideCallbackOutcome: returning → next || /contacts · new → /nex-native/welcome"
                onAnon="code exchange → prelaunch gate: non-founder UID → supabase.auth.signOut() → 303 → /nexcorner (NO NEX surface reachable)"
                onFounder="code exchange → prelaunch gate: founder UID → routing continues normally"
              />
              <RoutingRow
                req="GET /nex-native/auth/callback?error=access_denied"
                off="303 → /sign-in?e=oauth_cancelled&m=Google sign-in was cancelled..."
                onAnon="allowlisted · 303 → /sign-in?e=oauth_cancelled (sign-in is now allowlisted)"
                onFounder="same"
              />
              <RoutingRow
                req="GET /nex-native/auth/callback?error=server_error"
                off="303 → /sign-in?e=oauth_provider_error&m=<description>"
                onAnon="same · honest surface, no mock success"
                onFounder="same"
              />
              <RoutingRow
                req="GET /nex-native/<any other>"
                off="legacy matched · CID + auth refresh · page renders"
                onAnon="NOT allowlisted · 302 → /nexcorner"
                onFounder="founder bypass fires · page renders"
              />
              <RoutingRow
                req="GET /api/<anything-except-prelaunch-notify>"
                off="BYPASS_PATH_PREFIXES early-return"
                onAnon="NOT allowlisted · 404"
                onFounder="founder bypass fires · route runs"
              />
              <RoutingRow
                req="RSC server action on NON-allowlisted page"
                off="normal server-action behaviour"
                onAnon="next-action header detected · 404 (action body dropped)"
                onFounder="founder bypass fires · action runs"
              />
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-label="Configuration-gated unknowns"
        style={{
          padding: 14,
          background: SURFACE,
          border: `1px solid ${BORDER_HI}`,
          borderRadius: 10,
          fontSize: 12,
          color: INK_DIM,
          lineHeight: 1.6,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 800,
            margin: "0 0 8px",
            color: INK,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Configuration-gated unknowns (as of 2026-11-19)
        </h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            Running :3008 dev-server loaded target reclassified
            2026-11-19 r6 after a single operator-authorised controlled
            restart (existing `npm run dev` · `next dev -p 3008` ·
            unchanged launch command). Fresh src/instrumentation.ts
            [nex-boot] fires on this process:
            NEX_SUPABASE_URL = sandbox (kdstoyyeygcopkogqsyv) ·
            DATABASE_URL = sandbox (kdstoyyeygcopkogqsyv) ·
            NEX_POSTGRES_URL = sandbox (kdstoyyeygcopkogqsyv) ·
            NEX_PRELAUNCH_MODE = OFF/absent. All three password-bearing
            targets classify to the same sandbox project reference and
            the server reports Ready in 538 ms. The classification
            label proves the URL/project ref that parsed · it does NOT
            prove the rewritten Postgres password successfully
            authenticates. A credential-authentication check is still
            required and is not authorised yet.
          </li>
          <li>
            Vercel-side NEX_PRELAUNCH_MODE for the live apex
            (nexcorner.com · owner-asserted live) is UNKNOWN from this
            workstation. Reported symptom (visitors entering the live
            splash) is consistent with the flag being OFF in the
            deployed environment, but engineering cannot confirm.
          </li>
          <li>
            Migration 352 (nex_prelaunch_signup) remains a PROPOSAL and
            has NOT been applied against the authoritative Supabase
            project. recordPrelaunchSignup() will return envelope
            reason=&apos;migration_not_applied&apos; on error code 42P01 until
            the migration is applied.
          </li>
          <li>
            Database operations REMAIN PAUSED. 2026-11-19 r7 update:
            the authorised sandbox-only credential-authentication
            check (`scripts/verify-pg-password-sandbox.mjs` — one
            Postgres connection, one `SELECT 1`, sanitised output)
            RAN and FAILED with sanitised category
            `auth_failed_password` (SQLSTATE 28P01). The rotation
            rewrote `.env.local` on disk (both DATABASE_URL and
            NEX_POSTGRES_URL target_classification = sandbox against
            ref `kdstoyyeygcopkogqsyv`) but the password that was
            typed into the masked rotation prompt does not
            authenticate the Postgres role at the Supabase pooler.
            Per the authorising prompt, live work is STOPPED; no
            retry with other credentials or targets is permitted
            from this session. The two commented hex strings from
            the original exposure remain UNKNOWN-type and still
            require operator-side rotation. Lifting the DB pause
            requires the operator to (i) re-run the sandbox
            rotation with the Supabase-project-correct password via
            their secure workflow, then (ii) re-authorise this
            narrow SELECT-1 check. No value, URL, env variable or
            raw driver message was echoed into source, tests, chat
            or evidence files.
          </li>
          <li>
            next.config.mjs carries NO apex rewrite from &apos;/&apos; to
            &apos;/nexcorner&apos;. Apex-domain routing to the prelaunch
            surface, if required, is a Vercel/DNS concern outside the
            code tree.
          </li>
          <li>
            Google OAuth / &quot;Continue with Google&quot; is WIRED in
            source as of 2026-11-19 r3 (ledger §16.22).
            continueWithGoogleAction + /nex-native/auth/callback + the
            pure decideCallbackOutcome helpers are implemented and 18/18
            offline tests passed. The <em>live</em> journey remains
            BLOCKED on the Google-branch operator prerequisites named in
            the Shared Live-Auth Verification Gate above (provider
            enablement + client ID + secret + authorised redirect URL).
            Offline passing does NOT prove the live journey.
          </li>
          <li>
            Founder re-entry (Lane A note #3) · owner-sealed 2026-11-19
            round 2: the normal sign-in route is the authorised re-entry
            path. /nex-native/sign-in + /forgot + /new-password are now
            on the public allowlist; createNexAccountAction carries a
            server-side prelaunch guard that redirects non-founder
            signups to /nexcorner before any DB write; the sign-in page
            UI hides the Sign Up link during prelaunch. The earlier
            re-entry gap (round 1) is closed at source; live confirmation
            still requires a signed-out founder to authenticate against
            the live Vercel surface.
          </li>
          <li>
            Launch-interest operator notification (new 2026-11-19 r2):
            sendLaunchInterestNotification is a fire-and-forget sidecar
            invoked only on a NEW save (state===&quot;new&quot;) inside
            notifyAtLaunchAction. Recipient read from NEX_PRELAUNCH_
            NOTIFY_TO server-side env; pure composer is offline-tested
            (10 cases, 321 ms); send wrapper never throws and its
            outcome CANNOT alter the saved envelope. Provider delivery
            remains UNVERIFIED (Resend creds + NEX_EMAIL_FROM owner-side).
          </li>
        </ul>
      </section>

      <section
        aria-label="Evidence references"
        style={{
          padding: 14,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          fontSize: 12,
          color: INK_DIM,
          lineHeight: 1.6,
        }}
      >
        <h2
          style={{
            fontSize: 13,
            fontWeight: 800,
            margin: "0 0 8px",
            color: INK,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
          }}
        >
          Evidence references
        </h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            <Link
              href={`${LEDGER_PATH}#1618`}
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              Ledger §16.18 — FREEZE guard + Vault UNIT build evidence
            </Link>
          </li>
          <li>
            <Link
              href={`${LEDGER_PATH}#1619`}
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              Ledger §16.19 — A/F resolutions + prompt-7 continuation
            </Link>
          </li>
          <li>
            <Link
              href={`${LEDGER_PATH}#1620`}
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              Ledger §16.20 — prompt-7 cont. 2026-11-19 · gate source-trace,
              founder re-entry gap, offline-tested evidence, DB pause
            </Link>
          </li>
          <li>
            <Link
              href="/evidence/master-flow/tsc-baseline-2026-11-18.txt"
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              TSC baseline 2026-11-18 (reconciled 2026-11-19 §16.22: 1527 is the real diagnostic count via `grep -c &quot;error TS&quot;`; 1980 is the total output line count including context + footer. Two metrics from the SAME run · there is no 453-diagnostic gap.)
            </Link>
          </li>
          <li>
            <Link
              href="/evidence/master-flow/tsc-after-prompt7-round1.txt"
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              TSC post-edit round 1 (1980 output lines / 1527 errors · zero semantic delta vs baseline; sole diff is cosmetic type-quote reordering on one line)
            </Link>
          </li>
          <li>
            <Link
              href="/evidence/master-flow/tsc-after-prompt7-round2-2026-11-19.txt"
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              TSC post-edit round 2 2026-11-19 (1980 output lines / 1527 errors · zero diff lines vs baseline · evidence that round-2 edits introduced no new errors)
            </Link>
          </li>
          <li>
            <Link
              href="/evidence/master-flow/tsc-after-prompt7-round2-wire-2026-11-19.txt"
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              TSC post-notifier-wire 2026-11-19 (1980 output lines / 1527 errors · one existing error&apos;s line number shifts 6961→7007 from the +46 line prelaunch guard · no new errors)
            </Link>
          </li>
          <li>
            <Link
              href={`${LEDGER_PATH}#1621`}
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              Ledger §16.21 — prompt-7 round 2 2026-11-19 · founder re-entry closed · launch-interest notifier wired · composer tests 10/10 · UI/server/UI three-layer enforcement
            </Link>
          </li>
          <li>
            <Link
              href="/evidence/master-flow/tsc-after-prompt7-round3-google-2026-11-19.txt"
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              TSC post-Google-OAuth 2026-11-19 r3 (1980 lines · 1527 errors · same pre-existing error shifts 6961→7077 from +70 line continueWithGoogleAction · no new errors)
            </Link>
          </li>
          <li>
            <Link
              href="/evidence/master-flow/tsc-after-prompt7-round3-google-r3b-allowlist-2026-11-19.txt"
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              TSC post-callback-allowlist 2026-11-19 r3b (1980 · 1527 · zero diff lines vs r3 · allowlist additions produced no tsc delta)
            </Link>
          </li>
          <li>
            <Link
              href={`${LEDGER_PATH}#1622`}
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              Ledger §16.22 — prompt-7 round 3 2026-11-19 · Google OAuth local engineering · 18 offline tests pass · callback allowlisted with defence-in-depth negative test · in-handler signOut gate is authoritative · operator prerequisites enumerated · LIVE still BLOCKED
            </Link>
          </li>
          <li>
            <Link
              href="/evidence/master-flow/tsc-after-r4-shared-auth-gate-2026-11-19.txt"
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              TSC post-shared-auth-gate 2026-11-19 r4 (1980 output lines / 1527 errors · zero diff vs r3b · HQ-map consolidation introduced no new errors)
            </Link>
          </li>
          <li>
            <Link
              href={`${LEDGER_PATH}#1623`}
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              Ledger §16.23 — prompt-7 round 4 2026-11-19 · bounded HQ-map + ledger reconciliation · Shared Live-Auth Verification Gate introduced · lanes A/C/E/I blockers now reference it (no lane upgraded) · stale "Google NOT WIRED" bullet and "1527 misstatement" wording corrected
            </Link>
          </li>
          <li>
            <Link
              href={`${LEDGER_PATH}#1624`}
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              Ledger §16.24 — prompt-7 round 5 2026-11-19 · Proven Green Flow Registry introduced (0 / 9 lanes · rubric + capture-shape pre-filled per lane · no lane promoted) · credential-conflict correction between round 4 "DB password" handoff wording and round 5 "publishable key" handoff wording (database password exposure authoritative per §16.20.9; two commented hex strings remain UNKNOWN type · both rotate)
            </Link>
          </li>
          <li>
            <Link
              href={`${LEDGER_PATH}#1625`}
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              Ledger §16.25 — prompt-7 round 6 2026-11-19 · controlled restart (existing npm run dev · unchanged launch command) · fresh [nex-boot] classifies NEX_SUPABASE_URL / DATABASE_URL / NEX_POSTGRES_URL all sandbox (kdstoyyeygcopkogqsyv) · PRELAUNCH_MODE OFF/absent · Ready in 538ms · classification labels do NOT prove the rewritten password authenticates · DB pause still in force · no lane promoted · smallest sandbox-only credential-authentication check proposed, not authorised
            </Link>
          </li>
          <li>
            <Link
              href={`${LEDGER_PATH}#1626`}
              style={{ color: ACCENT, textDecoration: "underline" }}
            >
              Ledger §16.26 — prompt-7 round 7 2026-11-19 · sandbox SELECT-1 credential check created (scripts/verify-pg-password-sandbox.mjs · sealed contract · sanitised error categories) · executed · exit 4 · outcome=failed · target_classification sandbox on both DATABASE_URL + NEX_POSTGRES_URL · error_category auth_failed_password (SQLSTATE 28P01) · password-mismatch not target-mismatch · DB pause still in force · Phase-2 sandbox sign-in/session lanes NOT started · no retry · no alternative credential/target · no lane promoted
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

// ─── Primitive cells ────────────────────────────────────────────────

function JourneyCard({ row }: { readonly row: JourneyRow }): React.JSX.Element {
  return (
    <article
      style={{
        padding: 14,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 10,
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 800,
              margin: 0,
              color: INK,
            }}
          >
            {row.lane}
          </h3>
          <span
            style={{
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: INK_MUTED,
            }}
          >
            {row.role}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: INK_DIM, lineHeight: 1.5 }}>
          {row.summary}
        </p>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        <StatusChip status={row.status} />
        <div style={{ fontSize: 10.5, color: INK_MUTED, display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {row.evidence.map((e) => (
            <EvidenceChip key={e} evidence={e} />
          ))}
        </div>
      </div>

      <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
        <LabelledCell label="Entry point" value={row.entry} />
        <LabelledCell
          label="Connected"
          value={row.connected.join(" · ")}
        />
        <LabelledCell label="Data / provider" value={row.data} />
        <LabelledCell label="Blocker" value={row.blocker} />
      </div>

      <div style={{ gridColumn: "1 / -1", fontSize: 11.5 }}>
        <Link
          href={`${LEDGER_PATH}${row.ledgerAnchor}`}
          style={{ color: ACCENT, textDecoration: "underline" }}
        >
          Evidence anchor →
        </Link>
      </div>
    </article>
  );
}

function LabelledCell({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: INK_MUTED,
          textTransform: "uppercase",
          letterSpacing: "0.14em",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, color: INK_DIM, lineHeight: 1.5 }}>
        {value}
      </div>
    </div>
  );
}

function StatusChip({ status }: { readonly status: Status }): React.JSX.Element {
  const palette: Record<Status, { bg: string; fg: string; border: string }> = {
    PASS: { bg: "rgba(22,214,107,0.18)", fg: "#9BF3BF", border: BORDER_HI },
    PARTIAL: { bg: "rgba(129,201,149,0.14)", fg: "#B8E3C6", border: "rgba(129,201,149,0.5)" },
    UNVERIFIED: { bg: "rgba(246,195,36,0.12)", fg: "#F6C324", border: "rgba(246,195,36,0.5)" },
    HELD: { bg: "rgba(87,145,246,0.12)", fg: "#9BC2F9", border: "rgba(87,145,246,0.5)" },
    BLOCKED: { bg: "rgba(246,87,87,0.12)", fg: "#F58080", border: "rgba(246,87,87,0.5)" },
    FAIL: { bg: "rgba(246,87,87,0.22)", fg: "#FFB0B0", border: "rgba(246,87,87,0.7)" },
  };
  const p = palette[status];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 800,
        letterSpacing: "0.1em",
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.border}`,
      }}
    >
      {status}
    </span>
  );
}

function EvidenceChip({ evidence }: { readonly evidence: Evidence }): React.JSX.Element {
  return (
    <span
      style={{
        padding: "1px 6px",
        borderRadius: 4,
        border: `1px solid ${BORDER}`,
        color: INK_MUTED,
        fontSize: 9.5,
      }}
    >
      {evidence}
    </span>
  );
}

function RoutingTh({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "6px 8px",
        borderBottom: `1px solid ${BORDER_HI}`,
        color: INK,
        fontWeight: 800,
        fontSize: 11,
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </th>
  );
}

function RoutingRow({
  req,
  off,
  onAnon,
  onFounder,
}: {
  readonly req: string;
  readonly off: string;
  readonly onAnon: string;
  readonly onFounder: string;
}): React.JSX.Element {
  const cell: React.CSSProperties = {
    padding: "6px 8px",
    borderBottom: `1px solid ${BORDER}`,
    verticalAlign: "top",
    color: INK_DIM,
  };
  return (
    <tr>
      <td style={{ ...cell, color: INK, fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 11 }}>{req}</td>
      <td style={cell}>{off}</td>
      <td style={cell}>{onAnon}</td>
      <td style={cell}>{onFounder}</td>
    </tr>
  );
}
