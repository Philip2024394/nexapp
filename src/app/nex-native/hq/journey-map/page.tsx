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
  /** Additive · dated notes about the rubric itself (e.g. "route
   *  labels corrected on …", "cross-retry linkage closed at
   *  SOURCE+OFFLINE_TESTED"). Keeps `entryState` sealed to the
   *  single narrow literal above so that promotion to LIVE VERIFIED
   *  still requires owner action. Notes do NOT promote evidence
   *  tiers. */
  readonly notes?: readonly string[];
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
    entryState: "EMPTY (no live run · rubric pre-filled)",
    notes: [
      "Route labels corrected 2026-11-19 r6.",
      "C-1 / C-3 closed at SOURCE + OFFLINE_TESTED · C-2 BLOCKED on " +
        "schema (round 11 · 2026-11-19).",
      "C-NAME-OWNER CLOSED at SOURCE + OFFLINE_TESTED · round 17 · " +
        "2026-11-19 (§16.36). Both direct-update paths that bypass the " +
        "typed updateBusinessProfile writer — saveShopIdentityAction " +
        "(legacy 8-step) + saveShopBusinessDetailsAction (4-step " +
        "flow) — now carry .eq('owner_account_id', biz.accountId) " +
        "alongside the id scope and use .select('id') + zero-row check " +
        "to return { ok:false, error:'owner-scope-denied' } when the " +
        "WHERE fails. Closes the window between requireBusiness() " +
        "returning and the UPDATE executing where a concurrent " +
        "ownership transfer could have mutated a row the caller no " +
        "longer owns. 5/5 source-shape regressions green (c-name-" +
        "owner-scope.test.ts). BROWSER + PERSISTENCE tier observation " +
        "of the owner-scope-denied branch still owed.",
      "C-NAME-OWNER-SERVICE-BOUNDARY CLOSED at SOURCE + " +
        "OFFLINE_TESTED · round 18 · 2026-11-19 (§16.38). The two " +
        "direct-update paths that round 17 inlined are now routed " +
        "through a dedicated service-layer writer " +
        "`updateBusinessDisplayName(id, ownerAccountId, displayName)` " +
        "in business-service.ts. The service refuses to execute " +
        "without ownerAccountId, length-gates the name 2-40 chars, " +
        "scopes the UPDATE `.eq('id', id).eq('owner_account_id', " +
        "ownerAccountId)` with `.select('*').maybeSingle()`, and " +
        "throws an Error whose message contains `owner-mismatch` on " +
        "zero-row matches. The actions catch that, convert to the " +
        "stable `owner-scope-denied` wire code, and the UI mapper " +
        "(`errorCopy` in both business-details/_client.tsx and the " +
        "newly-added identity/_client.tsx helper) renders the " +
        "user-safe banner. Evidence: 9 service-layer tests in " +
        "update-business-display-name.test.ts (D1 missing-identity · " +
        "D2a-d invalid name · D3 happy-path owner scope + trim · " +
        "D4 owner-mismatch · D5 supabase error bubble); 7 updated " +
        "source-shape assertions in c-name-owner-scope.test.ts; the " +
        "paired UI mapping suites (identity + business-details) " +
        "cover owner-scope-denied → banner copy AND the regression " +
        "guard against re-introducing raw `result.error`. 34/34 " +
        "tests green across 6 files touched this round. BROWSER + " +
        "PERSISTED tier observation of the owner-mismatch branch " +
        "against sandbox `kdstoyyeygcopkogqsyv` is the remaining " +
        "owed evidence (bounded approval request in §16.38.7).",
      "LANE E · E-NOTIFY VERIFIED at SOURCE + OFFLINE_TESTED · " +
        "round 18 · 2026-11-19 (§16.38). Re-run of the 7 source-" +
        "shape assertions in send-cart-order-e-notify-wire.test.ts " +
        "confirms sendCartOrderAction still (a) imports " +
        "notifySellerNewOrder from the supported service module, " +
        "(b) captures createdOrder inside the try-branch that " +
        "owns the deterministic nex_order insert, (c) calls " +
        "orderService.listOrderEvents(createdOrder.id) + " +
        ".some(ev.event === 'seller_notified') BEFORE the notify, " +
        "(d) fires notifySellerNewOrder only when !alreadyNotified, " +
        "(e) records the seller_notified marker after a fresh " +
        "notify, (f) wraps the branch in try/catch (fail-soft · " +
        "notify failure cannot reverse the order row), (g) nests " +
        "the marker-write in its own try/catch (marker failure " +
        "cannot reverse the notify). Gating against double-notify " +
        "on idempotent retry is live at the SOURCE tier. BROWSER + " +
        "PERSISTED + PROVIDER (real WebPush) tiers remain owed · " +
        "no re-work needed, the implementation stands.",
    ],
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
    entryState: "EMPTY (no live run · rubric pre-filled)",
    notes: [
      "Cross-retry linkage CLOSED at SOURCE + OFFLINE_TESTED · " +
        "round 11 · 2026-11-19.",
      "E-NOTIFY wire-up LANDED at SOURCE + OFFLINE_TESTED · round 17 · " +
        "2026-11-19. sendCartOrderAction now calls notifySellerNewOrder " +
        "fail-soft after a confirmed nex_order insert, gated by a " +
        "nex_order_event 'seller_notified' marker so a double-tap or " +
        "idempotency-dedup retry does NOT re-notify. 7/7 wire-shape " +
        "regressions green (send-cart-order-e-notify-wire.test.ts). " +
        "BROWSER + PERSISTED verification still owed against sandbox.",
      "E-ATOM caller wire LANDED · 2026-11-20 · commit c8ff3b5c. " +
        "sendCartOrderAction in src/app/nex-native/_actions.ts now " +
        "routes through createCartOrderTransactionalCandidate behind " +
        "NEX_CART_ORDER_TX=1. Flag OFF default · legacy direct-write " +
        "path preserved verbatim and taken on flag-unset, missing " +
        "session.supabaseUserId, rpc_unavailable, or any other RPC " +
        "error. Post-RPC seller notify mirrors the legacy nested " +
        "block and reuses the 'seller_notified' event-marker dedup. " +
        "Migration 354 promoted into nex-supabase/migrations/ with " +
        "matching rollback and apply-script scripts/apply-migration-" +
        "354-sandbox.mjs. Wrapper's 16/16 mocked RPC tests remain " +
        "green; _actions.ts tsc introduced 0 new errors. SANDBOX " +
        "APPLIED · 2026-11-20 (owner execution round). Script run " +
        "against kdstoyyeygcopkogqsyv returned '✓ mig 354 applied' · " +
        "nex_create_cart_order_tx present with prosecdef=true + " +
        "proconfig=[search_path=public,pg_temp] · EXECUTE granted to " +
        "anon/authenticated/postgres/service_role · nex_migration_" +
        "history row written for version 354. NEX_CART_ORDER_TX=1 " +
        "appended to sandbox .env.local (gitignored). Production " +
        "ijvqdvsvwtwxzcqmoqit sealed · no prod apply. STILL OPEN: " +
        "dev server restart required so the running :3008 process " +
        "picks up the flag; BROWSER + PERSISTED verification against " +
        "sandbox DB (cart send → nex_order row → seller notify) " +
        "still owed.",
      "E-PRIVACY exact blocker IDENTIFIED · round 17 · 2026-11-19. " +
        "Removing delivery_address plaintext from attachment_meta.cart " +
        "requires Path A Phase A schema to land first (new nex_order " +
        "columns + nex_order_item child + 'order_reference' enum " +
        "entry · sealed 2026-11-09 doctrine). Candidate SQL prepared " +
        "at candidate-migrations/C003 + 355_..._PREVIEW.sql + matching " +
        "rollback preview + apply-script PREVIEW. Rollback guards " +
        "against Phase-B-live state (RAISE if nex_order_item has rows " +
        "or any nex_order.product_id is NULL). Phase B write-path " +
        "switch is a SEPARATE authorisation word-trigger · UI STILL " +
        "stamps delivery_address plaintext into attachment_meta.cart " +
        "until that trigger fires.",
      "E-SECURITY migration 363 APPLIED to sandbox kdstoyyeygcopkogqsyv · " +
        "2026-11-20 via aws-1-eu-west-3 pooler. Closes anon EXECUTE on " +
        "nex_create_cart_order_tx (REVOKE PUBLIC + REVOKE anon · GRANT " +
        "authenticated + service_role preserved) and adds defence-in- " +
        "depth check: NULL auth.uid() callers must have current_" +
        "setting('role') = 'service_role' or the function raises " +
        "'caller_identity_denied'. Post-apply REST probe returns " +
        "HTTP 401 42501 'permission denied for function' (was HTTP 400 " +
        "P0001 caller_account_not_found pre-apply · evidence files at " +
        "docs/evidence/mig-363-sandbox-2026-11-20/). Security contract " +
        "5/9 PASS: T1 anon ACL denied · T2 authenticated+NULL fails " +
        "closed · T4 buyer-ID tampering denied (caller_account_not_" +
        "found) · T5 non-existent conv denied (conversation_not_found) " +
        "· T9 forced product_not_found leaves zero orphan nex_order " +
        "rows. 4/9 BLOCKED by pre-existing TEXT→UUID cast bug on " +
        "nex_peer_message.send_intent_id (column is UUID, function " +
        "passes NULLIF(p_send_intent_id,'') without ::uuid cast · " +
        "SQLSTATE 42804). Latent since send_intent_id was migrated to " +
        "UUID; hidden in production because NEX_CART_ORDER_TX=0 kept " +
        "RPC callers off the message-insert path. Fix prepared as " +
        "candidate-migrations/364_fix_cart_order_tx_send_intent_cast_" +
        "PROPOSAL.sql · byte-identical to mig 363 except two ::uuid " +
        "casts + local uuid var. NOT AUTHORISED for apply. " +
        "NEX_CART_ORDER_TX stays 0 until mig 364 is approved + applied " +
        "and T3/T6/T7/T8 contract checks pass. Production " +
        "ijvqdvsvwtwxzcqmoqit SEALED · no prod apply.",
      "E-SECURITY migration 364 APPLIED to sandbox 2026-11-20 by " +
        "owner word-trigger 'apply mig 364 to sandbox'. Body md5 " +
        "ef5cdf9d → 08dce8e0 · v_send_intent_uuid::uuid cast " +
        "present · anon still revoked, authenticated+service_role " +
        "preserved (CREATE OR REPLACE kept the mig-363 ACL). The " +
        "fix unblocks past the SQLSTATE 42804 wall but immediately " +
        "surfaces a SECOND pre-existing latent bug: the message " +
        "INSERT uses ON CONFLICT (sender_account_id, send_intent_" +
        "id) DO NOTHING against a PARTIAL unique index " +
        "uq_nex_peer_message_send_intent WHERE send_intent_id IS " +
        "NOT NULL. Postgres rejects with SQLSTATE 42P10 'no unique " +
        "or exclusion constraint matching the ON CONFLICT " +
        "specification' because the inference clause lacks the " +
        "matching WHERE. Same latent-until-NEX_CART_ORDER_TX=1 " +
        "pattern · hidden by the cast bug · also pre-existing in " +
        "mig 354 + 363 + 364. Fix prepared as candidate-migrations" +
        "/365_fix_cart_order_tx_on_conflict_partial_PROPOSAL.sql · " +
        "byte-identical to mig 364 except the ON CONFLICT WHERE " +
        "predicate. NOT AUTHORISED for apply. Security contract " +
        "post-mig-364: still 5/9 PASS (same four T3/T6/T7/T8 now " +
        "failing on 42P10 instead of 42804). Flag NEX_CART_ORDER_" +
        "TX stays 0.",
      "E-SECURITY-WALKER extended walker 2026-11-20: genuine " +
        "authentication (NOT dev-impersonation) for Hamrex nex-99901 " +
        "+ Rosa nex-99903 via admin.generateLink magiclink · fetch " +
        "manual-redirect extracts access_token from Location-header " +
        "hash fragment. Both tokens verified against /auth/v1/user → " +
        "auth.uid() matches persona. 10/10 PASS under real JWTs: P1 " +
        "Hamrex POST message in shared conv (201) · P2 Rosa reads " +
        "and sees Hamrex row · P3 Rosa POST reply (201) · P4 Hamrex " +
        "reads and sees both rows · P5 fresh fetch after settle " +
        "confirms persistence · N1 sender-spoof (Hamrex sending as " +
        "Rosa) rejected HTTP 403 42501 'new row violates row-level " +
        "security policy' · N2 non-participant conv insert rejected " +
        "HTTP 403 42501 · N3 stranger-conv SELECT returns 0 rows. " +
        "Evidence: scripts/_tmp/evidence/2026-11-20-closeout/" +
        "full-walker-two-way-chat.json + .txt. Proves nex_peer_" +
        "message INSERT and SELECT RLS policies correctly scope to " +
        "nex_current_account_ids() derived from auth.uid() on real " +
        "JWTs.",
    ],
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
      "OWNER-SCOPE now closed at THREE layers (§16.36 round 17 + " +
      "§16.38 round 18 · 2026-11-19): (1) service-layer " +
      "updateBusinessProfile added .eq('owner_account_id', " +
      "ownerAccountId) in round 11 · (2) round 17 extended the same " +
      "owner clause to the two direct-update paths that bypassed the " +
      "typed writer (saveShopIdentityAction + " +
      "saveShopBusinessDetailsAction) · (3) round 18 moved those " +
      "inline writes behind a dedicated service helper " +
      "`updateBusinessDisplayName(id, ownerAccountId, displayName)` " +
      "in business-service.ts so BOTH actions share one enforcement " +
      "surface and future callers cannot forget the owner clause. " +
      "The helper refuses to execute without ownerAccountId, " +
      "length-gates 2-40, scopes `.eq('id', id).eq('owner_account_id', " +
      "ownerAccountId).select('*').maybeSingle()`, and throws " +
      "`...owner-mismatch...` on zero rows · the actions convert to " +
      "the stable `owner-scope-denied` wire code, and the UI mapper " +
      "`errorCopy` in BOTH identity/_client.tsx (new) and " +
      "business-details/_client.tsx renders the user-safe banner " +
      "(regression-guarded so raw `result.error` cannot leak again). " +
      "Evidence: 9 service-layer tests (update-business-display-" +
      "name.test.ts) + 7 updated source-shape assertions (c-name-" +
      "owner-scope.test.ts) + paired UI mapping suites. 34/34 " +
      "tests green across the 6 files touched this round. LANE-" +
      "SPECIFIC outstanding: end-to-end 4-step completion through " +
      "the dispatcher · nex_business row persistence on each save · " +
      "re-hydration on reload · owner-mismatch branch observed live " +
      "(zero-row denial path) · all remain BROWSER/PERSISTENCE tier " +
      "UNVERIFIED after the shared gate clears. UNIT already covers " +
      "keypad wiring (15 tests PASS).",
    ledgerAnchor: "#161_1636_1638",
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
    evidence: ["SOURCE", "UNIT", "OFFLINE_TESTED"],
    blocker:
      "SOURCE RECONCILED + LOCAL FIX LANDED 2026-11-19 r6 (§16.27): one-" +
      "line fix at _actions.ts:3633 propagates send_intent_id into " +
      "nex_order.idempotency_key so a double-tap that races past " +
      "sendPeerMessage dedup still converges on ONE order row. OFFLINE_" +
      "TEST: 3/3 new tests PASS (send-cart-order-idempotency.test.ts · " +
      "T1 valid UUID forwards · T2 missing falls back to null · T3 " +
      "malformed falls back to null) + 39/39 slice-0 security " +
      "regressions STILL PASS + 15/15 Lane C keypad baseline still " +
      "PASS. ROUND 17 UPDATE (§16.35 · 2026-11-19): three previously " +
      "deferred gaps now have landing/candidate status · (a) ATOMICITY " +
      "— UNAPPLIED CANDIDATE PREPARED for message+order SECURITY " +
      "DEFINER wrap (nex_create_cart_order_tx · " +
      "candidate-migrations/C002 anchor + 354_..._PREVIEW apply " +
      "sibling + rollback preview + apply-script preview + unactivated " +
      "TS wrapper send-cart-order.transactional-candidate.ts + 16/16 " +
      "mocked-RPC spec tests) · live sendCartOrderAction STILL runs " +
      "two unwrapped inserts until a sandbox-apply AND feature-flag " +
      "authorisation flip · (b) SELLER NOTIFY — WIRED at SOURCE + " +
      "OFFLINE_TESTED: sendCartOrderAction now calls notifySellerNewOrder " +
      "fail-soft inside the createdOrder try-branch, dedup-gated by a " +
      "nex_order_event 'seller_notified' marker (listOrderEvents check-" +
      "then-recordOrderEvent) so idempotency-dedup retries do NOT " +
      "double-notify · 7/7 source-shape regressions green " +
      "(send-cart-order-e-notify-wire.test.ts) · BROWSER + PERSISTED " +
      "+ PROVIDER (actual WebPush dispatch) tiers still owed · (c) " +
      "DELIVERY-ADDRESS PII — Phase A schema UNAPPLIED CANDIDATE " +
      "PREPARED (C003 + 355_..._PREVIEW trio adding 5 nex_order " +
      "columns + nex_order_item child + 'order_reference' enum entry) " +
      "· write-path switch to remove plaintext from attachment_meta is " +
      "Phase B · SEPARATE authorisation word-trigger still owed · UI " +
      "continues to stamp delivery_address plaintext until that trigger " +
      "fires. Session evidence (buyer + seller) still gated by the " +
      "Shared Live-Auth Verification Gate · email branch, two " +
      "accounts. LANE-SPECIFIC outstanding: cart snapshot write into " +
      "attachment_meta.cart · nex_order row creation + idempotency-" +
      "under-double-tap · seller-side /manage/orders surface · order-" +
      "detail route · observed seller push on real device · all " +
      "remain BROWSER/PERSISTENCE/PROVIDER tier UNVERIFIED after the " +
      "shared gate clears. Source trace: ledger §16.13 + §16.27 + " +
      "§16.35. ROUND 18 RE-VERIFICATION (§16.38 · 2026-11-19): E-NOTIFY " +
      "wiring re-asserted at SOURCE (7-point structural audit: " +
      "listOrderEvents check · .some(seller_notified) dedup · " +
      "notifySellerNewOrder gated on !alreadyNotified · nested try for " +
      "recordOrderEvent marker write · outer fail-soft try/catch · inside " +
      "createdOrder try-branch · no throw to buyer) + OFFLINE_TESTED " +
      "(7/7 send-cart-order-e-notify-wire regressions still PASS, no " +
      "code change this round). BROWSER + PERSISTED + PROVIDER tiers " +
      "remain owed · PROVIDER tier specifically requires observing a " +
      "real WebPush dispatch after the Shared Live-Auth Verification " +
      "Gate clears.",
    ledgerAnchor: "#1613_1627_1635_1638",
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
    status: "PARTIAL",
    evidence: ["SOURCE", "UNIT", "OFFLINE_TESTED"],
    blocker:
      "F-A wiring landed 2026-11-19 (§16.31) · _actions.ts now derives " +
      "seller identity + per-ring OR rate-card pricing + Haversine " +
      "straight-line distance server-side and rejects mixed / tampered / " +
      "stale / invalid quotes. Server also hard-pins currency to IDR, " +
      "defanging client-side currency tamper. 91/91 OFFLINE_TESTED " +
      "(22 shape · 11 F-WIRE · 58 pre-existing cart/action). " +
      "BROWSER/PERSISTENCE/PROVIDER tier UNVERIFIED after the DB/auth " +
      "pause lifts (live rate-card fetch · live product spec · live " +
      "delivery message insert).",
    ledgerAnchor: "#1631",
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
    evidence: ["SOURCE", "UNIT", "OFFLINE_TESTED"],
    blocker:
      "G-FIX CLOSED (§16.29.1) + routing re-verified (§16.31 + §16.32) + " +
      "decline-lifecycle RUNTIME FIX landed 2026-11-19 (§16.33). " +
      "sendCallInviteNotice + sendCallStatusNotice route through " +
      "sendPeerMessage under module-private " +
      "INTERNAL_GENERIC_NOTICE_BYPASS symbol · FREEZE guard + participant " +
      "check apply · decline body is bounded enum \"✖ voice/video call " +
      "declined\" with no user-typed display name · pre-mig306 CHECK " +
      "regex fallback preserved. G-A DECLINE LIFECYCLE (§16.33 runtime " +
      "fix): call/preview decline branch now calls " +
      "maybeEndSessionIfAllParticipantsLeft(sessionId) after a " +
      "successful participant.left_at flip · for 1:1 invites (host not a " +
      "participant row · inviteToCall path) session transitions to " +
      "'ended' when the only invitee declines · multi-participant " +
      "sessions remain untouched (helper is no-op when any participant " +
      "has left_at IS NULL). GA-END-1..5 (5 tests) PASS. Caller " +
      "cancellation + joined-live promotion gaps remain SEPARATE items " +
      "(see §16.33). G-B INVITE ATOMICITY (OPEN · UNAPPLIED candidate " +
      "ready): inviteToCall still performs 4 unwrapped inserts " +
      "(nex_group_call_session + nex_group_call_participant + " +
      "nex_peer_conversation + nex_peer_message) without a transaction · " +
      "a late-write failure can leave an orphan session+participant · " +
      "candidate SQL + TypeScript wrapper written (nex-supabase/" +
      "candidate-migrations/C001 + invite-service.transactional-" +
      "candidate.ts) · UNAPPLIED · REVIEW REQUIRED · GB-* 13 tests PASS " +
      "as SPECIFICATION only (mocked RPC · NOT proof of DB rollback / " +
      "concurrency / persistence). 59/59 OFFLINE_TESTED on fresh re-run " +
      "(invite-freeze-guard-routing · invite-service · peer-message-" +
      "plaintext-freeze · group-call-decline-lifecycle · invite-" +
      "service-transactional-candidate). BROWSER / PERSISTENCE / " +
      "PROVIDER tier UNVERIFIED (accept/decline/cancel/end transitions · " +
      "cross-country disclosure render · Web Push fallback · " +
      "transactional rollback in sandbox · concurrency / retry under " +
      "real DB). ROUND 18 OFFLINE REVIEW (§16.37): SECURITY DEFINER " +
      "search_path / REVOKE PUBLIC + GRANT authenticated,service_role / " +
      "auth.uid() caller-identity check / ordered-pair get-or-create / " +
      "ON CONFLICT (session_id,account_id) DO NOTHING re-read all " +
      "verified at SOURCE_INSPECTED tier. HONEST LIMITATIONS recorded: " +
      "(i) mig-353 prefix PROVISIONAL (349-352 PROPOSAL files unapplied · " +
      "renumber-at-approval owed); (ii) attachment-type CHECK " +
      "prerequisite (mig 309) not yet declared in 353 PREVIEW header · " +
      "comment owed on promotion; (iii) 4-cap trigger (mig 133) uses " +
      "SELECT COUNT(*) BEFORE INSERT · SECURITY DEFINER wrapping DOES " +
      "NOT fix the race · GB-4CAP stays mapped to generic " +
      "message_insert_failed; (iv) auth.uid() NULL under service_role · " +
      "fixtures must be signed-in disposable users (admin.createUser is " +
      "ADMIN PROVISIONING, not proof of email-registration journey); " +
      "(v) SQL function INSERTs nex_peer_message directly · integration " +
      "diff MUST preserve inviteToCall's full TS prelude (UUID + " +
      "rate-limit + attachment-ready probe + country + body template) " +
      "and replace only the 4 writes; (vi) call-site _invite-actions.ts " +
      "passes session.account.id · RPC path needs session.supabaseUserId · " +
      "offline integration-diff SHAPE drafted (§16.37.3) but NOT applied " +
      "this round. Fixture manifest + FK cascade trace + narrowly-" +
      "scoped cleanup (auth.admin.deleteUser on fixture supabaseUserIds " +
      "only · never prefix-match · never touch Hammerex/Rosa) specified " +
      "(§16.37.4). Separate verdicts for candidate SQL / integration / " +
      "browser kept distinct in §16.37.8. ROUND 18 BOUNDED SANDBOX " +
      "APPLY (§16.39 · 2026-11-19 · sandbox kdstoyyeygcopkogqsyv only): " +
      "mig 353 PROMOTED + APPLIED · function nex_invite_to_call_tx " +
      "exists · prosecdef=true · search_path=public,pg_temp · GRANT " +
      "EXECUTE scoped to authenticated+service_role (anon stripped by " +
      "explicit REVOKE after audit caught Supabase default-privilege " +
      "residue that would have let an unauthenticated caller bypass the " +
      "auth.uid()-NULL identity branch). Prerequisite-header comment " +
      "added to the applied migration body. 2 disposable fixtures ADMIN-" +
      "PROVISIONED via supabase.auth.admin.createUser (NOT email-" +
      "delivery proof) · signed in via supported password auth · IDs: " +
      "fixture-A supabase_user_id=12e42d55-… nex_account_id=3cad1131-… · " +
      "fixture-B supabase_user_id=a1d2a88f-… nex_account_id=a0683876-…. " +
      "NEW BLOCKER GB-ATTACH-PAIR: the applied function hardcodes " +
      "attachment_type='call_invite' but writes NO attachment_url · " +
      "sandbox CHECK `nex_peer_message_attachment_pair_check` requires " +
      "attachment_url IS NULL = attachment_type IS NULL · happy-path " +
      "RPC raises 23514 on the final INSERT. The function body needs a " +
      "new `p_attachment_url` parameter · adding it is an UNAPPROVED " +
      "MIGRATION CHANGE · STOPPED and reported per directive item 1 · " +
      "NO re-apply attempted. ITEMS 4 happy-path, 5 fault-injection, 5 " +
      "concurrent retry: BLOCKED on GB-ATTACH-PAIR · UNVERIFIED. " +
      "INCIDENTAL ROLLBACK EVIDENCE: the CHECK-violation failure acted " +
      "as a natural fault injection · post-failure direct SQL counts " +
      "show 0 sessions / 0 participants / 0 conversations / 0 messages " +
      "attributable to fixture-A or fixture-B · the plpgsql " +
      "subtransaction rolled back ALL earlier writes atomically · " +
      "AUTHENTICATED_RPC_ROLLBACK verified at PERSISTED tier (direct pg " +
      "SELECT), independent of browser or WebPush. GB-4CAP KNOWN " +
      "LIMITATION PRESERVED · SELECT COUNT(*) BEFORE INSERT race NOT " +
      "closed by SECURITY DEFINER · documentation unchanged. CLEANUP " +
      "BY CAPTURED ID (no prefix match): nex_account.id=3cad1131-… and " +
      "a0683876-… deleted · auth.admin.deleteUser(12e42d55-…) and " +
      "deleteUser(a1d2a88f-…) OK · pre/post counts: nex_account 960→958 " +
      "(Δ -2 as expected) · nex_peer_message 141→141 (Δ 0) · " +
      "nex_peer_conversation 9→9 (Δ 0) · nex_group_call_session 0→0 · " +
      "nex_group_call_participant 0→0. Neighbouring data untouched · no " +
      "content exposed. BROWSER + PROVIDER (WebPush) + PHYSICAL_DEVICE " +
      "tiers NOT PERFORMED this round. Item 8 integration + feature-" +
      "flag + call-site + browser activation remains DEFERRED. G-B NOT " +
      "declared fully closed · the RPC does not pass end-to-end against " +
      "sandbox schema until GB-ATTACH-PAIR is resolved under a new " +
      "authorised migration. ROUND 18 CONTINUATION · MIG-356 APPLIED " +
      "(§16.41 · 2026-11-19 · sandbox kdstoyyeygcopkogqsyv only): " +
      "mig-356 PROMOTED + APPLIED · DROP of mig-353 7-param signature " +
      "(p_self_supabase_user_id REMOVED) · new 7-param signature " +
      "(p_invitee_account_id, p_media_type, p_host_country, " +
      "p_attachment_meta, p_invite_body, p_attachment_url, " +
      "p_existing_session_id) derives caller identity from auth.uid() " +
      "ONLY · fail-closed body guard with ERRCODE 42501 if NULL · " +
      "rejects NULL/empty/whitespace-space p_attachment_url (22023) · " +
      "writes attachment_type='call_invite' AND attachment_url together " +
      "(closes GB-ATTACH-PAIR by construction). Default-privilege " +
      "residue corrected for service_role this round (anon was already " +
      "stripped in §16.39) · post-apply grants: authenticated + " +
      "postgres only · SQL file patched in place with explicit REVOKE " +
      "… FROM service_role for future-replay consistency. 2 FRESH " +
      "disposable fixtures ADMIN-PROVISIONED (label LANE_G_SANDBOX_" +
      "DISPOSABLE_2026_11_19_MIG356 · NOT email-delivery proof) · IDs " +
      "A nex_account_id=bfcd2a0b-… B=c6ad3b74-…. BATTERY A-G: A anon " +
      "RPC denial PASS (code 42501 at permission boundary) · B NULL " +
      "auth.uid() body guard UNVERIFIED (authenticated-only grants + " +
      "directive forbids weakening controls · SOURCE_INSPECTED only) · " +
      "C supplied-identity mismatch INAPPLICABLE (no supplied-identity " +
      "param in new signature) · C-sub session_not_owned PASS (B " +
      "rejected at 42501 when passing A's session id) · D NULL/blank/" +
      "whitespace URL **PARTIAL FAIL** (null + empty + spaces PASS at " +
      "22023 'attachment_url_required'; tab-newline ACCEPTED and wrote " +
      "a full chain · 1 partial row persisted · new blocker GB-" +
      "WHITESPACE-GUARD opened) · E happy path PASS (session/" +
      "participant/conversation/message all persisted with " +
      "attachment_type='call_invite' AND attachment_url populated · " +
      "both fields verified) · F dedup + bounded concurrent PASS " +
      "(sequential retry + 5 parallel retries all returned " +
      "out_skipped='already_invited' with identical participant id · " +
      "persisted convergence = exactly 1 participant row + 0 duplicate " +
      "messages) · G bounded intermediate fault STATE_BLOCKER (no safe " +
      "mid-chain fault after mig-356; §16.39.5 natural CHECK-violation " +
      "retained as partial Postgres-atomicity evidence only). NEW " +
      "BLOCKER GB-WHITESPACE-GUARD: body guard length(btrim(x))=0 " +
      "strips ASCII space ONLY · tab/newline/CR/FF/VT bypass the pre-" +
      "write guard · TypeScript wrapper _LANE_G_ACCEPT_HREF_PATTERN " +
      "still blocks under normal app flow but direct-RPC bypass is " +
      "possible · low impact (no privilege/cross-account/secret) · " +
      "needs mig-357 using regexp_replace(x,'\\s','','g') or full " +
      "accept_href shape check · NOT authorised this turn. CLEANUP by " +
      "captured IDs: 2 messages + 1 conversation + 2 participants + 2 " +
      "sessions + 2 nex_account rows + 2 auth users deleted · nex_" +
      "account 960→958 (Δ -2 expected) · non-fixture subsets " +
      "sessions/participants/conversations/messages ALL unchanged · " +
      "neighbour invariants hold. GB-ATTACH-PAIR: CLOSED (satisfied " +
      "by construction in mig-356). GB-4CAP: still OPEN (unchanged). " +
      "GB-WHITESPACE-GUARD: OPEN (new). Status remains PARTIAL · " +
      "public-launch verdict STILL CLOSED · BROWSER/PROVIDER/" +
      "PHYSICAL_DEVICE tiers UNVERIFIED this round · integration " +
      "diff + call-site rewire + feature flag all DEFERRED. §16.43 " +
      "Lane G bounded offline batch (2026-11-19): parallel Agent A " +
      "drafted GB-WHITESPACE-GUARD forward correction PREVIEW at " +
      "candidate-migrations/CANDIDATE_nex_group_call_invite_v3_" +
      "whitespace_strict_PREVIEW.sql using the sealed TypeScript " +
      "contract _LANE_G_ACCEPT_HREF_PATTERN (POSIX ERE ~* full-" +
      "anchor match, ERRCODE 22023) with 37/37 offline PASS · " +
      "Agent C investigated GB-4CAP and proposed smallest correction " +
      "PERFORM 1 FROM nex_group_call_session WHERE id=v_session_id " +
      "FOR UPDATE at candidate-migrations/CANDIDATE_nex_group_call_" +
      "4cap_lock_DESIGN_PREVIEW.sql with 4/4 offline model PASS · " +
      "Agent B independent review of A returned PASS with 0 defects " +
      "(30/30 safe-check PASS). Coordinator recommends combining " +
      "both corrections into ONE applied migration at promote-time " +
      "(both edit nex_invite_to_call_tx function body). No commit · " +
      "no push · no apply · no DB touch this turn. GB-WHITESPACE-" +
      "GUARD and GB-4CAP both STILL OPEN at DB boundary · sandbox " +
      "kdstoyyeygcopkogqsyv NOT touched · production " +
      "ijvqdvsvwtwxzcqmoqit sealed. §16.44 Lane G bounded offline " +
      "integration (2026-11-19): coordinator wrote ONE combined " +
      "UNAPPLIED preview at candidate-migrations/CANDIDATE_nex_" +
      "group_call_invite_v4_combined_whitespace_and_4cap_PREVIEW.sql " +
      "merging Agent A's contract-match regex guard with Agent C's " +
      "FOR UPDATE session-row lock (two byte-additive changes · " +
      "rest byte-equivalent to mig-356) · rollback sibling drafted " +
      "with explicit defect-reopen warning. Package B independent " +
      "review returned PASS with 0 defects, SOURCE_REVIEW tier, " +
      "rollback SOUND · but surfaced cap-coverage PARTIAL: 3 direct " +
      "nex_group_call_participant INSERT paths bypass the new lock " +
      "(invite-service.ts:285 createCallInviteOrchestrated HIGH · " +
      "group-call-service.ts:104 createGroupCallSession HIGH · " +
      "group-call-service.ts:178 joinGroupCallSession MEDIUM) · " +
      "mig-133 BEFORE INSERT trigger continues to defend as before. " +
      "Package C extended offline regression 27/27 PASS (12 new " +
      "destination-grammar near-misses + 11 source assertions " +
      "against v4 + 4 concurrency cases) · exit 0 · source " +
      "assertions ran against v4 SQL with lock position + regex " +
      "literal + permission envelope all confirmed. Two source " +
      "previews (v3 + 4cap DESIGN) preserved on disk as traceable " +
      "inputs. GB-WHITESPACE-GUARD still OPEN at DB boundary. " +
      "GB-4CAP still OPEN AND PARTIAL at write surface (closure " +
      "requires separate authorisation: caller rewire to RPC + flag " +
      "flip, OR extend FOR UPDATE to 3 direct-insert sites). No " +
      "commit · no push · no apply · no DB touch · no server " +
      "restart. §16.44.12 verification pass (same date): SHA-256 " +
      "of reviewed snapshot recorded (v4 SQL de77e9a1… · rollback " +
      "7235edc9…) · Package B JSON verified from disk (PASS · 0 " +
      "defects · SOURCE_REVIEW · capCoverage=PARTIAL · rollback=" +
      "SOUND) · Package C JSON verified from disk (27/27 PASS · " +
      "exit 0 · 11 source assertions ran against this SHA). " +
      "STRENGTHENED finding from B's unverifiedNotes: NO live " +
      "caller currently invokes nex_invite_to_call_tx RPC · only " +
      "RPC-calling file is invite-service.transactional-candidate" +
      ".ts (UNAPPLIED candidate behind NEX_INVITE_CALL_TX flag) · " +
      "therefore v4 as a STANDALONE sandbox apply does NOT reduce " +
      "live GB-4CAP exposure · mig-133 trigger's pre-v4 race window " +
      "unchanged for live callers until caller rewire + flag flip " +
      "(separate authorisation) OR FOR UPDATE extension to the 3 " +
      "direct-insert sites (also separate authorisation). Rollback " +
      "assessed SOUND against stated intent · NOT verified recovery " +
      "and NOT a safe production fallback. No third background " +
      "task existed · no duplicate work launched.",
    ledgerAnchor: "#1633_1637_1639_1641_1643_1644",
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
      "User with recent auth confirms destructive intent in a SINGLE-step " +
      "UI form (password + \"DELETE\" phrase + optional reason); the " +
      "6-step workflow runs SERVER-SIDE; account rows marked deleted, " +
      "auth user deleted.",
    entry: "/nex-native/settings/security/delete-account",
    connected: [
      "api/nex-native/security/account/delete/route.ts",
      "account-deletion-service.ts (deleteOwnAccount)",
      "session_revoke_all rate quota (3/hour)",
    ],
    data:
      "nex_account_mark_deleted RPC · nex_security_audit_erase_actor · " +
      "auth.admin.deleteUser",
    status: "PARTIAL",
    evidence: ["SOURCE", "OFFLINE_TESTED"],
    blocker:
      "Anchors landed 2026-11-19 (§16.31) + banner-mapping coverage " +
      "added 2026-11-19 (§16.32) · I-RETRY · I-REALITY · I-OWNER plus " +
      "14 new UI banner-mapping tests all PASS at offline tier. Retry " +
      "after partial soft-delete failure completes end-to-end with " +
      "exactly one .completed audit · auth-delete 'user not found' on " +
      "retry treated as idempotent success · soft-delete failure " +
      "returns ok:false + NEVER calls Auth deleteUser + NEVER emits " +
      ".completed · auth-delete real failure returns ok:false " +
      "auth_delete_failed (partial state visible to caller · not silent " +
      "200) · route-level session-scoping IGNORES body-smuggled " +
      "account_id / ownerAccountId / supabase_user_id · UI friendlyError " +
      "maps every documented error code to a user-visible banner string " +
      "(wrong-password · rate-limited · audit-unavailable · " +
      "audit-completion-failed · soft-delete-failed · auth-delete-" +
      "failed · invalid-JSON · unknown-500 · network-error) + " +
      "no-fetch-on-mount + double-submit-after-success is a no-op. " +
      "TEST-ONLY HARDENING · no product code changed in Lane I this " +
      "round. LANE-SPECIFIC outstanding at BROWSER/PERSISTENCE/PROVIDER " +
      "tier after DB/auth pause lifts: live nex_account_mark_deleted " +
      "RPC side-effects · live nex_security_audit_erase_actor write · " +
      "live auth.admin.deleteUser irreversibility · live " +
      "session_revoke_all 3/hour quota. MUST NEVER be tested on " +
      "Hammerex nex-99901 or Rosa nex-99903.",
    ledgerAnchor: "#1632",
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

   G · calls/preview ──sendCallInviteNotice / sendCallStatusNotice──▶
       sendPeerMessage ──▶ chat/peer bubble
        (module-private INTERNAL_GENERIC_NOTICE_BYPASS symbol · FREEZE
         guard + participant check STILL APPLY · decline body is enum
         "✖ voice/video call declined" · no display_name · routing
         verified §16.29.1 + §16.31 + §16.32).
        G-A DECLINE LIFECYCLE (runtime fix landed §16.33 ·
         OFFLINE_TESTED only · BROWSER/PERSISTENCE UNVERIFIED):
         call/preview?accept=0 now additionally calls
         maybeEndSessionIfAllParticipantsLeft(sessionId) fail-soft.
         When zero participants remain with left_at IS NULL, the
         session row flips to state='ended' + ended_at=now ·
         idempotent re-call is a no-op · multi-participant sessions
         are explicitly PRESERVED (any remaining active participant
         keeps the call alive for the other side). 5 isolated unit
         tests anchor the helper (GA-END-1..5).
        G-B INVITE ATOMICITY (OPEN · UNAPPLIED candidate ready
         §16.33 · BROWSER/PERSISTENCE/PROVIDER UNVERIFIED):
         inviteToCall still performs 4 unwrapped inserts in the
         live code path — nex_group_call_session → participant →
         nex_peer_conversation → nex_peer_message. A late-write
         failure can still leave an orphan session+participant
         with no invite bubble. REVIEWABLE LOCAL CANDIDATE
         (quarantined outside the apply path) at
         nex-supabase/candidate-migrations/C001_... + TS wrapper
         at src/lib/nex-native/calls/invite-service.transactional-
         candidate.ts · 13 mocked-RPC mapping tests anchor the
         wrapper contract as SPECIFICATION ONLY · they do NOT
         prove real DB rollback, concurrency, or persistence. No
         production caller imports the wrapper. No apply script
         sees the SQL. Activation needs separate authorisation
         naming the target DB + feature flag flip.
        G-B ROUND 18 OFFLINE REVIEW (§16.37): authorisation
         surface + transactional envelope + duplicate convergence
         VERIFIED at SOURCE_INSPECTED tier. Honest limitations
         recorded: mig-353 prefix PROVISIONAL (349-352 PROPOSAL
         unapplied) · mig-309 CHECK prerequisite comment owed
         on promotion · 4-cap race in mig-133 trigger NOT fixed
         by SECURITY DEFINER wrapping (GB-4CAP stays mapped to
         generic message_insert_failed) · auth.uid() NULL under
         service_role so sandbox fixtures must sign in via
         password (admin.createUser is ADMIN PROVISIONING, not
         proof of the email-registration journey). Integration
         diff SHAPE drafted offline (§16.37.3): add optional
         selfSupabaseUserId to InviteToCallInput · keep the full
         TS prelude (UUID/rate-limit/attachment-ready/country/
         body) · route the four writes through the RPC behind
         NEX_INVITE_CALL_TX=1 · fall back to the legacy path on
         rpc_unavailable. NOT APPLIED THIS ROUND · no feature
         flag added · no call-site change. Fixture manifest +
         FK cascade trace + narrowly-scoped cleanup (delete by
         captured disposable supabaseUserIds only · never
         prefix-match · never touch Hammerex nex-99901 / Rosa
         nex-99903 / any neighbouring row) specified in
         §16.37.4. Separate verdicts for candidate SQL /
         integration / browser kept distinct in §16.37.8.
        G-B ROUND 18 SANDBOX APPLY (§16.39 · 2026-11-19):
         mig 353 PROMOTED + APPLIED on sandbox
         kdstoyyeygcopkogqsyv. Function nex_invite_to_call_tx
         exists · prosecdef=true · search_path=public,pg_temp ·
         EXECUTE scoped to authenticated+service_role (anon
         stripped by explicit REVOKE after audit caught Supabase
         default-privilege residue). Two fixtures ADMIN-
         PROVISIONED (NOT email-delivery proof) · signed in via
         password. NEW BLOCKER GB-ATTACH-PAIR: function writes
         attachment_type='call_invite' with NO attachment_url ·
         sandbox CHECK requires NULL-pair equivalence · happy-
         path RPC raises 23514 · function body needs a new
         p_attachment_url parameter (unapproved migration
         change) · STOPPED per directive. INCIDENTAL EVIDENCE:
         the CHECK violation acted as natural fault injection ·
         zero orphan sessions/participants/conversations/
         messages observed by direct pg counts · PERSISTED-tier
         rollback atomicity VERIFIED. GB-4CAP KNOWN LIMITATION
         preserved. Cleanup by captured ID complete: 2 accounts
         deleted (Δ -2) · all other counters delta 0 · no
         neighbouring content exposed. BROWSER + PROVIDER +
         PHYSICAL_DEVICE tiers NOT PERFORMED. Item 8 (feature
         flag / call-site integration / activation) remains
         DEFERRED. G-B NOT fully closed · see §16.39.

   ───────────── LANE G · CALL-INVITE SUBGRAPH (§16.45) ─────────────
   Legend  ──>  DASHED (source-inspected · NO browser/persistence)
           ··>  MISSING (node exists but wiring absent/unapplied)
           [GB-4CAP: trig]      direct-admin INSERT · trigger-only
           [GB-4CAP: trig+FU]   RPC v4 · trigger + FOR UPDATE lock
           [GB-WS: v4-UNAP]     POSIX whitespace guard · v4 UNAPPLIED

   ENTRY ROUTES (all DASHED · source-inspected only)
   ┌────────────────────────┐   ┌──────────────────────────┐
   │ /nex-native/call/      │   │ /nex-native/chat/peer/   │
   │  preview?accept=1|0    │   │  [accountId]             │
   │  (callee branch)       │   │ _add-to-call-action      │
   └───────────┬────────────┘   └─────────────┬────────────┘
               │                              │
               │   ┌──────────────────────────┤
               │   │ /nex-native/free-chat/   │
               │   │  call/_live-add-to-call  │
               │   └─────────────┬────────────┘
               │                 │
    ┌──────────┴────────┐        │
    │ _invite-actions   │        │
    │  .ts:41           │        │
    │  inviteToCall()   │        │
    └──────────┬────────┘        │
               │                 │
               ▼                 ▼
    ┌──────────────────────┐  ┌──────────────────────────┐
    │ W1 · inviteToCall()  │  │ W2 · createGroupCall     │
    │ invite-service       │  │  Session()               │
    │  .ts:220 → :287      │  │ group-call-service:54    │
    │ direct admin INSERT  │  │  → loop INSERT :102-117  │
    │ [GB-4CAP: trig]      │  │ [GB-4CAP: trig]          │
    └──────────┬───────────┘  └────────────┬─────────────┘
               │                           │
               │     ┌─────────────────────┤
               │     │ joinGroupCallSession│
               │     │ group-call-svc:152  │
               │     │  UPDATE → fallback  │
               │     │  INSERT :178-186    │
               │     │ W3 [GB-4CAP: trig]  │
               │     │ (no live caller     │
               │     │  grep-confirmed)    │
               │     └────────┬────────────┘
               │              │
               ▼              ▼
   ╔═══════════════════════════════════════════════════════════╗
   ║ TABLE nex_group_call_participant (mig-133)                ║
   ║ BEFORE INSERT TRIGGER nex_group_call_participant_cap_tr   ║
   ║   SELECT COUNT(*) WHERE session_id = NEW.session_id       ║
   ║   RAISE IF cnt >= 4   · counts ALL rows (incl. left_at)   ║
   ║   invariant · 4 rows ever per session (NOT 4 active)      ║
   ║ NO ROW LOCK · race window exists under READ COMMITTED     ║
   ║ (checked-in trigger body · deployed definition UNVERIFIED)║
   ╚═══════════════════════════════════════════════════════════╝
               ▲
               │  trigger fires on ALL 3 writers · same race
               │
   ┌───────────┴─────────────────────────────────────────────┐
   │  CANDIDATE PATHS (NOT WIRED TO ANY LIVE WRITER)         │
   │                                                         │
   │  [NEX_INVITE_CALL_TX flag ··> UNAPPLIED]                │
   │   invite-service.transactional-candidate.ts:102         │
   │    ··> admin.rpc("nex_invite_to_call_tx")               │
   │        (header: "Production code does NOT import        │
   │         this file")                                     │
   │                                                         │
   │   RPC nex_invite_to_call_tx                             │
   │    mig-356 applied to sandbox kdstoyyeygcopkogqsyv      │
   │    (CANDIDATE_APPLIED_UNWIRED · no TS caller)           │
   │                                                         │
   │   v4 combined body (CANDIDATE_UNAPPLIED)                │
   │    [GB-WS: v4-UNAP]   POSIX !~* guard                   │
   │    [GB-4CAP: trig+FU] PERFORM 1 FROM                    │
   │                       nex_group_call_session            │
   │                       WHERE id = v_session_id           │
   │                       FOR UPDATE;                       │
   │    · lock covers RPC callers ONLY                       │
   │    · DOES NOT cover W1/W2/W3 direct-admin paths         │
   │    · standalone application does NOT remediate          │
   │      current caller coverage                            │
   │    SHA de77e9a19eb49df85433bf66969b87a44b05885b302a2    │
   │        3559e76134b799bfea7                              │
   └─────────────────────────────────────────────────────────┘

   GAP SUMMARY · source-review ceiling · DB/browser UNVERIFIED
     · GB-WHITESPACE-GUARD OPEN (v4 UNAPPLIED at DB boundary)
     · GB-4CAP OPEN · PARTIAL even if v4 applied
       (no live caller invokes RPC · W1/W2/W3 stay lock-less)
     · Case B (NULL auth.uid fail-closed) UNVERIFIED
     · Case G (intermediate-write fault) STATE_BLOCKER
     · supplied-identity mismatch INAPPLICABLE

   EVIDENCE · Package D coverage matrix at
     tmp-lane-g/33-cap-coverage-matrix.{md,json}
     Package E node/edge inventory at
     tmp-lane-g/34-diagram-inventory.md
     Preserve §16.44.12 verification receipts · see §16.45.

   ──────────────────────────────────────────────────────────────
   LANE G · STAGED v5 IMPLEMENTATION (§16.46)
   ──────────────────────────────────────────────────────────────

   LEGEND (addendum):
     [STAGED · UNWIRED · default-off]  = on-disk candidate, no
                                         live import, no DB apply,
                                         no flag flip
     ··>   MISSING_IMPLEMENTATION       = would be the activating
                                         edge; not present

   ┌──────────────────────────────────────────────────────────────┐
   │ v5-W1 · invite RPC declaration                               │
   │   nex-supabase/candidate-migrations/                         │
   │     CANDIDATE_nex_call_invite_rpc_v5_w1_PREVIEW.sql          │
   │     SHA ec972d21c5de69839096c1534540dd7ffeda2a08574c23070b93 │
   │         929e9c27d524                                         │
   │   Declares v4 (SHA de77e9a19eb49df8…) as the W1 RPC body.    │
   │   No new DDL. Operator applies v4 as-is.                     │
   │   Wrapper: src/lib/nex-native/calls/                         │
   │     invite-service.v5-candidate.ts                           │
   │     [STAGED · UNWIRED · default-off]                         │
   │   Signature preserves inviteToCall contract · 7-param RPC.   │
   │                                                              │
   │ v5-W2 · session-create RPC (ADDS alongside v4)               │
   │   nex-supabase/candidate-migrations/                         │
   │     CANDIDATE_nex_call_session_create_rpc_v5_w2_PREVIEW.sql  │
   │     SHA 51cb55863636a8b23f4c825646f5eeb980159493cedef7b36aea │
   │         44154d4344db                                         │
   │   RPC nex_create_group_call_session_tx                       │
   │     (p_media_type TEXT, p_from_call_link_id UUID,            │
   │      p_host_country TEXT, p_invitee_account_ids UUID[])      │
   │     RETURNS (out_session_id, out_participants,               │
   │              out_rejected_count) · SECURITY DEFINER          │
   │   NEW session · no FOR UPDATE needed (not yet published).    │
   │   Wrapper: src/lib/nex-native/calls/                         │
   │     group-call-service.v5-candidate.ts                       │
   │     [STAGED · UNWIRED · default-off]                         │
   │                                                              │
   │ v5-W3 · join RPC (ADDS alongside v4)                         │
   │   nex-supabase/candidate-migrations/                         │
   │     CANDIDATE_nex_call_participant_join_rpc_v5_w3_PREVIEW.sql│
   │     SHA 375fc243fd87bfab75c074824b29007518f84c868f588a6d92e0 │
   │         18fc5a0802b9                                         │
   │   RPC nex_join_group_call_session_tx                         │
   │     (p_session_id UUID, p_role TEXT DEFAULT 'guest')         │
   │     RETURNS (out_participant_id, out_was_update,             │
   │              out_session_promoted) · SECURITY DEFINER        │
   │   FOR UPDATE on session row → UPDATE-first → INSERT fallback │
   │   Role guard rejects anything outside ('host','guest') at    │
   │   22023 BEFORE INSERT · mig-133 CHECK unchanged.             │
   │   Wrapper: src/lib/nex-native/calls/                         │
   │     group-call-join.v5-candidate.ts                          │
   │     [STAGED · UNWIRED · default-off]                         │
   └──────────────────────────────────────────────────────────────┘

   Live routes still take the pre-v5 path:

     _invite-actions.ts:41           ──> inviteToCall           (W1 live)
       ··> (MISSING) inviteToCallV5Candidate                    (unwired)

     _live-add-to-call-action.ts:70  ──> createGroupCallSession (W2 live)
     _add-to-call-action.ts:55       ──> createGroupCallSession (W2 live)
       ··> (MISSING) createGroupCallSessionV5Candidate          (unwired)

     (no grep-confirmed live caller) ··> joinGroupCallSession   (W3)
       ··> (MISSING) joinGroupCallSessionV5Candidate            (unwired)

   AUTH MODEL · identity derives from auth.uid() → nex_account.id
     server-side inside every v5 RPC body; no caller-supplied
     p_self_supabase_user_id / p_host_account_id / p_account_id.
     42501 fail-closed on NULL uid or account-not-found.
     REVOKE from PUBLIC/anon/service_role · GRANT to authenticated.

   SUPERSEDE / INCORPORATE
     v5-W1 INCORPORATES v4 (declares it as W1 RPC body · no DDL).
     v5-W2 ADDS alongside v4 (different function, different scope).
     v5-W3 ADDS alongside v4 (different function, different scope).
     v4 pair SHA preserved · mig-133 unchanged.

   INDEPENDENT REVIEW (Package I) · 2026-11-19
     12 files · 20 security/semantic checks per package.
     Vitest 3 files · 51 tests · exit code 0 · 357 ms.
     Per-package verdict: W1 PASS · W2 PASS · W3 PASS.
     No fixes required.
     Report: tmp-lane-g/35-review-v5-combined.{md,json}.

   STAGED STATE (not promoted):
     · No live caller imports any v5 wrapper.
     · NEX_INVITE_CALL_TX NOT flipped.
     · No SQL applied to any database.
     · No commit · no push · no deploy.
     · Prod ijvqdvsvwtwxzcqmoqit hard-refused.

   NEXT GATE (owner-held, not executed):
     Sandbox apply scope to be authorised separately · target
     kdstoyyeygcopkogqsyv · migration identity + grants + cleanup
     permissions + rollback bounds to be named in that gate.

   ──────────────────────────────────────────────────────────────
   LANE G · GATE A PREPARATION MANIFEST (§16.47)
   ──────────────────────────────────────────────────────────────

   PROVISIONAL migration identities (owner approval required · final
   numbers assigned after sandbox nex_migration_history inspection):

     MIG-A · provisional 357_nex_group_call_invite_v4_combined.sql
       Source: CANDIDATE_nex_group_call_invite_v4_combined_
               whitespace_and_4cap_PREVIEW.sql
       SHA     de77e9a19eb49df8…
       RPC     nex_invite_to_call_tx(UUID,TEXT,TEXT,JSONB,
                                     TEXT,TEXT,UUID DEFAULT NULL)
               RETURNS 5 cols incl out_skipped TEXT
       Note    v5-W1 DECLARATION incorporates this · no separate
               W1 migration · applying both would attempt a
               duplicate DROP+CREATE

     MIG-B · provisional 358_nex_create_group_call_session_tx.sql
       Source: CANDIDATE_nex_call_session_create_rpc_v5_w2_
               PREVIEW.sql
       SHA     51cb55863636a8b2…
       RPC     nex_create_group_call_session_tx(TEXT,UUID,TEXT,
                                                UUID[])
               RETURNS 3 cols

     MIG-C · provisional 359_nex_join_group_call_session_tx.sql
       Source: CANDIDATE_nex_call_participant_join_rpc_v5_w3_
               PREVIEW.sql
       SHA     375fc243fd87bfab…
       RPC     nex_join_group_call_session_tx(UUID,
                                              TEXT DEFAULT 'guest')
               RETURNS 3 cols

   APPLY METHOD RECOMMENDED · P2 · promote to numbered
   migrations/N_*.sql with per-migration
   scripts/apply-migration-N-sandbox.mjs pinning
   CANONICAL_PROJECT_REF = "kdstoyyeygcopkogqsyv"
   (model: apply-migration-258.mjs:54-60 ref-guard).

   GRANT ENVELOPE CAVEATS (negative-authorization checks the
   connected gate MUST run):
     · SQL REVOKE blocks DIRECT invocation only · does not disable
       table-level service_role writes
     · SECURITY DEFINER runs as function owner · auth.uid() guard
       is the load-bearing caller-identity constraint, not ACL
     · Role inheritance not assumed · verified with
       has_function_privilege() probes 1-8 (ledger §16.47.6)

   CAP-COVERAGE REALITY POST-APPLY (EVEN AFTER GATE A):
     · MIG-A applied without caller rewiring = v4 RPC exists but
       W1 live caller (invite-service.ts:287) still direct-INSERTs
       · GB-4CAP still OPEN at activated-tier
     · MIG-B · MIG-C same · wrappers remain default-off
     · Gate B wiring required before GB-4CAP closes at
       activated-caller tier

   GATE SEPARATION (ledger §16.47.9):
     GATE A · sandbox apply + connected verification matrix
              (V-DEP-* · V-GRANT-* · V-AUTH-* · V-W1-* · V-W2-* ·
               V-W3-* · V-ATOMIC · V-ROLLBACK-*)
     GATE B · wrapper wiring + flag flip + authenticated journey
              checks · ONLY after Gate A evidence reviewed · NOT
              implied by Gate A approval

   EVIDENCE-TIER STATUS (§16.47.10):
     SOURCE                 VERIFIED (12 files · SHA-pinned)
     UNIT                   VERIFIED (vitest 51/51 exit 0)
     CONNECTED SQL deploy   UNVERIFIED (Gate A dep)
     CONNECTED SQL behav.   UNVERIFIED (Gate A dep)
     ACTIVATED CALLERS      UNVERIFIED (Gate B dep)
     BROWSER/PERS/PROV/DEV  UNVERIFIED
     FOUNDER WALKTHROUGH    UNVERIFIED
     PUBLIC LAUNCH          NOT READY

   PRESERVED BLOCKERS:
     · GB-WHITESPACE-GUARD  OPEN
     · GB-4CAP              OPEN
     · Case B               UNVERIFIED (will be addressed V-AUTH-*)
     · Case G               STATE_BLOCKER (V-ATOMIC gives indirect
                            evidence only · does not satisfy)
     · W3 live caller       NOT grep-found · W3 severity
                            THEORETICAL until identified

   GATE A REQUEST (ledger §16.47.11):
     11 named terms (target · preflight · numbering · file moves ·
     apply scope · grant verify · test matrix · cleanup permission ·
     rollback bounds · hard refusals · expected handback).
     See RECONCILIATION-LEDGER-2026-11-18.md §16.47.11 for verbatim.

   ──────────────────────────────────────────────────────────────
   LANE G · GATE A EXECUTION HANDBACK (§16.48 · 2026-11-19)
   ──────────────────────────────────────────────────────────────

   TARGET (verified every step):
     sandbox kdstoyyeygcopkogqsyv · production ijvqdvsvwtwxzcqmoqit
     SEALED · no commit · no push · no deploy · no caller wiring ·
     no NEX_INVITE_CALL_TX flip · no credential/env/auth-setting
     change · no protected-account change · no D:/trades access.

   MIGRATIONS APPLIED (sandbox only · exit-0 or recovery-recorded):
     357 · nex_invite_to_call_tx        CONNECTED SQL VERIFIED
         body sha256 live = 2eeb6ec0fcbd5580… = pinned source
         sig public.nex_invite_to_call_tx(uuid,text,text,jsonb,
                                          text,text,uuid)
         SECURITY DEFINER · search_path=public,pg_temp · owner=postgres
         priv anon=F · service_role=F · authenticated=T · PASS
         auth.uid() fail-closed · SQLSTATE 42501
                                  caller_identity_required
         history applied_at = 2026-11-19 21:11:01+07
     358 · nex_create_group_call_session_tx  CONNECTED SQL VERIFIED
         body sha256 live = e4c53f3287a126d8… = pinned
         sig public.nex_create_group_call_session_tx(text,uuid,
                                                      text,uuid[])
         SECURITY DEFINER · search_path OK · owner=postgres
         priv matrix PASS · history 2026-11-19 21:11:13+07
     359 · nex_join_group_call_session_tx    CONNECTED SQL VERIFIED
         body sha256 live = 9de0f26ddb592049… = pinned
         sig public.nex_join_group_call_session_tx(uuid,text)
         SECURITY DEFINER · search_path OK · owner=postgres
         priv matrix PASS · history 2026-11-19 21:11:20+07

   HISTORY-INSERT INCIDENT + REPAIR (§16.48.2):
     First 357 apply committed DDL but raised SQLSTATE 23502 on the
     apply-script history INSERT (missing non-null 'description'
     column). Owner-authorised bounded repair of all three apply
     scripts; 'description' + 'notes' now supplied, matching
     migrations 353/356/315 style. 357 history row inserted only
     AFTER body sha256 confirmed byte-match with pinned source.

   PREFLIGHT (00_preflight.sql · 24 checks):
     CONNECTED SQL VERIFIED · 24/24 PASS
     First invocation halted at 'role PUBLIC does not exist'
     from has_function_privilege('PUBLIC', …). Owner-authorised
     narrow transfer of ownership for checks 22/23/24 only;
     replaced with aclexplode(COALESCE(p.proacl, acldefault('f',
     p.proowner))) filtered on grantee=0 AND
     privilege_type='EXECUTE'. NULL proacl → fails (default ACL
     includes PUBLIC EXECUTE). Each RPC pinned by
     pg_get_function_identity_arguments; missing function fails
     (no NOT-EXISTS short-circuit). Expected values unchanged.

   GRANTS (10_grants.sql · 17 rows):
     CONNECTED SQL VERIFIED · proacl {postgres=X/postgres,
     authenticated=X/postgres} on all three RPCs. No PUBLIC, no
     anon, no service_role grantee. RLS on
     nex_group_call_session + nex_group_call_participant enabled
     with scoped insert/select/update policies anchored to
     auth.uid() → nex_account.supabase_user_id.

   SUPPORTED-AUTH SIGNUP (20_signup_disposable_identities.mjs):
     ROUND 1 (.invalid TLD) · BLOCKED · exit 1
       A · HTTP 400 (Email address is invalid)
       B · HTTP 400 (Email address is invalid)
       C · HTTP 429 (email rate limit exceeded)
     ROUND 2 (owner-approved Gmail candidates) · BLOCKED · exit 1
       A · <op-email>                     ATTEMPTED · HTTP 429
                                          (email rate limit exceeded)
       B · <op-email+1>                   SKIPPED (never attempted;
                                          harness cascade-skipped
                                          after A 429)
       C · <op-email+2>                   SKIPPED (never attempted;
                                          harness cascade-skipped
                                          after A 429)
     Round 2 replaced the .invalid generator in source with the
     owner-approved Gmail candidates but did NOT verify Gmail
     acceptance. A 429 at the email rate-limit gate does not
     establish that Supabase Auth's domain-validation gate was
     reached or passed. Round 1 .invalid rejection remains the
     only observed domain-axis evidence. RATE-LIMIT blocker
     persists · actual reset window NOT independently verified
     (supabase-js does not surface a Retry-After header; no
     quota value or reset time was observed). No admin API, no
     auth-setting change, no identity rotation to evade. Gmail
     inbox NOT polled, confirmation link NOT clicked,
     waitForEmailConfirm helper NEVER invoked. Re-probe after
     A 429 confirmed 0 rows created for all three candidates —
     sandbox state unchanged.
     B-SIGNUP-DOMAIN · UNVERIFIED (Gmail acceptance not shown).
     CANDIDATE DISTINCTNESS (Gmail plus-alias = distinct
     auth.users row?) · NOT observed · B and C never attempted ·
     remains OPEN.

   V-* CONNECTED MATRIX (22 behavioural cases) · ALL BLOCKED
     no supported-auth identities · runner halted after step 20
     per stop-on-first-FAIL policy · partial-coverage caveat
     preserved (V-W1-CAP · V-W1-CAP-RACE · V-W2-OVER · V-W3-CAP ·
     V-W3-RACE · V-ATOMIC degrade to PARTIAL even on full 3-id
     signup; require 5 identities to fully exercise 4-cap).

   V-ROLLBACK-A/B/C · UNVERIFIED · not invoked (no apply failure).

   CLEANUP (90_cleanup · exact-ID only):
     NO-OP · signUp never created user rows · 0 retained
     auth.users / nex_account / nex_group_call_session /
     nex_group_call_participant rows for the candidate pattern.
     No pre-existing identities touched. No prefix-wide or
     table-wide deletes.

   EVIDENCE-TIER STATUS (§16.48.9):
     SOURCE                 VERIFIED (12 pinned files)
     UNIT                   VERIFIED (vitest 51/51 exit 0)
     CONNECTED SQL deploy   VERIFIED (357 · 358 · 359 · preflight
                                      · grants)
     CONNECTED SQL behav.   BLOCKED  (22 V-* cases · supported-
                                      auth signup rate-limited)
     ACTIVATED CALLERS      UNVERIFIED (Gate B dep · W3 still has
                                       no live caller)
     BROWSER/PERS/PROV/DEV  UNVERIFIED (not attempted · outside
                                       Gate A scope)
     FOUNDER WALKTHROUGH    UNVERIFIED
     PUBLIC LAUNCH          NOT READY

   REMAINING BLOCKERS (§16.48.11):
     · GB-4CAP-DIRECT      OPEN · function REVOKE does not close
                                  table-level service_role writes
     · W3 live caller      OPEN · no src/ import; wrappers off
     · Case G              STATE_BLOCKER · no PL/pgSQL mid-
                                  function fault-injection hook
     · B-SIGNUP-DOMAIN     UNVERIFIED (round 2 · 429 before
                                       validation confirmed;
                                       B/C SKIPPED)
     · B-SIGNUP-RATE       OPEN · HTTP 429 persists · actual
                                  reset window not independently
                                  verified; retry is owner-paced
     · Candidate-distinctness  OPEN · plus-alias → distinct
                                  auth.users not yet observed
     · Live UI / browser / STUN-TURN / physical-device  OPEN

   GATE A CONCLUSION:
     Engineering ceiling achieved for DDL + preflight + grants
     (VERIFIED). Behavioural matrix remains BLOCKED on supported-
     auth signup rate-limit. Gate B remains SEPARATELY GATED and
     requires (a) ≥3 distinct successful supported-auth signups,
     (b) connected V-* matrix execution with per-case evidence,
     (c) Case G resolution. Public launch remains NOT READY.

   PASSWORD RELAY OFFLINE REPAIR (§16.48.13 · 2026-11-19):
     Offline-fixed only · connected verification pending.
     Parent _runner.mjs now generates DISPOSABLE_PASSWORDS A/B/C
     via randomBytes(24).toString(base64url).slice(0,32), held in
     parent memory only, and passes them to the child through a
     new buildChildEnv() env map at the spawnSync call site.
     Child 20_signup_disposable_identities.mjs consumes
     GATE_A_TEST_PASSWORD_{label} and calls exit(2) fail-closed
     BEFORE any Supabase client build if any label is missing or
     empty; the misleading child-side env write was removed.
     Tests: node --check on all 4 touched files exit 0; vitest
     scripts/gate-a-connected-matrix/__tests__ exit 0 · 4 files ·
     82 tests · 365 ms (20_signup 15 · 90_cleanup 15 · v_scripts
     24 · relay 28 new). New relay.spec.mjs covers positive
     relay, A/B/C distinctness, signup consumes supplied value,
     fail-closed before Auth/DB, credential-leak scan with
     DUMMY-RELAY-SENTINEL assertions, and old-pattern regression.
     Invariants preserved: sandbox pin kdstoyyeygcopkogqsyv ·
     production refusal of ijvqdvsvwtwxzcqmoqit · signUp-only ·
     stop-on-first-FAIL cascade · 3-identity limit ·
     90_cleanup.mjs exact-ID semantics untouched.
     This repair does NOT move any V-* verdict: all 22 remain
     BLOCKED, B-SIGNUP-DOMAIN remains UNVERIFIED (round 2 · 429
     before validation; B/C SKIPPED), and no rate-limit reset
     time is claimed. Follow-on §16.48.14 will capture run_id
     relay + cleanup-provenance results once merged integration
     tests run.

   RUN ID RELAY + CLEANUP PROVENANCE (§16.48.14 · 2026-11-19):
     Run ID relay: offline-fixed, connected verification
     pending. Cleanup protection: offline-fixed, connected
     unverified. Parent _runner.mjs adds randomUUID to its
     node:crypto import (L21), generates GATE_A_RUN_ID at
     L137-146, stamps results.run_id at L150, and propagates
     the value through buildChildEnv() at L219. Child
     20_signup_disposable_identities.mjs fail-closes with
     exit(2) at L98-109 if GATE_A_RUN_ID is missing or empty,
     BEFORE any createClient or pg.Client.connect() call;
     capture payload (L287-317) now carries run_id,
     created_at, and created_fixtures[] entries of shape
     (label, supabase_user_id, dependent_rows[(table, id,
     owner_user_id)]) with BLOCKED labels contributing no
     entry. 90_cleanup.mjs restructured to ~400 lines (was
     ~223): new exported pure validateCleanupPlan() with
     main() gated behind an isMain check, so test import has
     zero side effects (no createClient, no pg.Client
     construction). Validation enforces: run_id must match
     capture.run_id exactly; created_at within a 6-hour
     freshness window and not more than 60s in the future;
     every candidate ID well-formed UUID, unique, and present
     in current-run created_fixtures; dependent owner_user_id
     maps to a supabase_user_id from the same run; a frozen
     denylist (Hammerex 11111111-1111-4111-8111-111111111111
     and Rosa 11111111-1111-4111-8111-111111111113) is
     hard-coded and empty denylist is treated as refusal;
     empty or missing or malformed capture refuses rather
     than silently doing nothing; retained_rows alone is
     never sufficient. Preserved: original DELETE order,
     sandbox pin, production refusal, pooler pattern,
     id = ANY($1::uuid[]) exact-ID semantics, and auth.users
     / nex_account are NEVER deleted. Tests: node --check on
     9 files (3 harness + 6 spec) all exit 0; vitest run of
     scripts/gate-a-connected-matrix/__tests__ exit 0 with
     6 files and 133 tests passed in 523 ms (merged run
     authoritative; agent self-report breakdown
     20_signup 15, 90_cleanup 15, v_scripts 24, relay 28,
     runid 21, cleanup-provenance 31 sums to 134, with the
     1-count drift noted explicitly in the ledger). New
     runid.spec.mjs (21 self-reported) covers randomUUID
     import, fail-closed ordering before Auth and DB,
     capture-contract shape, credential-leak scan, and a
     spawnSync behavioural stub-probe proving createClient
     and pg.Client are never invoked when GATE_A_RUN_ID is
     absent. New cleanup-provenance.spec.mjs (31
     self-reported) covers approved current-run path,
     mismatched run_id, stale and future-dated captures,
     empty and missing and malformed captures, duplicate and
     foreign and orphaned IDs, denylisted IDs, retained_rows
     alone, and zero-side-effect import proven three ways
     (isMain guard, single new pg.Client( site after
     main(), and a call-site walk). Existing
     90_cleanup.spec.mjs stays green with one assertion
     strengthened (validateCleanupPlan exported and used
     from both SKIP and DELETE branches). tsc --noEmit
     attributes 0 errors to this journey-map file. This
     repair does NOT move any V-* verdict: all 22 remain
     BLOCKED, B-SIGNUP-DOMAIN remains UNVERIFIED (round 2 ·
     429 before validation; B/C SKIPPED), B-SIGNUP-RATE
     remains OPEN with no reset time claimed, and no
     connected sandbox or production call was issued.

   TWO-IDENTITY (A/B-ONLY) ADAPTATION (§16.48.15 · 2026-11-19):
     Disposable identity C is parked in a new two-identity
     mode; three-identity mode (A/B/C) remains available
     unchanged. Mode is selected by the environment variable
     GATE_A_IDENTITY_MODE at process start — (unset) or
     "three" behaves exactly as before, "two" restricts the
     harness to A/B only, any other value fail-closes with
     exit code 2 and does not log the raw value. The .env.local
     file is NOT edited (per owner prohibition on env-file
     changes). _runner.mjs L16-39 guards the mode; L139-150
     derives IDENTITY_LABELS; L203-219 buildChildEnv()
     propagates GATE_A_IDENTITY_MODE and GATE_A_RUN_ID to each
     child alongside only the in-scope
     GATE_A_TEST_PASSWORD_{label} values. The signup child
     (20_signup_disposable_identities.mjs L73-87, L106, L167,
     L316, L340, L363, L370-377) reads the same mode variable,
     applies the same grammar, derives identityLabels via
     ternary, iterates only the in-scope labels for credential
     fail-closed/signup/confirm-wait/sign-in/capture/verdict,
     stamps capture.identity_mode, and computes the verdict
     against expectedCount = identityLabels.length (PASS when
     all in-scope labels sign up, PARTIAL when >=1 and
     <expected, FAIL otherwise). V-* dispatch consults
     _v-star-eligibility.generated.json to classify all 21 V-*
     scripts: 9 ELIGIBLE (A or A+B), 4 BLOCKED_NEEDS_C,
     6 BLOCKED_NEEDS_MORE_THAN_3, 2 MIXED. BLOCKED and MIXED
     cases are dispatched directly to verdict BLOCKED with the
     recorded reason — they are NOT cascaded as FAIL and NOT
     attempted with a substituted identity. node --check passes
     on all touched files; vitest offline suite is 7 files /
     184 tests, all passing (20_signup=15, 90_cleanup=15,
     v_scripts=24, relay=28, runid=20, cleanup-provenance=31,
     two-mode=51). tsc --noEmit attributes 0 errors to this
     journey-map file. Invariants preserved: sandbox pin
     kdstoyyeygcopkogqsyv, production refusal of
     ijvqdvsvwtwxzcqmoqit, signUp-only, password relay
     semantics (§16.48.13) and run_id/provenance semantics
     (§16.48.14) intact in both modes, disposable-identity
     denylist unchanged in 90_cleanup.mjs. This adaptation
     does NOT move any V-* verdict: all 22 behavioural
     scenarios remain BLOCKED, B-SIGNUP-DOMAIN remains
     UNVERIFIED, B-SIGNUP-RATE remains OPEN, Gate B remains
     separately gated, and no connected sandbox or production
     call was issued. Status: two-identity adaptation
     offline-adapted, connected unverified — not RESOLVED.

   BREVO / SMTP RESEARCH + RE-VERIFICATION (§16.48.16 · 2026-11-19):
     Three parallel offline owners (EMAIL, HARNESS, EVIDENCE)
     produced a research + re-verification pass. No connected
     sandbox or production call was issued in this entry. No
     Brevo account created. No DNS inspected or changed. No
     Supabase Studio login attempted. No .env.local change. No
     migration, RLS, grant, SMTP, rate-limit or billing change.
     No commit, no push, no deploy. Production ref
     ijvqdvsvwtwxzcqmoqit remains sealed. Sandbox ref
     kdstoyyeygcopkogqsyv was not touched.

     Status-tier vocabulary (new, formally introduced for §16.48):
     OFFLINE-TESTED (source + unit + mocked integration, vitest
     green) · SETTINGS-SAVED (Supabase Studio has Brevo SMTP
     fields saved) · DOMAIN-VERIFIED (Brevo dashboard shows
     DKIM + Brevo Code + merged SPF green) · PROVIDER-ACCEPTED
     (250 from Brevo on a test send) · INBOX-RECEIVED (test
     email in owner mailbox) · CONNECTED-PASS (at least one
     ELIGIBLE V-* script passed end-to-end on sandbox) · FAIL
     (connected evidence contradicts intended behaviour) ·
     BLOCKED (prerequisite not met, not attempted) · UNVERIFIED
     (no connected evidence either way). Existing Legend tiers
     (PERSISTED, BROWSER, UNIT, SOURCE) preserved unchanged.

     Email provider pipeline: OFFLINE-RESEARCHED-ONLY.
     SETTINGS-SAVED, DOMAIN-VERIFIED, PROVIDER-ACCEPTED,
     INBOX-RECEIVED, CONNECTED-PASS — NONE achieved. Brevo
     free plan verified card-free at signup with 300/day after
     approval; SMTP relay available on free tier; ports 587/2525
     STARTTLS or 465 SSL/TLS; SMTP key required (not API key).
     Supabase 30/hr custom-SMTP cap confirmed (docs phrasing
     "messages per hour" vs "new users per hour" conflict noted
     verbatim, not silently resolved). Supabase does not auto-
     change confirmation policy when SMTP is swapped. Supabase
     does not enforce sender/domain verification itself
     (Brevo does). The literal host string smtp-relay.brevo.com
     is owner-recalled but was NOT quotable from any Brevo page
     that successfully loaded; help.brevo.com articles returned
     HTTP 403 to automated fetch. Owner must confirm host string
     and copy DKIM/Brevo Code/SPF include token verbatim from
     live Brevo dashboard at signup time. SMTP key, SMTP login,
     verification codes, and DKIM/Brevo Code values must NEVER
     be pasted in chat.

     Two-identity harness re-verification: OFFLINE-TESTED
     (re-confirmed). node --check passes on all touched .mjs
     files. vitest run: 7 Test Files passed / 184 Tests passed,
     authoritative per-spec (20_signup=15, 90_cleanup=15,
     v_scripts=24, relay=28, runid=20, cleanup-provenance=31,
     two-mode=51). Zero drift from §16.48.15 baseline. All 10
     implementation checks pass with file:line evidence
     (mode grammar + exit-2-without-printing-raw-value in both
     parent and signup child, identityLabels ternary, buildChildEnv
     relay of GATE_A_IDENTITY_MODE and GATE_A_RUN_ID, missing-
     password loop mode-scoped, expectedCount verdict,
     capture.identity_mode written, spawnSync uses buildChildEnv,
     skip-branch returns BLOCKED not FAIL).

     21-row eligibility table extracted verbatim from
     __tests__/_v-star-eligibility.generated.json: 9 ELIGIBLE
     (30/31/32_v_auth_*, 40_v_w1_new, 44_v_w1_whitespace,
     45_v_w1_dup, 53_v_w2_auth, 60_v_w3_update, 65_v_w3_promote)
     · 4 BLOCKED_NEEDS_C (41_v_w1_exist, 50_v_w2_ok, 52_v_w2_dup,
     66_v_w3_nopromote) · 6 BLOCKED_NEEDS_MORE_THAN_3
     (42_v_w1_cap, 43_v_w1_cap_race, 51_v_w2_over, 63_v_w3_cap,
     64_v_w3_race, 70_v_atomic) · 2 MIXED → BLOCKED
     (61_v_w3_insert, 62_v_w3_role). File-by-file label grep
     confirms: zero CLASSIFICATION-CONFLICT rows; ELIGIBLE paths
     contain no idC/idD/idE reads; BLOCKED_NEEDS_C and NEEDS_MORE
     paths contain reachable idC/idD/idE reads; MIXED carry both
     a primary A+B path and a C-fallback path, whole-script
     verdict correctly held at BLOCKED per owner directive. No
     silent weakening of assertions.

     21-vs-22 scenario asymmetry: unresolved. The 22-count
     lives in handback prose; the repo's single source of truth
     enumerates 21 files. Most likely 22nd scenario is one of
     the rollback scripts 80/81/82_v_rollback_* which are
     excluded from the forward run AND absent from the
     eligibility file — 82_v_rollback_c plausibly re-introduces
     a C-demand if ever dispatched in two-mode. Secondary
     possibility: a cap script carries two behavioural scenarios
     in one file. Cannot be determined from repo contents
     alone; a committed _v-star-scenarios.generated.json mapping
     scenario-to-script would close the gap.

     Demonstrated gaps (NOT fixed in this entry; await separate
     named authorisation):
       (1) GAP-DISPATCH-DEFAULT-ELIGIBLE · _runner.mjs
           L394–L416 skip-branch only matches three literal
           status tokens; an entry with undefined, missing, or
           typo two_mode_status falls through to normal dispatch
           and is silently ELIGIBLE. Owner's prompt specifically
           asked that missing/malformed entries fail closed; the
           current implementation does NOT. Hardening would need
           a positive allowlist or terminal else=BLOCKED branch.
       (2) GAP-21-VS-22-SCENARIO-COUNT · no committed
           scenario-to-script map.
       (3) GAP-ROLLBACK-EXCLUDED-FROM-CLASSIFICATION · 80/81/82
           not classified for two-mode behaviour.
       (4) GAP-SPAWNSYNC-ENV-SURFACE · buildChildEnv uses
           raw {...process.env} spread with no allow-list;
           stale parent env forwarded to children.
       (5) GAP-TWO-MODE-COMMENT-DRIFT · doc comments retain
           A/B/C framing where code is mode-aware. Cosmetic.

     Invariants preserved: sandbox pin; production refusal;
     signUp-only; rate-limit cascade semantics in both modes;
     password relay (§16.48.13), run_id relay (§16.48.14),
     two-identity adaptation (§16.48.15) byte-for-byte
     unchanged; Hammerex/Rosa denylist unchanged; 90_cleanup
     provenance guard still refuses on run_id mismatch,
     freshness breach, UUID malformation, duplicate, orphan,
     or denylist hit; no production, migration, RLS, grant,
     SMTP, rate-limit, billing, or .env.local change; no
     commit, push, or deploy; no running services touched;
     D:/trades untouched; Hammerex, Rosa, founder session
     untouched; SEO parked; no callers or activation flags
     changed.

     Carried blockers: B-SIGNUP-DOMAIN remains UNVERIFIED
     (round 2 · 429 before validation confirmed; B/C SKIPPED).
     B-SIGNUP-RATE remains OPEN; no reset time claimed.
     Candidate-distinctness (plus-alias) remains OPEN. All 22
     V-* behavioural scenarios remain BLOCKED (22-vs-21
     asymmetry noted and unresolved). Case G remains
     STATE_BLOCKER. GB-4CAP-DIRECT, W3 live-caller provenance,
     browser/provider/device evidence all remain OPEN. Gate B
     separately gated. Public launch readiness: NOT READY.

     Precise remaining owner actions (NOT already-authorised
     offline work · each requires its own named authorisation):
     Brevo signup (card-free), Brevo domain authentication,
     DNS records merged (SPF merged not appended) at owner's
     DNS provider, Brevo approval wait, Brevo SMTP key
     generation, Supabase sandbox Studio SMTP Save
     (kdstoyyeygcopkogqsyv), Supabase sandbox Rate-Limits
     read-only baseline capture, separate named authorisation
     for GAP-DISPATCH-DEFAULT-ELIGIBLE fix or acceptance,
     separate named authorisation for bounded connected
     two-mode run against the 9 ELIGIBLE scripts (the earlier
     pause on signup retries and connected runner STANDS), and
     separate named authorisation for 90_cleanup after any
     connected run. A successful SMTP change, a successful
     9-script connected run, or both, does NOT clear the
     22-scenario matrix, does NOT resolve Case G / GB-4CAP /
     W3 caller / browser-provider-device, does NOT unblock
     Gate B, and does NOT mark public launch READY.

   BOUNDED FORWARD-RUN SCOPE FIX (§16.48.17 · 2026-11-19→20):
     Resolved the handback discrepancy that said cleanup
     "will be skipped" in a bounded A/B/C probe while
     90_cleanup.mjs remained in MJS_FILES and reachable
     through the two-mode INFRA bypass. The fix is now
     enforced in code, not comment. Status tier: OFFLINE-TESTED.

     Code (scripts/gate-a-connected-matrix/_runner.mjs):
     (1) GATE_A_BOUNDED_PROFILE env selector · grammar
         (unset) | "" | "abc-14"; any other value exits 2
         without printing the raw token. "abc-14" restricts
         the forward MJS run to a frozen 14-entry manifest
         in exact order: 1 signup (20) + 13 behavioural
         (30/31/32 auth · 40/41/44/45 w1 · 50/52/53 w2 ·
         60/65/66 w3); cleanup 90 deliberately absent;
         rollback 80/81/82 excluded as before; MIXED 61/62
         absent; NEEDS_MORE_THAN_3 42/43/51/63/64/70 absent.
     (2) GATE_A_SKIP_CLEANUP env gate · grammar
         (unset) | "" | "1"; any other value exits 2 without
         printing the raw token. "1" short-circuits
         90_cleanup.mjs with verdict=BLOCKED at the TOP of
         the per-file loop, BEFORE the two-mode INFRA
         bypass, so no spawn / createClient / auth.signUp /
         signInWithPassword / pg.Client connect fires.
     (3) Composition safety requirement · bounded profile
         WITHOUT skip-cleanup=1 fails closed at startup.
     (4) Bounded resolution · basename → full-path index
         over MJS_FILES; refusals (exit 2) on duplicate
         basename, missing manifest entry, length mismatch,
         or 90 unexpectedly present after resolution. The
         dispatch loop walks RESOLVED_MJS_FILES (not the
         raw MJS_FILES) and derives fileName via basename().

     Tests (__tests__/two-mode.spec.mjs · two new describes):
     · Pure JS simulateDispatch() mirror of the runner's
       dispatch path, with per-fileName trackers for would-be
       spawn / createClient / signUp / signInWithPassword /
       pgConnect / runMjs. Mocked-boundary dispatch exercise,
       not only source regex.
     · Positive · abc-14 + skip-cleanup=1 + three-mode
       dispatches EXACTLY 14 files in exact order, each
       exactly once, total spawn=14.
     · Exclusion · each of 42, 43, 51, 61, 62, 63, 64, 70,
       80, 81, 82, 90 has trackers[name] undefined (never
       reached the loop body, zero Auth/DB calls).
     · Cleanup-skip proof · skip-cleanup=1 + three-mode +
       full forward run · 90 is reached by the loop but
       every tracker counter stays zero.
     · Control · skip-cleanup unset · 90 dispatches
       (spawn=1), proving the guard is doing real work.
     · Refusals · BOUNDED_INVALID, SKIP_CLEANUP_INVALID,
       BOUNDED_WITHOUT_SKIP_CLEANUP, MANIFEST_MISSING_SCRIPT,
       DUPLICATE_BASENAME · all return ok:false with
       dispatched:[] and trackers:null.
     · Static source pins · env read from process.env not
       .env.local; refusal literals never interpolate the
       raw input; BOUNDED_PROFILE_ABC14 frozen 14-entry
       signup-first cleanup-absent; cleanup-skip guard
       precedes INFRA bypass in source order; loop walks
       RESOLVED_MJS_FILES; fileName uses basename().

     Verification: node --check clean on _runner.mjs and
     two-mode.spec.mjs; \`npx vitest run scripts/gate-a-
     connected-matrix/__tests__\` → 7 files · 238 tests ·
     all pass (two-mode.spec.mjs: 105 tests, up from 80
     in §16.48.16).

     Preserved byte-for-byte: two-mode gate (§16.48.15),
     password relay (§16.48.13), run-ID provenance
     (§16.48.14), target refusal (sandbox pin
     kdstoyyeygcopkogqsyv · prod refusal ijvqdvsvwtwxzcqmoqit),
     stop-on-FAIL cascade, identity-mode grammar,
     eligibility-loader hardening, Hammerex/Rosa denylist
     unchanged, 90_cleanup provenance guard unchanged, no
     production/migration/RLS/grant/SMTP/rate-limit/billing/
     .env.local change, no commit/push/deploy, no running
     services touched, D:/trades untouched, no caller or
     activation flag changes.

     Exact connected-run invocation (ONLY to be executed
     after a separate explicit owner authorisation):
       GATE_A_IDENTITY_MODE=three \
       GATE_A_BOUNDED_PROFILE=abc-14 \
       GATE_A_SKIP_CLEANUP=1 \
       node scripts/gate-a-connected-matrix/_runner.mjs
     Proof the invocation cannot dispatch anything else:
     the bounded profile narrows MJS_FILES to the frozen
     14-entry manifest (cleanup is not in the manifest);
     the skip-cleanup=1 flag independently short-circuits
     90 even if a later edit re-adds it; and if either
     flag is omitted or malformed, the runner refuses
     before any Supabase or pg call.

     Still gated (NOT authorised by §16.48.17):
     the bounded connected A/B/C sandbox probe itself;
     cleanup (90_cleanup.mjs) in any other context;
     Gate B; production. §16.48.17 only guarantees
     cleanup CANNOT run during the bounded probe.

     PRE-CONNECTED READINESS (§16.48.18 · 2026-11-20):
     adds three sandbox-pinned readiness layers BEFORE any
     connected A/B/C probe. Agent 1: GATE_A_DRY_RUN selector
     with the same fail-closed grammar as the §16.48.17
     bounded flags — (unset)/"" → false; "1" → true; any
     other value → exit(2) with reason naming accepted
     values, never printing the raw token. When DRY_RUN=1
     the runner resolves RESOLVED_MJS_FILES, prints the
     ordered basenames, writes dry_run:true + dry_run_manifest
     to _results.json.OUTPUT, and exits 0 BEFORE the SQL loop
     and BEFORE the MJS loop. Zero pg.Client.connect(),
     zero createClient(), zero spawnSync for V-* children,
     zero Supabase Auth call. Agent 2: 18-test provenance-
     manifest completeness spec proving signup captures carry
     {run_id, created_at, created_fixtures} and that cleanup's
     provenance guard parses three-mode/two-mode/bounded
     captures cleanly — plus that SKIP_CLEANUP=1 leaves the
     manifest byte-identical (readable + complete after the
     run) and cleanup refuses when the manifest is MISSING/
     EMPTY/MALFORMED/STALE/RUN_ID_MISMATCH/NO_FIXTURES.
     Agent 3: optional _summary-reporter.mjs classifies
     SKIP_CLEANUP entries as SKIPPED_BY_DESIGN (not BLOCKED),
     never lowering the overall verdict; optional
     _preflight-checklist.mjs prints an UNVERIFIED-tiered
     banner covering sandbox credentials / Confirm-email /
     Auth rate-limit / SMTP sender / stale OUTPUT state —
     all owner-attested, never read by the harness.

     Vitest suite: 11 files / 294 tests PASS (up from 7/238;
     +4 files, +56 tests, no regressions). Real dry-run
     invocation under GATE_A_IDENTITY_MODE=three /
     GATE_A_BOUNDED_PROFILE=abc-14 / GATE_A_SKIP_CLEANUP=1
     / GATE_A_DRY_RUN=1 exits 0, writes the 14-entry
     dry_run_manifest with 90 absent, and no network/DB/
     spawn occurred (confirmed by absent runSqlFile +
     runMjsFile log lines). Stale _results.json.OUTPUT
     from §16.48.15 round 2 was rotated aside to
     *.prior-16.48.15-round2-2026-11-19 BEFORE the run.

     Still gated (NOT authorised by §16.48.18): connected
     A/B/C sandbox probe (requires owner's Option α
     authorisation trigger · Confirm-email-OFF toggle is
     owner-only); any patch to 20_signup_disposable_identities.mjs
     (the \`email\`-field gap noted in Agent 2's handback is
     documentation-only, not patched here); cleanup in any
     other context; Gate B; production. Engineering ceiling
     remains Verified (OFFLINE-TESTED) · Sandbox-connected
     PASS / Prod-configured / Live-verified are owner-gated
     separately.

     GUARD WIRED (§16.48.19 · 2026-11-20): closes the three
     §16.48.18 gaps — Agents 1+3 reported together with
     Agent 2, the pure guard assertIdentityDeletable is
     proven wired into the real delete path, and the dry-run
     + list-only paths are re-read as zero-side-effect.
     90_cleanup.mjs now exports assertIdentityDeletable
     (eight ordered refusal codes: DENYLIST_EMPTY · BAD_USER_ID
     · FORBIDDEN_IDENTITY · MANIFEST_EMPTY · NOT_IN_MANIFEST ·
     MISSING_OR_FOREIGN_PROVENANCE_TAG ·
     FORBIDDEN_IDENTITY_IN_MANIFEST · plus DENYLIST_HIT from
     retained_rows), runs a plan-wide guard loop BEFORE any
     pg.Client is constructed (any refusal: exits 4 with
     verdict CLEANUP_REFUSED), honours fail-closed env grammar
     for GATE_A_CLEANUP_LIST_ONLY + GATE_A_CLEANUP_PG_STUB
     (unset/""→false · "1"→true · else exit 2 without
     printing the raw value), and swaps pg.Client for a
     recording stub when PG_STUB=1 — proving zero queries on
     refusal and one DELETE per non-empty table on happy
     path. cleanup-guard-forbidden.spec.mjs (19 pure in-memory
     tests) proves the denylist is checked BEFORE the
     manifest lookup so a poisoned manifest can never promote
     Hammerex or Rosa; cleanup-wiring.spec.mjs (9 tests)
     spawns 90_cleanup.mjs as a real child with
     mkdtempSync-per-test and the three path overrides
     (CAPTURE / RESULTS / STUB_LOG) so vitest runs stay
     race-free alongside dry-run.spec. cleanup-provenance.spec
     and two-mode.spec updated so Rosa- and Hammerex-in-
     fixtures refusals now assert FORBIDDEN_IDENTITY_IN_MANIFEST
     (manifest-origin) distinct from DENYLIST_HIT (retained-
     origin); two-mode mkCap attaches a run-scoped
     provenance_tag to captures and fixture rows.

     Vitest suite: 14 files / 359 tests PASS (up from
     11/294; +3 files, +65 tests, no regressions). Authorised
     invocation (a) real harness dry-run under
     GATE_A_IDENTITY_MODE=three / GATE_A_BOUNDED_PROFILE=abc-14
     / GATE_A_SKIP_CLEANUP=1 / GATE_A_DRY_RUN=1 → exit 0, 23
     scripts resolved, zero network/DB/spawn. Authorised
     invocation (b) cleanup guard list-only under
     GATE_A_CLEANUP_LIST_ONLY=1 with the three path overrides
     → exit 0, 3 approved identities (abc-14 A/B/C), 0
     refused, verdict CLEANUP_LIST_ONLY emitted, zero
     pg.Client calls.

     Phase 3 preflight: runGates against the real environment
     returned allPass:false — G-SMTP-ATTEST UNVERIFIED-BLOCKED
     (GATE_A_SMTP_CUSTOM_ENABLED not set to "yes") +
     G-DB-CRED UNVERIFIED-BLOCKED (marker file
     evidence/attestations/db-cred-verified.flag absent) +
     G-TARGET-REF ATTESTED (SANDBOX_DATABASE_URL →
     kdstoyyeygcopkogqsyv). Phase 3 (connected A/B/C) NOT
     executed per owner directive "If anything fails, stop
     and report. Make no connected call." Also fixed: a
     build error at page.tsx:2195 caused by unescaped
     backticks inside the DIAGRAM template literal (tsc
     --noEmit clean after).

     Still gated (NOT authorised by §16.48.19): connected
     A/B/C sandbox probe (preflight allPass:false · requires
     operator attestations G-SMTP-ATTEST + G-DB-CRED plus
     owner's Option α trigger · Confirm-email-OFF toggle is
     owner-only); real pg.Client cleanup against sandbox
     (only stub-mode + list-only mode exercised here); any
     patch to 20_signup_disposable_identities.mjs; cleanup
     in any other context; Gate B; production. Engineering
     ceiling remains Verified (OFFLINE-TESTED).

     PRE-UNBLOCK PREP (§16.48.20 · 2026-11-20): three parallel
     agents prepping the §16.48.19 operator-action list so a
     future Option α trigger lands clean. Agent A owned
     docs/gate-a/OPERATOR-RUNBOOK.md (operator runbook);
     Agent B owned scripts/gate-a-connected-matrix/
     91_db_cred_probe.mjs + its db-cred-probe.spec.mjs
     (offline-tested credential probe that may write
     evidence/attestations/db-cred-verified.flag only on
     real-sandbox PASS under separate owner authorisation);
     Agent C rotated the stale _results.json.OUTPUT (981 B,
     mtime 2026-11-20 01:08) aside into
     scripts/gate-a-connected-matrix/_archive/stale-outputs-
     2026-11-20/ via rename-style move (no empty placeholder
     left behind · 99_identity_capture.json.OUTPUT was
     already absent so nothing to rotate there · .PLACEHOLDER
     and .prior-16.48.15-round2-2026-11-19 variants retained
     in place). At ledger-write time Agent A and Agent B had
     NOT landed their files (docs/gate-a/ empty ·
     91_db_cred_probe.mjs + db-cred-probe.spec.mjs absent),
     so both are recorded BLOCKED in §16.48.20 per
     coordination rule — Agent C landed its own rotation
     regardless. NO flag file created by any agent in this
     round. NO probe run against any real DB. NO connected
     call · no sandbox touch · no credential or env edit ·
     no commit · no push · no deploy. Engineering ceiling
     remains Verified (OFFLINE-TESTED); Sandbox-connected
     PASS / Prod-configured / Live-verified stay owner-gated.

     CONFIG X RUN + WIRING DISCOVERY (§16.48.21 · 2026-11-20):
     Owner chose Config X (sandbox Confirm email OFF; email-
     confirmation journey deferred to a later Brevo round).
     Three parallel agents: Agent A ran the §16.48.20 probe
     ONCE against sandbox kdstoyyeygcopkogqsyv — single read-
     only invocation issuing SELECT 1 + current_database(),
     exit 0, verdict DB_CRED_PROBE_PASS, flag written at
     evidence/attestations/db-cred-verified.flag, zero row
     changes, zero secrets in stdout/stderr. Agent B
     expanded G-SMTP-ATTEST into a strict fail-closed enum
     (unset/""→UNVERIFIED-BLOCKED; "yes"→ATTESTED detected
     config Y; "confirm-off"→ATTESTED detected config X; any
     other string→UNVERIFIED-BLOCKED refusalCode
     GATE_A_SMTP_CUSTOM_ENABLED_INVALID_VALUE with the raw
     value withheld from logs/assertions/reason). runGates
     now returns smtpAttestConfig: "X"|"Y"|null; runbook
     Section 5 covers Config X quick-path operator steps.
     Agent C added 92_auth_state_check.mjs + its 15-test
     spec — a read-only sandbox Management-API helper that
     SOFT-FAILS transparently (exit 0, AUTH_STATE_UNREADABLE,
     MGMT_TOKEN_MISSING) when SUPABASE_ACCESS_TOKEN is
     absent rather than blocking the pipeline.

     WIRING MISMATCH DISCOVERED: the probe writes
     evidence/attestations/db-cred-verified.flag (schema
     verdict/probe_version/checked_at/current_database) but
     the preflight G-DB-CRED gate reads scripts/gate-a-
     connected-matrix/_db-cred-check.status.OUTPUT (schema
     status/checked_at, 24-h freshness). Two different files,
     two different schemas — bug carried from §16.48.19
     unnoticed until the probe actually ran. The probe
     PASSED, but the gate still reports UNVERIFIED-BLOCKED
     because the file it reads is absent. NOT fixed in this
     entry; needs its own owner-scoped §16.48.22 round
     (either teach the probe to write both files, teach the
     preflight to read the probe's output path, or add a
     tiny translator).

     Suite: 16 files · 402 tests PASS (up from 15/375 ·
     +1 file auth-state-check · +27 tests · no regressions).
     Preflight against real env post-agents: G-SMTP-ATTEST
     UNVERIFIED-BLOCKED (operator will set
     GATE_A_SMTP_CUSTOM_ENABLED=confirm-off) · G-DB-CRED
     UNVERIFIED-BLOCKED (wiring mismatch above · probe did
     pass) · G-TARGET-REF ATTESTED. allPass:false → Phase 3
     NOT executed. Engineering ceiling remains Verified
     (OFFLINE-TESTED) for Agents B/C and suite · Sandbox-
     attested for the one authorised probe call · no
     commit/push/deploy · no credential/.env edits by
     Claude · no Hammerex/Rosa/privacy/D:/trades touched.

     WIRING MISMATCH CLOSED (§16.48.22 · 2026-11-20): owner
     chose "read probe path" over "write both" or
     "translator". Agent A (worked in-session after a refusal
     misread) rewired runGates() G-DB-CRED to read
     evidence/attestations/db-cred-verified.flag as its sole
     source, retiring scripts/gate-a-connected-matrix/
     _db-cred-check.status.OUTPUT. Input field renamed
     dbCredStatusPath → dbCredFlagPath. The single status/
     checked_at branch is replaced by a 10-clause fail-closed
     decision tree with distinct refusalCodes: DB_CRED_FLAG_
     MISSING, _EMPTY, _MALFORMED_JSON, _MISSING_VERDICT_FIELD,
     DB_CRED_PROBE_LAST_RUN_FAILED (verdict FAIL → BLOCKED),
     DB_CRED_FLAG_UNRECOGNISED_VERDICT, DB_CRED_FLAG_WRONG_
     PROJECT_REF (forward-compat defence; activates only if
     the probe later writes project_ref; raw value NEVER
     echoed), DB_CRED_FLAG_BAD_CHECKED_AT, DB_CRED_FLAG_STALE
     (>24h), and ATTESTED. ATTESTED gate record now carries
     source/checked_at/current_database; printer line
     reformatted as "G-DB-CRED: ATTESTED · source=<path> ·
     checked_at=<iso> · current_database=<value|(not
     reported)>". Agent B updated OPERATOR-RUNBOOK sections
     1.1/2.6/4/5.5/6 and added a doc comment to 92_auth_
     state_check.mjs reaffirming SUPABASE_ACCESS_TOKEN
     intentionally absent + MGMT_TOKEN_MISSING soft-fail
     authoritative (no runtime change). Spec grew 44 → 64
     tests (10 new refusal-clause tests + ATTESTED happy
     paths + printer-line assertions + sentinel-grep
     hygiene on clause 7 + 24h boundary ±1ms). Suite: 16
     files · 422 tests PASS (up from 402; +20 tests; no
     regressions). Preflight against real env on
     C:/Users/Victus/nexapp with GATE_A_SMTP_CUSTOM_ENABLED=
     confirm-off: G-SMTP-ATTEST ATTESTED detected config X ·
     G-DB-CRED ATTESTED source=evidence/attestations/db-cred
     -verified.flag checked_at=2026-11-20T01:42:13.965Z
     current_database=postgres · G-TARGET-REF ATTESTED.
     allPass:true · smtpAttestConfig:"X". Engineering
     ceiling remains Verified; Sandbox-attested for the
     one §16.48.21 probe call that produced the flag;
     Prod-configured / Live-verified stay owner-gated. No
     commit · no push · no deploy · no production touch ·
     no .env edit · no new probe run in this entry. Option
     α trigger phrase ARMED but not yet typed by owner;
     connected A/B/C has NOT run.

     OPTION α RUN · STOPPED AT 20_SIGNUP (§16.48.22.α ·
     2026-11-20): owner typed the §16.48.22 trigger phrase
     verbatim after the three-precondition check (Confirm
     email OFF in sandbox Studio · rate-limits clean ·
     credential flag <24h). Runner invoked with
     GATE_A_IDENTITY_MODE=three GATE_A_BOUNDED_PROFILE=abc-14
     GATE_A_SKIP_CLEANUP=1 GATE_A_SMTP_CUSTOM_ENABLED=
     confirm-off against sandbox kdstoyyeygcopkogqsyv ·
     run_id 044c3671-9593-4933-9a6d-47b3cfd939d9 · started
     2026-11-20T02:19:18.522Z. 00_preflight.sql PASS (24
     checks) · 10_grants.sql PASS (17 rows) ·
     20_signup_disposable_identities.mjs FAIL exit 1
     SUMMARY 0 OK · 3 BLOCKED. All three signUps for
     <op-email> / +1 / +2 returned Supabase "Error
     sending confirmation email" synchronously · NOT a 429
     cascade. Stop-on-first-failure engaged: 30-82 scripts
     never dispatched; 90_cleanup excluded as always.
     Runner_exit: 1. Root cause (observed, not speculated):
     operator attested confirm-off (Config X) but sandbox
     responded as Confirm-email-ON with broken/unconfigured
     SMTP relay — the operator-attested G-SMTP-ATTEST
     cannot verify the Studio toggle; engineering-ceiling-
     VERIFIED model surfaced the mismatch instead of hiding
     it. Side effects on sandbox: zero auth.users rows
     (signUps refused before credential issuance); three
     pending_signup write-ahead tracking rows persisted
     (safe residue — no RLS bypass · no access grant);
     _results.json.OUTPUT + 99_identity_capture.json.OUTPUT
     written. Trigger phrase SPENT · re-run requires a
     fresh phrase under a fresh §16.48.xx anchor. No
     commit · no push · no deploy · no .env edit · no
     production touch · no retry. Engineering ceiling
     remains Verified; Sandbox-attested PASS for the two
     SQL entries + §16.48.21 DB-cred probe; Sandbox-
     attested FAIL for 20_signup. Operator options:
     (X) flip Studio Auth → Providers → Email · Confirm
     email OFF to match the attestation, then re-authorise;
     (Y) configure custom Brevo SMTP + keep Confirm email
     ON + change attestation to yes, then re-authorise.
     Cleanup of three pending_signup rows is separately
     authorisable, not automatic.

     OPTION α RUN · COMPLETE · runner_exit 0 (§16.48.23 ·
     2026-11-20): owner first flipped Authentication → Sign
     In / Providers → User Signups → Confirm email from ON
     to OFF in sandbox Studio (Email provider stayed Enabled;
     "Allow new users to sign up" stayed ON) — this is the
     exact Studio state Config X attests. No code change ·
     no .env.local edit between §16.48.22.α and this run.
     Owner then typed the fresh §16.48.23 trigger phrase
     verbatim. Runner invoked with GATE_A_IDENTITY_MODE=three
     GATE_A_BOUNDED_PROFILE=abc-14 GATE_A_SKIP_CLEANUP=1
     GATE_A_SMTP_CUSTOM_ENABLED=confirm-off against sandbox
     kdstoyyeygcopkogqsyv · run_id cedfcd89-3697-40a6-946a-
     0c779f047dee · started 2026-11-20T02:32:44.631Z ·
     runner_exit 0. 16/16 entries dispatched · 0 stops · 0
     FAIL · 0 429. Breakdown: 2 SQL PASS (00_preflight ·
     10_grants) · 1 MJS PASS 3/3 signUps (20_signup) · 3
     MJS PASS CONNECTED-verified (30_v_auth_null +
     31_v_auth_unknown + 53_v_w2_auth — the ACL layer and
     caller-identity body-guards that do NOT need a
     nex_account) · 10 MJS PASS BLOCKED (32, 40, 41, 44,
     45, 50, 52, 60, 65, 66 — honest "cannot exercise" exits
     because every scenario needs ≥1 nex_account row on
     A/B/C and sandbox auto-create is OFF). What was
     actually verified in live sandbox: auth.users signUp
     happy path under Config X returned sessions for all
     three identities (Supabase user IDs issued for A ·
     64f60d28 · B · 4effbb70 · C · 284b4502); anon RPC calls
     to nex_invite_to_call_tx and nex_create_group_call_
     session_tx returned 42501 permission denied before any
     body code ran — the GRANT/REVOKE baseline
     (10_grants.sql) behaving exactly as required; the
     caller_account_not_found body-guard on nex_invite_
     to_call_tx returned 42501 caller_account_not_found
     when auth.uid() has no nex_account row (exercised
     against identity A). What was NOT verifiable: the ten
     BLOCKED verdicts all share one root cause —
     20_signup_disposable_identities.mjs reports "nex_
     account: NOT FOUND — auto-create is OFF." for each of
     A, B, C; the W1/W2/W3 body-guards cannot be exercised
     without nex_account rows, and the engineering-ceiling-
     VERIFIED model reports BLOCKED rather than fabricating
     a PASS. Entries NOT dispatched by abc-14 manifest
     (reference only): 42, 43, 51, 61, 62, 63, 64, 70, 80,
     81, 82 — their coverage stays OFFLINE-TESTED (vitest
     green), not SANDBOX-ATTESTED. Side effects on sandbox:
     three NEW auth.users rows (A/B/C with auto-confirmed
     timestamps since Confirm email is OFF · disposable
     passwords held in runner process env and now gone);
     three NEW pending_signup rows transitioned pending →
     signed_up for this run; three §16.48.22.α write-ahead
     pending_signup rows remain in pending state — six
     total pending_signup rows now awaiting separately
     authorised cleanup; NO new nex_account rows (auto-
     create OFF); NO new nex_group_call_session or
     _participant rows (every creator scenario BLOCKED).
     Artefacts written: _results.json.OUTPUT (full
     structured verdict table) · 99_identity_capture.json.
     OUTPUT (three emails + three Supabase user IDs · no
     passwords). Safety invariants held: §16.48.23 trigger
     phrase SPENT · single attempt · no retry · no cleanup
     dispatched (GATE_A_SKIP_CLEANUP=1) · runner verified
     SANDBOX_DATABASE_URL project ref before any dispatch ·
     production ref ijvqdvsvwtwxzcqmoqit appears nowhere in
     output · no commit · no push · no deploy · no .env.
     local edit by Claude · no Hammerex / Rosa / privacy /
     D:/trades touched · disposable passwords never emitted
     on stdout or persisted. Engineering ceiling remains
     Verified; SANDBOX-ATTESTED PASS established for
     00_preflight / 10_grants / 20_signup / 30_v_auth_null /
     31_v_auth_unknown / 53_v_w2_auth; SANDBOX-ATTESTED
     BLOCKED (honest "cannot exercise") for 32 / 40 / 41 /
     44 / 45 / 50 / 52 / 60 / 65 / 66; UNVERIFIED for the
     email-confirmation journey (deferred by Config X) and
     the §16.48.19 operator-attested items (Studio rate-
     limit state · SMTP sender selection · .env.local
     contents · stale _results.json.OUTPUT rotation). Prod-
     configured / Live-verified stay owner-gated separately;
     no production touch granted by §16.48.23. Operator
     decisions queued (each needs its own authorisation):
     (1) cleanup of six pending_signup rows + three
     auth.users rows + their nex.pending_signup state
     transitions via 90_cleanup.mjs — designed path, does
     not auto-run; (2) lift 10 BLOCKED → CONNECTED-PASS by
     either a sandbox auto-create trigger from auth.users
     into nex_account, or a Gate A helper that seeds
     nex_account rows for A/B/C after signUp, or a different
     identity manifest that pre-provisions NEX accounts; (3)
     Config Y email-confirmation round when working Brevo
     SMTP is configured in sandbox and Confirm email is
     flipped ON. Awaiting owner direction.

     LIFT BLOCKED ROUND · PARTIAL · STOP at script 40
     (§16.48.24 · 2026-11-20): owner directive to lift the 10
     §16.48.23 BLOCKED verdicts via the real nex_account
     creation path. Phase 1 two parallel read-only agents.
     Agent A (source trace): real path is NEX app code —
     src/lib/nex-native/app/session.ts:196-208 function
     resolveFromUser calls accountService.createAccount at
     src/lib/nex-native/account-service.ts:102-148 which
     service-role INSERTs nex_account + calls
     ensureNexHandle (RPC public.nex_allocate_handle, SEC-
     DEFINER). resolveFromUser fires on the first authed
     request to any /nex-native/* RSC / Server Action /
     Route Handler. 20_signup only does auth.signUp and
     NEVER follows up with an authenticated app request →
     resolveFromUser never runs → no nex_account → root
     cause of all 10 BLOCKED verdicts. No Postgres trigger
     on auth.users exists anywhere in nex-supabase/
     migrations/. Classification Case 1 — reusable app code
     path. Agent B (sandbox vs migrations drift): zero non-
     internal triggers on auth.users in sandbox, zero auth-
     side provision functions anywhere, zero CREATE TRIGGER
     auth.users in any of 451 migrations. Drift verdict:
     NO DRIFT. nex_account table 78 columns · only
     display_name is NOT NULL w/o default · service-role
     INSERT bypasses RLS natively (authed-user INSERT would
     be RLS-blocked since nex_account has only a self-read
     policy). Sandbox migration head 359. Phase 2 Case 1 OK
     to apply. Orchestrator scripts/gate-a-connected-matrix/
     _provision-and-run-blocked-16-48-24.mjs (new file,
     local, not committed) hard-refuses prod ref, runs:
     Phase A nex_account SELECT-then-INSERT w/ exact
     createAccount column shape (supabase_user_id ·
     display_name = email local-part · chat_theme=theme-0 ·
     other NOT NULL via defaults) + nex_allocate_handle RPC
     per label; Phase B admin.updateUserById password reset
     on the three EXISTING auth.users rows (not signups —
     UUIDs unchanged); Phase C rewrites 99_identity_capture.
     json.OUTPUT with nex_account_id+found:true and a
     provision_16_48_24 audit block; Phase D dispatches 10
     BLOCKED scripts with GATE_A_TEST_PASSWORD_{A,B,C} in
     child env, stop on first non-zero exit / FAIL / 429.
     Phase A outcome: A nex_account b02c8a70-1624-4885-
     b674-fb007a1e2a2e handle nex-10940 · B nex_account
     ee559828-3950-4cc2-8599-1b364eea2591 handle nex-10941
     · C nex_account 9b542dfa-bf9c-4021-9fde-60ffba978d22
     handle nex-10942. Phase B passwords reset in memory
     only, never persisted. Phase D dispatch outcome · run
     id 92bb10cd3e37142e: (1) 32_v_auth_unauthorized_diff
     PASS CONNECTED — 42501 session_not_owned confirmed · B
     cross-session invite rejected before body · previously
     BLOCKED → now SANDBOX-ATTESTED PASS CONNECTED · 1/10
     lifted · (2) 40_v_w1_new FAIL exit 1 — RPC succeeded
     (all 5 out_* cols returned · session/participant/
     conversation/message rows created correctly per
     service-role SELECT) but post-RPC authed-A SELECT on
     nex_group_call_session + _participant returns 0 rows ·
     STOP-on-first-fail engaged · remaining 8 scripts (41/
     44/45/50/52/60/65/66) NOT dispatched. Case 2 root
     cause via read-only diag script _diag-rls-16-48-24.
     mjs: Postgres error 42P17 "infinite recursion detected
     in policy for relation nex_group_call_participant".
     Source is nex-supabase/migrations/133_nex_group_call.
     sql lines 139-147 where
     nex_group_call_participant_select_scoped USING clause
     has a second branch SELECT session_id FROM
     nex_group_call_participant (self-reference on the
     policy's own table) and companion policy
     nex_group_call_session_select_participants at lines
     109-117 references nex_group_call_participant from the
     session side → same recursion. Sandbox matches repo
     migration exactly · NO DRIFT · this is a pre-existing
     product defect surfaced by Gate A not sandbox-vs-prod
     divergence. Impact: every authed read of a group-call
     session or participant row returns 42P17 today · host
     dashboards and invitee lists and W1 post-RPC
     verification all affected · nex_invite_to_call_tx
     itself runs SECURITY DEFINER and is unaffected (that
     is why script 32 still passes). Minimal fix shape
     (NOT authorised by this round · design guidance only):
     replace recursive branches with SECURITY DEFINER
     helper nex_is_participant_in_session(p_session uuid)
     STABLE SET search_path=public, GRANT EXECUTE TO
     authenticated, rewrite both policies to call the
     helper. Needs its OWN owner-authorised sandbox-only
     migration round under a fresh §16.48.xx anchor · prod
     ijvqdvsvwtwxzcqmoqit stays sealed until a separate
     prod gate opens. Side effects on sandbox: 3 new
     nex_account + 3 pw-reset auth.users + 1 new
     nex_group_call_session (6e635d99…) + 1 new
     nex_group_call_participant (cbce8cf4…) + 1 new
     nex_peer_conversation (61fca102…) + 1 new
     nex_peer_message (dfae2574…) from script 40 · retained
     session 73b48941… + participant 5fbae638… from script
     32 · identity capture rewritten with nex_account_id
     per label. Artefacts: _results.16-48-24.json.OUTPUT
     (2-entry verdict table) · orchestrator + diag scripts
     (local, not committed). Safety invariants held: no
     production touch · hard-refuse of prod ref before any
     DB connect · no commit · no push · no deploy · no
     .env.local edit · no new auth.users signups (3 UUIDs
     reused) · no cleanup dispatched · passwords never
     printed or persisted · dev server not stopped · no
     Hammerex/Rosa/privacy/D:/trades touched. Status after
     §16.48.24 (tiers kept distinct — no inflation): the ONLY
     entries proven at the CONNECTED-body level are 4 ·
     30_v_auth_null + 31_v_auth_unknown + 53_v_w2_auth (from
     §16.48.23) + newly lifted 32_v_auth_unauthorized_diff
     (§16.48.24). Separate lower tiers kept honest: SQL
     baseline PASS (NOT body-level) = 2 · 00_preflight +
     10_grants · they confirm schema/grants only, not RPC
     behaviour. Auth-creation PASS (NOT body-level) = 1 ·
     20_signup · proves Supabase signUp happy path, not any
     NEX RPC. SANDBOX-ATTESTED FAIL = 1 · 40_v_w1_new · RPC
     body ran correctly but post-RPC authed-A verification
     SELECT blocked by 42P17 RLS recursion. SANDBOX-
     ATTESTED BLOCKED on Case 2 = 8 · 41/44/45/50/52/60/65/
     66 · NOT dispatched after the stop — honest unknown,
     NOT a claim of pass. OFFLINE-TESTED only (vitest green,
     never run connected) = 11 · 42/43/51/61/62/63/64/70/80/
     81/82. UNVERIFIED = email-confirmation journey (Config
     X deferred it) + §16.48.19 operator-attested items.
     Engineering ceiling remains Verified; only the 4
     CONNECTED body-guards above may be called "proven" ·
     the 2 SQL + 1 signup PASSes are real but a lower
     evidence tier · nothing else is PASS. Prod-configured
     and Live-verified stay owner-gated. Operator decisions queued:
     (1) Case 2 RLS fix migration (sandbox-only · fresh
     authorisation required) · (2) §16.48.24.β rerun of the
     8 remaining BLOCKED scripts after the RLS fix (fresh
     trigger phrase) · (3) cleanup of §16.48.23+.24 rows
     via 90_cleanup.mjs (fresh authorisation) · (4) Config
     Y email-confirmation round (unchanged).

     (§16.48.25 · 2026-11-20): Case 2 RLS fix landed in sandbox.
     Agent A wrote migration 360 (new forward migration · did NOT
     edit mig 133) · creates SECURITY DEFINER helper
     public.nex_is_participant_in_session(uuid) (LANGUAGE sql ·
     STABLE · search_path pinned) and rewrites the two SELECT
     policies so the recursive subquery becomes a helper call.
     Agent B audited all 446 migration files · 333 CREATE POLICY
     occurrences · zero new recursion findings outside §16.48.25
     scope (findings doc at evidence/master-flow/RLS-RECURSION-
     AUDIT-16-48-25.md). Agent C built the 9-script rerun
     orchestrator · not dispatched (see blocker below). Sandbox
     head: 359 → 360 (SHA cd46ab7a…). Post-check matrix: helper
     prosecdef=true · provolatile=s · search_path=public · owner=
     postgres · both policies now call the helper · no self-ref
     subquery remaining · history row inserted. Phase 1 verifier
     (service-role direct pg · set_config('request.jwt.claims')
     + SET LOCAL ROLE authenticated · no password reset · no
     signin · no writes) confirmed 42P17 CLEARED under simulated
     authenticated role: current_user=authenticated · auth.uid()
     resolved to A (64f60d28-…) · SELECT nex_group_call_session
     count=2 OK · SELECT nex_group_call_participant count=0 OK ·
     helper(null-session)=false. Evidence tier for this proof:
     SIMULATED-AUTH (one tier below CONNECTED-body) · identical
     policy evaluation path to a real JWT. Phase 2 (9-script
     rerun = 40/41/44/45/50/52/60/65/66) BLOCKED on credential
     availability: §16.48.24 reset A/B/C passwords to
     unpersisted ephemeral values (correct secrets hygiene) and
     §16.48.25 forbids password reset. ACL gap flagged: helper
     function also carries EXECUTE on anon + service_role
     because Supabase default grants persist unless explicitly
     REVOKEd (migration 359's canonical envelope has 3 REVOKEs).
     Practical security still intact (auth.uid()=NULL for anon
     makes helper EXISTS return false) but the ACL doesn't
     match the stated intent — needs migration 361 under its
     own authorisation. PRODUCTION NOTE: migration 133 IS
     applied in production per scripts/_test-applied-versions
     .json (frozen 2026-10-30 probe of
     ijvqdvsvwtwxzcqmoqit nex_migration_history, entry {version:
     "133"}) — authed SELECTs in prod currently hit the same
     42P17. Group-call session visibility broken for signed-in
     users in prod; invite/create RPCs still work (service-role
     path). Production remains SEALED · migration 360 + 361
     prod-apply authorisation NOT granted now. Status updates
     after §16.48.25: CONNECTED-body-level PASS unchanged at 4
     (30/31/32/53) · 40_v_w1_new stays FAIL (RLS defect cleared
     at SQL level but no script rerun yet · SIMULATED-AUTH is
     NOT a CONNECTED-body-level upgrade) · 8 BLOCKED (41/44/45/
     50/52/60/65/66) stay BLOCKED pending credential unblock ·
     lower tiers (SQL/signup) unchanged · OFFLINE-TESTED
     unchanged · UNVERIFIED unchanged. Engineering ceiling
     remains Verified. Operator decisions queued: (D1) unblock
     Phase 2 via owner-provided passwords OR fresh one-off
     password-reset authorisation · (D2) migration 361 to close
     helper ACL gap (sandbox-only) · (D3) cleanup via
     90_cleanup.mjs · (D4) prod-apply auth for 360+361 under
     separate explicit authorisation naming prod ref.

     (§16.48.26 · 2026-11-20): World-class close-out. Evidence-only
     — no DB writes, no commits, no pushes, no prod touches, no
     env edits, no signups, no password resets. Wave 2 vitest proof
     landed: 422/422 GREEN across the entire Gate A test harness
     (151 in wave-2 subtotal: 20_signup 15/15 · 90_cleanup 15/15 ·
     auth-state-check 15/15 · db-cred-probe 16/16 · manifest-
     completeness 18/18 · relay 28/28 · runid 20/20 · v_scripts
     24/24 · plus 271/271 from §16.48.19 items 1-10). World-class
     standard applied: offline/vitest passes are PROGRAMMABLY-
     VERIFIABLE only — NOT CONNECTED-body-level. Harness correctness
     ≠ feature live-verification. Tier distinctions enforced in the
     master gate board. Reclassification: 80/81/82 moved from
     UNKNOWN/BLOCKED to FAILURE-HARNESS-ONLY (their only job is
     fail-closed testing; they do NOT count for proven-PASS
     aggregates and do NOT count as regressions). Readiness
     confirmed (no execution): migration 361 ready at SHA
     84023fb5… with apply script that asserts anon=false +
     service_role=false post-apply · Config Y SMTP-less verifier
     ready at _verify-config-y-smtpless-16-48-26.mjs (uses admin.
     auth.generateLink · POSTs to /nex-native/auth/confirm with
     redirect:manual · expects 302/303 + sb-*-auth-token cookie ·
     side effect limited to email_confirmed_at on C). Master gate
     board breakdown: 4 CONNECTED-body-level PASS (30/31/32/53) ·
     2 SQL-BASE (00/10) · 1 AUTH-CREATE + PROG-VER (20_signup) ·
     1 SIM-AUTH (42P17 cleared sandbox) · 3 PROG-VER tool scripts
     (90/91/92) · 11 BLOCKED-CRED (40/41/44/45/50/52/60/65/66/70
     + 40_v_w1_new rerun) · 5 BLOCKED-PROV needing D/E (42/43/51/
     63/64) · 3 FAILURE-HARNESS-ONLY (80/81/82). 7 owner-only
     decisions queued: D1 credentials (unlocks 11) · D2 apply 361
     sandbox · D3 provision D/E (unlocks 5) · D4 prod-apply naming
     ijvqdvsvwtwxzcqmoqit · D5 owner runs 91_db_cred_probe · D6
     owner attests GATE_A_SMTP_CUSTOM_ENABLED=yes · D7 execute
     Config Y verifier. Engineering ceiling remains Verified;
     Prod-configured + Live-verified stay owner-only. This is the
     furthest the engineering lane reaches without owner inputs.

     (§16.48.27 · 2026-11-20): Inventory reconciliation + fresh
     evidence re-run. Evidence-only · no DB writes · no commits ·
     no pushes · no prod · no env edits · no credential
     solicitation · sandbox NOT connected this round. §16.48.26
     "25 scripts + 4 extras" wording was arithmetically unexplained;
     filesystem-reconciled real inventory is 28 numbered .mjs
     scripts + 2 SQL baselines (00_preflight.sql + 10_grants.sql) =
     30 matrix rows. Three §16.48.26 corrections applied:
     (a) scripts 61/62 WERE OMITTED from every tier list · they
     are OFFLINE-AUTHORED (header: "OFFLINE ONLY · NOT EXECUTED",
     Agent HARNESS 2026-11-19) · now tier OFFLINE-AUTHORED, not
     BLOCKED. (b) D5 is ALREADY SATISFIED · evidence/attestations/
     db-cred-verified.flag exists {verdict:DB_CRED_PROBE_PASS,
     checked_at:2026-11-20T01:42:13Z} · §16.48.26 wrongly listed
     D5 as pending. (c) Fresh single-invocation vitest proves the
     422/422 claim without overlap: \`npx vitest run scripts/gate-
     a-connected-matrix/__tests__/\` → Test Files 16 passed · Tests
     422 passed · duration 3.57s · 2026-11-20 11:02:42. Per-file:
     20_signup 15 · 90_cleanup 15 · auth-state-check 15 ·
     cleanup-guard-forbidden 19 · cleanup-provenance 31 ·
     cleanup-wiring 9 · db-cred-probe 16 · dry-run 12 · manifest-
     completeness 18 · preflight-checklist 64 · relay 28 · runid
     20 · signup-write-ahead 19 · summary-reporter 12 · two-mode
     105 · v_scripts 24. PROG-VER tier only · harness correctness ≠
     feature live-verification. Migration 361 source re-verified:
     SHA 84023fb5… matches · body is a single BEGIN/COMMIT with
     REVOKE anon + REVOKE service_role + REVOKE public + GRANT
     authenticated + INSERT history(361) · function body/attrs/
     policies untouched. apply-migration-361-sandbox.mjs
     re-verified: prod-ref hard refusal + sandbox-ref pin + SHA
     pin + idempotent skip-if-present + post-check asserts
     public=false/anon=false/authenticated=true/service_role=false
     + helper attrs + policy non-recursion. READY, not executed ·
     D2 remains the trigger. Config Y verifier re-verified: uses
     admin.generateLink(signup→magiclink fallback) · operates on C
     only · tokens redacted · evidence tier CONNECTED-BODY-PASS-
     SMTPLESS · side effect limited to email_confirmed_at on C.
     READY, not executed · D7 remains the trigger. Corrected gate
     board (30 rows fully enumerated): 4 CBP (30/31/32/53) · 2
     SQL-BASE (00/10) · 1 AUTH-CREATE+PROG-VER (20) · 10 BLOCKED-
     CRED (40/41/44/45/50/52/60/65/66/70) · 5 BLOCKED-PROV (42/43/
     51/63/64) · 2 OFFLINE-AUTHORED (61/62) · 3 FAIL-HARN (80/81/
     82) · 3 PROG-VER tools (90/91/92 · 91 also carries attested-
     probe-output from D5 flag). Dispatchable-but-unrun fraction:
     17/30. Dispatched-and-passed (CBP+SQL-BASE+AUTH-CREATE): 7/30.
     Decisions queued (D5 removed, D4 out of scope): D1
     credentials · D2 apply 361 · D3 provision D/E · D6 SMTP
     attest · D7 Config Y execute. Engineering ceiling remains
     Verified. Sandbox NOT yet fully verified · no unsupported
     "100% passed" or "world-class" or "production-ready" claims.
     Working-tree lingering shell from §16.48.26 close-out:
     identified as the completed \`for ... vitest ...\` loop whose
     exit landed in prior transcript · no live process · no kill/
     duplicate required.

     (§16.48.28 · 2026-11-20): Lane 1/2/3 landed + migration 362
     applied to sandbox. Owner-authorised proceed on all three
     deferred items. What is PROVEN (evidence tier noted per item,
     no unsupported upgrades):

       Lane 1 · roster authorization guard
         · src/lib/nex-native/calls/roster-authorization.ts +
           src/lib/nex-native/calls/__tests__/roster-authorization.
           test.ts · 8/8 vitest GREEN · tier PROG-VER (unit).
         · listParticipants() + preview/page.tsx fetchParticipants
           both pass through the shared guard before the service-
           role read · server-resolved caller account id only ·
           fail-closed with typed denial reasons. Service-role is
           no longer by itself treated as authorization.

       Lane 2 · joined_at = sole trusted server writer
         · Migration 362 APPLIED sandbox kdstoyyeygcopkogqsyv
           2026-11-20. Head 360 → 362 (SHA 2a9c46b6…). Column
           accepted_at timestamptz NULL added. Historical rows
           total=23 · populated=0 · no backfill (as designed).
           Tier SANDBOX-APPLIED (SQL-BASE). Production SEALED ·
           not applied to ijvqdvsvwtwxzcqmoqit.
         · src/lib/nex-native/calls/confirm-room-join.ts (core) +
           src/app/api/nex-native/calls/confirm-room-join/route.ts
           (POST handler) · src/lib/nex-native/calls/__tests__/
           confirm-room-join.test.ts · 6/6 vitest GREEN · tier
           PROG-VER.
         · Faked joined_at = NOW() writes REMOVED from
           createGroupCallSession (host row) and from preview/
           page.tsx acceptInviteOnLoad (accept patch). Engine
           wired at group-call-engine.ts:247 to POST exactly once
           per instance at the connecting→live transition · fail-
           soft (advisory, swallow errors) · idempotent UPDATE
           on server (eq session+account+left_at IS NULL).

       Lane 3 · scripts 40/41 rebased onto mig-133 SELECT reality
         · Under the policy account_id IN (me) OR nex_is_
           participant_in_session(session_id), a W1 host (no
           participant row) cannot read invitee rows under their
           own JWT. Scripts now sign in B (and C) and read each
           invitee's own row via account_id=me branch. Tier
           OFFLINE-AUTHORED · still blocked on BLOCKED-CRED (D1).

       Client-side caller-popup overlay
         · src/app/nex-native/call/preview/_live-call-client.tsx
           derives a per-session arrival set from the existing
           onPresenceChange callback the engine already emits ·
           ZERO new Supabase Realtime subscription · ZERO new
           fetch · owner directive 2026-11-20 "broadcast is user
           phone system and data · NEX is the application only"
           honoured. Tier PROG-VER (visual verification pending).

     Full calls-package vitest run: 144/144 GREEN (12 files)
     2026-11-20 13:24. Typecheck clean on all touched files
     (one pre-existing TS2344 at group-call-engine.ts:120
     BroadcastPayload constraint predates this work — not
     introduced by Lane 1/2/3).

     What is NOT upgraded by §16.48.28:
       · 40_v_w1_new stays BLOCKED-CRED pending D1. Rebase is
         source-correct but has not been dispatched connected.
       · 41_v_w1_exist stays BLOCKED-CRED pending D1.
       · Case G STATE_BLOCKER (true PL/pgSQL mid-function fault
         injection) remains UNVERIFIED by design — the script
         itself documents it as INDIRECT evidence only.
       · Production ijvqdvsvwtwxzcqmoqit remains SEALED. Mig
         362 prod-apply NOT authorised.
       · onPresenceChange arrival-popup has unit-level wiring
         only · no browser-pass evidence from a real session.
       · Engineering ceiling remains Verified. Prod-configured
         + Live-verified stay owner-only.

     Master gate board delta after §16.48.28:
       · CBP tier unchanged: 4 (30/31/32/53).
       · SANDBOX-APPLIED tier gains migration 362 (joins 353/
         356/357/358/359/360).
       · PROG-VER tier gains two unit test files (14 new tests
         · roster-authorization + confirm-room-join).
       · BLOCKED-CRED unchanged at 10 (40/41/44/45/50/52/60/65/
         66/70 · 40 and 41 are source-correct now but not yet
         re-dispatched connected).
       · BLOCKED-PROV unchanged at 5 (42/43/51/63/64).
       · Decisions queued carry forward: D1 credentials · D3
         provision D/E · D6 SMTP attest · D7 Config Y execute.

     (§16.48.29 · 2026-11-20): direct-dispatch sandbox probe ·
     owner A1 path · 10-case batch · 9 PASS + 1 PARTIAL. D1
     (credentials) unblocked in-process via parent-held in-memory
     passwords; identities A/B/C real sandbox Auth rows reset
     once each via admin.updateUserById (no admin.createUser).
     See evidence/master-flow/RECONCILIATION-LEDGER-2026-11-18.md
     §16.48.29 for full report.

     New file (additive · zero existing-file script edits):
       · scripts/gate-a-connected-matrix/_reset-and-run-16-48-29.mjs
         (573 lines · preserves every _runner.mjs safeguard
         including production ref hard-refuse at URL + DB URL +
         service-role JWT ref claim + anon JWT ref claim)
       · scripts/gate-a-connected-matrix/_results.16-48-29.json.OUTPUT
         (verdict file · atomic write)

     Connected outcomes (child structured verdict takes precedence
     over parent exit code):
       · 40 V-W1-NEW         PASS   CONNECTED      → CBP
       · 41 V-W1-EXIST       PASS   CONNECTED      → CBP
       · 44 V-W1-WHITESPACE  PASS   CONNECTED      → CBP
       · 45 V-W1-DUP         PASS   CONNECTED      → CBP
       · 50 V-W2-OK          PASS   CONNECTED      → CBP
       · 52 V-W2-DUP         PASS   CONNECTED      → CBP
       · 60 V-W3-UPDATE      PASS   CONNECTED      → CBP
       · 65 V-W3-PROMOTE     PASS   CONNECTED      → CBP
       · 66 V-W3-NOPROMOTE   PASS   CONNECTED      → CBP
       · 70 V-ATOMIC         PARTIAL PARTIAL-COVERAGE
            "Only 3/4 rows. Single-write atomicity cannot be
             fully tested without 5+ identities."

     Classifier-bug disclosure (self-audit per A1 §6): parent
     classify() in _reset-and-run-16-48-29.mjs decides PASS strictly
     on exit===0; it does NOT read the child's structured verdict
     field. Case 70 exits 0 on PARTIAL (script line 130), so the
     parent one-line summary reported "PASS=10". Raw child JSON at
     _results.16-48-29.json.OUTPUT:294-311 carries the correct
     verdict; ledger + this entry record 70 as PARTIAL, not PASS.

     Case G STATE_BLOCKER status: UNCHANGED. Two complementary
     reasons:
       (1) architectural — nex_invite_to_call_tx uses
           BEGIN...EXCEPTION WHEN unique_violation THEN...END
           which CATCHES and HANDLES (dedup path returning
           out_skipped='already_invited'), does NOT re-raise · no
           supported RPC path exposes a mid-function fault between
           session INSERT and participant INSERT;
       (2) identity count — 70_v_atomic needs preCount >= 4 to
           reach the P0001 cap-trigger path; with A/B/C only,
           preCount = 3 and the script short-circuits before any
           failing RPC call. Even with D3 (D/E provisioned),
           reason (1) still leaves Case G blocked.

     Master gate board delta after §16.48.29 (relative to §16.48.27
     baseline · additive to §16.48.28 deltas):
       · CBP: 4 → 13 (+9 · 40/41/44/45/50/52/60/65/66).
       · BLOCKED-CRED: 10 → 1 (−9 · 70 reclassified).
       · PARTIAL-COVERAGE: 0 → 1 (+1 · 70).
       · SANDBOX-APPLIED: carries §16.48.28 mig 362.
       · PROG-VER: carries §16.48.28 unit tests.
       · BLOCKED-PROV unchanged at 5 (42/43/51/63/64).
       · STATE_BLOCKER unchanged at 1 (Case G).

     What §16.48.29 does NOT upgrade:
       · Case G architectural STATE_BLOCKER — unchanged.
       · 42/43/51/63/64 BLOCKED-PROV — D3 still pending.
       · Production ijvqdvsvwtwxzcqmoqit — SEALED and untouched.
       · No CI/remote run · no commit · no push · no deploy.
       · No _runner.mjs edit · no _shared.mjs edit.
       · Engineering ceiling remains Verified. Prod-configured +
         Live-verified stay owner-only.

     Side effects landed in sandbox kdstoyyeygcopkogqsyv:
       · 3 × auth.users rows updated (password hash + updated_at);
       · 10 new nex_group_call_session rows + ~20 participant rows
         + ~5 peer_conversation rows + ~10 peer_message rows
         retained (GATE_A_SKIP_CLEANUP=1 · forensic retention);
       · 0 production writes · 0 schema changes · 0 migrations.

     Final classification per A1 §7: SANDBOX NOT COMPLETE.
     Residual: 1 PARTIAL (70), 1 STATE_BLOCKER (Case G),
     5 BLOCKED-PROV (D3 pending).

   H · vault idle/hidden lock (5 min / 1 min, startVaultIdleGuard)
        · locks every /vault/* route; unrelated journeys untouched.

   I · settings/security/delete-account
        · UI is a single-step form (password + "DELETE" phrase +
         optional reason); the "6 steps" live SERVER-SIDE in
         deleteOwnAccount: attempted-audit → session-bump →
         nex_account_mark_deleted RPC → page-view scrub →
         auth-pseudonymise → auth.admin.deleteUser → completed-audit.
         Route ALWAYS calls the service with session.account.id +
         session.supabaseUserId (body-smuggled account_id /
         ownerAccountId / supabase_user_id are IGNORED · §16.31
         I-OWNER). Retry after partial soft-delete failure is
         idempotent and emits exactly one .completed audit;
         auth-delete "user not found" on retry is treated as success;
         real auth-delete failure returns ok:false auth_delete_failed
         (partial state visible, NOT a silent 200).

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
