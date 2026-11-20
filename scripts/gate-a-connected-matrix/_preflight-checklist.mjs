// scripts/gate-a-connected-matrix/_preflight-checklist.mjs
//
// Gate A §16.48.18 · Pre-flight checklist printer (OFFLINE PURE).
// Gate A §16.48.19 · Fail-closed gates G-SMTP-ATTEST, G-DB-CRED, G-TARGET-REF.
// Gate A §16.48.21 · G-SMTP-ATTEST enum expanded to two valid configs:
//                    "yes" (Config Y · Confirm email ON + custom SMTP) and
//                    "confirm-off" (Config X · Confirm email OFF; no outbound
//                    email expected). Any other non-empty value fails closed
//                    as UNVERIFIED-BLOCKED with refusalCode
//                    GATE_A_SMTP_CUSTOM_ENABLED_INVALID_VALUE; raw value
//                    is NEVER echoed. Unset/empty stays UNVERIFIED-BLOCKED
//                    with refusalCode GATE_A_SMTP_CUSTOM_ENABLED_UNSET.
//                    runGates now returns an additional smtpAttestConfig
//                    field ("X" | "Y" | null).
// Gate A §16.48.22 · G-DB-CRED retires the _db-cred-check.status.OUTPUT
//                    marker and reads evidence/attestations/db-cred-verified.flag
//                    (the output of 91_db_cred_probe.mjs) directly. Input
//                    field renamed dbCredStatusPath → dbCredFlagPath.
//                    New refusal codes: DB_CRED_FLAG_MISSING,
//                    DB_CRED_FLAG_EMPTY, DB_CRED_FLAG_MALFORMED_JSON,
//                    DB_CRED_FLAG_MISSING_VERDICT_FIELD,
//                    DB_CRED_PROBE_LAST_RUN_FAILED,
//                    DB_CRED_FLAG_UNRECOGNISED_VERDICT,
//                    DB_CRED_FLAG_WRONG_PROJECT_REF (forward-compat;
//                    activates only if the probe writes project_ref),
//                    DB_CRED_FLAG_BAD_CHECKED_AT, DB_CRED_FLAG_STALE.
//                    ATTESTED gate record carries source + checked_at +
//                    current_database for the printer line.
//
// HARD INVARIANTS
// ───────────────
// · Pure print function + pure runGates evaluator.
// · runGates reads at most ONE file: the dbCredFlagPath probe-output file
//   (§16.48.22; was dbCredStatusPath until §16.48.21). No other filesystem
//   reads/writes. No process.env reads inside runGates.
// · printPreflightChecklist MAY read process.env.GATE_A_SMTP_CUSTOM_ENABLED
//   as a convenience shortcut when the caller omits smtpCustomEnabled.
//   NO other env reads.
// · NEVER prints DATABASE_URL, JWT, service role keys, anon keys,
//   passwords, or unknown project refs, or any raw env/input value that
//   failed grammar validation. Status is tier label + refusalCode only.
// · Returns undefined.
// · Validates input strictly; throws Error("printPreflightChecklist:
//   invalid input") on any invalid shape. The error message does NOT
//   contain the raw invalid value.
// · runGates throws Error("runGates: invalid input") ONLY on structurally
//   malformed input (non-object, missing/empty dbCredStatusPath or
//   targetProjectRef, non-string smtpCustomEnabled). It does NOT throw
//   on an unknown smtpCustomEnabled string — that fails closed as an
//   UNVERIFIED-BLOCKED gate instead, mirroring the 90_cleanup.mjs
//   refusalCode grammar.
// · The caller does NOT fail on blocked gates — this module just prints
//   them clearly. The ACTUAL hard refusal of a connected run is a
//   separate "connected run" wrapper (not in §16.48.19 scope).
//
// Loaded dynamically by _runner.mjs behind try/catch. When absent, the
// runner proceeds silently.

import { readFileSync, existsSync } from "node:fs";

const BANNER =
  "── PRE-FLIGHT CHECKLIST · §16.48.18 ─────────────────────────────";

const GATE_BANNER =
  "── FAIL-CLOSED GATES · §16.48.19 ────────────────────────────────";

const FOOTER_1 =
  "Items tagged [UNVERIFIED] require OWNER acknowledgement before a";
const FOOTER_2 =
  "connected run. ENGINEERING CANNOT UPGRADE THESE from the harness —";
const FOOTER_3 =
  "they depend on Studio reads or operator-attested state.";

// Canonical sandbox ref — hardcoded on purpose. Preflight stays self-contained
// and does NOT import _runner.mjs.
const CANONICAL_SANDBOX_REF = "kdstoyyeygcopkogqsyv";
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";
const DB_CRED_FRESHNESS_MS = 24 * 60 * 60 * 1000; // 24 hours

function isBoolean(v) {
  return v === true || v === false;
}

// ─────────────────────────────────────────────────────────────────────────────
// runGates — pure evaluator for the §16.48.19 fail-closed gates.
// No process.env reads. One readFileSync of dbCredStatusPath (optional).
// Returns { allPass, gates: [{name, tier, reason, operator_action}] }.
// ─────────────────────────────────────────────────────────────────────────────
export function runGates(input) {
  if (input == null || typeof input !== "object") {
    throw new Error("runGates: invalid input");
  }
  const { smtpCustomEnabled, dbCredFlagPath, targetProjectRef, now } = input;
  const nowMs = typeof now === "number" ? now : Date.now();

  // ── Gate G-SMTP-ATTEST (§16.48.21 enum) ─────────────────────────────
  // smtpCustomEnabled grammar — fail-closed, strict enum of TWO valid values:
  //   undefined          → UNVERIFIED-BLOCKED · refusalCode GATE_A_SMTP_CUSTOM_ENABLED_UNSET
  //   ""                 → UNVERIFIED-BLOCKED · refusalCode GATE_A_SMTP_CUSTOM_ENABLED_UNSET
  //   "yes"              → ATTESTED · smtpAttestConfig "Y"
  //                        (Config Y: Confirm email ON + custom SMTP;
  //                        email-confirmation journey WILL be exercised)
  //   "confirm-off"      → ATTESTED · smtpAttestConfig "X"
  //                        (Config X: Confirm email OFF; no outbound email
  //                        expected; email-confirmation journey UNVERIFIED,
  //                        deferred to a later Brevo-enabled round)
  //   any other string   → UNVERIFIED-BLOCKED · refusalCode
  //                        GATE_A_SMTP_CUSTOM_ENABLED_INVALID_VALUE.
  //                        The raw value is NEVER echoed in reason,
  //                        operator_action, or anywhere else.
  //   non-string         → throw "runGates: invalid input" (structural error).
  let smtpGate;
  let smtpAttestConfig = null;
  if (smtpCustomEnabled !== undefined && typeof smtpCustomEnabled !== "string") {
    throw new Error("runGates: invalid input");
  }
  if (smtpCustomEnabled === undefined || smtpCustomEnabled === "") {
    smtpGate = {
      name: "G-SMTP-ATTEST",
      tier: "UNVERIFIED-BLOCKED",
      refusalCode: "GATE_A_SMTP_CUSTOM_ENABLED_UNSET",
      reason:
        "sandbox SMTP attestation not supplied; harness cannot verify whether " +
        "Supabase default relay or custom Brevo SMTP is active, nor whether " +
        "Confirm email is intentionally OFF",
      operator_action:
        "Choose a configuration and re-run preflight. Config X: set " +
        "GATE_A_SMTP_CUSTOM_ENABLED=confirm-off (Confirm email OFF in sandbox " +
        CANONICAL_SANDBOX_REF +
        " Auth → Providers → Email; no SMTP setup needed; email-confirmation " +
        "journey stays UNVERIFIED). Config Y: enable custom Brevo SMTP in " +
        "sandbox " +
        CANONICAL_SANDBOX_REF +
        " Auth → Emails and set GATE_A_SMTP_CUSTOM_ENABLED=yes.",
    };
  } else if (smtpCustomEnabled === "yes") {
    smtpGate = {
      name: "G-SMTP-ATTEST",
      tier: "ATTESTED",
      refusalCode: null,
      reason:
        "operator attested Config Y: Confirm email ON + custom Brevo SMTP is " +
        "enabled on sandbox; email-confirmation journey will be exercised",
      operator_action: null,
    };
    smtpAttestConfig = "Y";
  } else if (smtpCustomEnabled === "confirm-off") {
    smtpGate = {
      name: "G-SMTP-ATTEST",
      tier: "ATTESTED",
      refusalCode: null,
      reason:
        "operator attested Config X: Confirm email OFF; no outbound email " +
        "expected; email-confirmation journey labelled UNVERIFIED and " +
        "deferred to a later Brevo-enabled round",
      operator_action: null,
    };
    smtpAttestConfig = "X";
  } else {
    // Unknown string — fail closed WITHOUT echoing the raw value and WITHOUT
    // throwing. Mirrors the 90_cleanup.mjs refusalCode grammar.
    smtpGate = {
      name: "G-SMTP-ATTEST",
      tier: "UNVERIFIED-BLOCKED",
      refusalCode: "GATE_A_SMTP_CUSTOM_ENABLED_INVALID_VALUE",
      reason:
        "GATE_A_SMTP_CUSTOM_ENABLED does not match the expected enum of " +
        "two valid values; raw value withheld from logs",
      operator_action:
        "Set GATE_A_SMTP_CUSTOM_ENABLED to exactly 'yes' (Config Y: Confirm " +
        "email ON + custom Brevo SMTP on sandbox " +
        CANONICAL_SANDBOX_REF +
        ") or exactly 'confirm-off' (Config X: Confirm email OFF; no SMTP " +
        "setup; email-confirmation journey left UNVERIFIED). No other value " +
        "is accepted.",
    };
  }

  // ── Gate G-DB-CRED (§16.48.22) ──────────────────────────────────────
  // Flag file (probe output): missing → UNVERIFIED-BLOCKED; empty →
  // UNVERIFIED-BLOCKED; malformed JSON → UNVERIFIED-BLOCKED; missing
  // verdict field → UNVERIFIED-BLOCKED; verdict FAIL → BLOCKED;
  // unrecognised verdict → UNVERIFIED-BLOCKED; project_ref present
  // and != sandbox → UNVERIFIED-BLOCKED (defence in depth, forward
  // compat); bad checked_at → UNVERIFIED-BLOCKED; PASS older than 24h
  // → STALE-BLOCKED; PASS within 24h + schema OK → ATTESTED.
  let dbGate;
  if (typeof dbCredFlagPath !== "string" || dbCredFlagPath === "") {
    throw new Error("runGates: invalid input");
  }
  const dbOperatorAction =
    "Run node scripts/gate-a-connected-matrix/91_db_cred_probe.mjs against " +
    "sandbox " +
    CANONICAL_SANDBOX_REF +
    " (one-shot; probe writes evidence/attestations/db-cred-verified.flag " +
    "only on PASS). Re-run preflight.";
  if (!existsSync(dbCredFlagPath)) {
    dbGate = {
      name: "G-DB-CRED",
      tier: "UNVERIFIED-BLOCKED",
      refusalCode: "DB_CRED_FLAG_MISSING",
      reason: "DB credential probe flag not found at the configured path",
      operator_action: dbOperatorAction,
    };
  } else {
    let raw = "";
    let readError = null;
    try {
      raw = readFileSync(dbCredFlagPath, "utf8");
    } catch (_e) {
      readError = "read failed";
    }
    if (readError) {
      dbGate = {
        name: "G-DB-CRED",
        tier: "UNVERIFIED-BLOCKED",
        refusalCode: "DB_CRED_FLAG_MALFORMED_JSON",
        reason: "DB credential probe flag could not be read",
        operator_action: dbOperatorAction,
      };
    } else if (raw.trim() === "") {
      dbGate = {
        name: "G-DB-CRED",
        tier: "UNVERIFIED-BLOCKED",
        refusalCode: "DB_CRED_FLAG_EMPTY",
        reason: "DB credential probe flag is empty",
        operator_action: dbOperatorAction,
      };
    } else {
      let parsed = null;
      let parseError = null;
      try {
        parsed = JSON.parse(raw);
      } catch (_e) {
        parseError = "parse failed";
      }
      if (parseError || !parsed || typeof parsed !== "object") {
        dbGate = {
          name: "G-DB-CRED",
          tier: "UNVERIFIED-BLOCKED",
          refusalCode: "DB_CRED_FLAG_MALFORMED_JSON",
          reason: "DB credential probe flag is not valid JSON",
          operator_action: dbOperatorAction,
        };
      } else if (typeof parsed.verdict !== "string") {
        dbGate = {
          name: "G-DB-CRED",
          tier: "UNVERIFIED-BLOCKED",
          refusalCode: "DB_CRED_FLAG_MISSING_VERDICT_FIELD",
          reason: "DB credential probe flag has no verdict field",
          operator_action: dbOperatorAction,
        };
      } else if (parsed.verdict === "DB_CRED_PROBE_FAIL") {
        dbGate = {
          name: "G-DB-CRED",
          tier: "BLOCKED",
          refusalCode: "DB_CRED_PROBE_LAST_RUN_FAILED",
          reason: "last DB credential probe run reported FAIL",
          operator_action:
            "Diagnose the probe failure (see evidence/attestations/" +
            "db-cred-verified.flag contents; probe refuses to write on " +
            "ref mismatch so a FAIL here reflects a connection/query " +
            "error), fix, and re-run " +
            "node scripts/gate-a-connected-matrix/91_db_cred_probe.mjs.",
        };
      } else if (parsed.verdict !== "DB_CRED_PROBE_PASS") {
        dbGate = {
          name: "G-DB-CRED",
          tier: "UNVERIFIED-BLOCKED",
          refusalCode: "DB_CRED_FLAG_UNRECOGNISED_VERDICT",
          reason:
            "DB credential probe flag verdict is not one of " +
            "DB_CRED_PROBE_PASS or DB_CRED_PROBE_FAIL",
          operator_action: dbOperatorAction,
        };
      } else if (
        Object.prototype.hasOwnProperty.call(parsed, "project_ref") &&
        parsed.project_ref !== CANONICAL_SANDBOX_REF
      ) {
        // Defence in depth · forward compat. Current probe (§16.48.20)
        // does NOT write project_ref; this branch activates if a future
        // round extends the probe. Raw ref value is NEVER echoed because
        // forbidden values include the production ref.
        dbGate = {
          name: "G-DB-CRED",
          tier: "UNVERIFIED-BLOCKED",
          refusalCode: "DB_CRED_FLAG_WRONG_PROJECT_REF",
          reason:
            "DB credential probe flag names a project_ref other than the " +
            "canonical sandbox; raw value withheld from logs",
          operator_action:
            "Re-run " +
            "node scripts/gate-a-connected-matrix/91_db_cred_probe.mjs " +
            "against sandbox " +
            CANONICAL_SANDBOX_REF +
            ". Refusing to proceed.",
        };
      } else {
        const checkedAtMs =
          typeof parsed.checked_at === "string"
            ? Date.parse(parsed.checked_at)
            : NaN;
        if (!Number.isFinite(checkedAtMs)) {
          dbGate = {
            name: "G-DB-CRED",
            tier: "UNVERIFIED-BLOCKED",
            refusalCode: "DB_CRED_FLAG_BAD_CHECKED_AT",
            reason:
              "DB credential probe flag has invalid or missing checked_at " +
              "timestamp",
            operator_action: dbOperatorAction,
          };
        } else if (nowMs - checkedAtMs > DB_CRED_FRESHNESS_MS) {
          dbGate = {
            name: "G-DB-CRED",
            tier: "STALE-BLOCKED",
            refusalCode: "DB_CRED_FLAG_STALE",
            reason:
              "last DB credential probe PASS is older than 24 hours",
            operator_action: dbOperatorAction,
          };
        } else {
          dbGate = {
            name: "G-DB-CRED",
            tier: "ATTESTED",
            refusalCode: null,
            reason:
              "DB credential probe PASS within the last 24 hours (source: " +
              dbCredFlagPath +
              ")",
            operator_action: null,
            source: dbCredFlagPath,
            checked_at: parsed.checked_at,
            current_database:
              typeof parsed.current_database === "string"
                ? parsed.current_database
                : null,
          };
        }
      }
    }
  }

  // ── Gate G-TARGET-REF ───────────────────────────────────────────────
  // sandbox ref → ATTESTED; production ref → throw; other → BLOCKED (never
  // echo the raw value); missing/empty → throw.
  let refGate;
  if (typeof targetProjectRef !== "string" || targetProjectRef === "") {
    throw new Error("runGates: invalid input");
  } else if (targetProjectRef === PRODUCTION_REF) {
    throw new Error("runGates: preflight refuses production ref — abort");
  } else if (targetProjectRef === CANONICAL_SANDBOX_REF) {
    refGate = {
      name: "G-TARGET-REF",
      tier: "ATTESTED",
      reason:
        "target project ref matches canonical sandbox " + CANONICAL_SANDBOX_REF,
      operator_action: null,
    };
  } else {
    refGate = {
      name: "G-TARGET-REF",
      tier: "BLOCKED",
      reason: "unknown project ref — refuse",
      operator_action:
        "Set targetProjectRef to the canonical sandbox ref " +
        CANONICAL_SANDBOX_REF +
        ". Refusing to proceed.",
    };
  }

  const gates = [smtpGate, dbGate, refGate];
  const allPass = gates.every((g) => g.tier === "ATTESTED");
  // smtpAttestConfig mirrors G-SMTP-ATTEST: "X" for Config X (confirm-off),
  // "Y" for Config Y (yes), null for any non-ATTESTED outcome.
  const effectiveSmtpAttestConfig =
    smtpGate.tier === "ATTESTED" ? smtpAttestConfig : null;
  return { allPass, gates, smtpAttestConfig: effectiveSmtpAttestConfig };
}

// ─────────────────────────────────────────────────────────────────────────────
// printPreflightChecklist — unchanged §16.48.18 footprint + new gates.
// Backward-compatible: calling with only the four §16.48.18 fields still works
// (each new gate prints as UNVERIFIED-BLOCKED).
// ─────────────────────────────────────────────────────────────────────────────
export function printPreflightChecklist(input) {
  if (input == null || typeof input !== "object") {
    throw new Error("printPreflightChecklist: invalid input");
  }

  const { identityMode, boundedProfile, skipCleanup, dryRun } = input;

  if (identityMode !== "three" && identityMode !== "two") {
    throw new Error("printPreflightChecklist: invalid input");
  }
  if (boundedProfile !== null && boundedProfile !== "abc-14") {
    throw new Error("printPreflightChecklist: invalid input");
  }
  if (!isBoolean(skipCleanup)) {
    throw new Error("printPreflightChecklist: invalid input");
  }
  if (!isBoolean(dryRun)) {
    throw new Error("printPreflightChecklist: invalid input");
  }

  const boundedLabel = boundedProfile === null ? "unset" : boundedProfile;

  console.log(BANNER);

  // ── Echoed flag state ──────────────────────────────────────────────
  console.log(`  GATE_A_IDENTITY_MODE      : ${identityMode}`);
  console.log(`  GATE_A_BOUNDED_PROFILE    : ${boundedLabel}`);
  console.log(`  GATE_A_SKIP_CLEANUP       : ${skipCleanup}`);
  console.log(`  GATE_A_DRY_RUN            : ${dryRun}`);

  console.log("");
  console.log("  Readiness items (owner-attested, not engineering-verifiable):");

  // ── UNVERIFIED tier items (§16.48.18) ──────────────────────────────
  console.log(
    "    [UNVERIFIED] Sandbox credentials present in .env.local " +
      "(operator-attested; harness does not read the file)",
  );
  console.log(
    "    [UNVERIFIED] Sandbox Auth 'Confirm email' setting " +
      "(owner-only Studio read required)",
  );
  console.log(
    "    [UNVERIFIED] Sandbox Auth rate-limit state " +
      "(owner-only Studio read required)",
  );
  console.log(
    "    [UNVERIFIED] SMTP sender configured (default vs Brevo) " +
      "(owner-only Studio read required)",
  );
  console.log(
    "    [UNVERIFIED] Stale _results.json.OUTPUT rotated aside " +
      "(operator-attested)",
  );

  // ── §16.48.19 fail-closed gates ────────────────────────────────────
  console.log("");
  console.log(GATE_BANNER);

  // Pull smtpCustomEnabled from input first, fall back to env as a
  // convenience shortcut (documented in the header). The env read is
  // the ONLY process.env access allowed in this module, and only here.
  let smtpInput = input.smtpCustomEnabled;
  if (smtpInput === undefined) {
    // Convenience shortcut — operator may set GATE_A_SMTP_CUSTOM_ENABLED
    // in the shell and skip passing it in explicitly. runGates itself
    // never reads env.
    const raw = process.env.GATE_A_SMTP_CUSTOM_ENABLED;
    if (raw !== undefined) smtpInput = raw;
  }

  let gatesResult;
  try {
    gatesResult = runGates({
      smtpCustomEnabled: smtpInput,
      dbCredFlagPath: input.dbCredFlagPath || defaultDbCredFlagPath(),
      targetProjectRef:
        input.targetProjectRef || CANONICAL_SANDBOX_REF, // default to sandbox for callers that only want the §16.48.18 shape
    });
  } catch (e) {
    // If runGates throws (e.g. production ref), surface the reason without
    // echoing the raw value.
    console.log(`    [BLOCKED] runGates refused: ${e.message}`);
    console.log("");
    console.log(FOOTER_1);
    console.log(FOOTER_2);
    console.log(FOOTER_3);
    return;
  }

  for (const g of gatesResult.gates) {
    // Base tier + name + reason. For G-SMTP-ATTEST ATTESTED outcomes,
    // append a config-detection suffix (§16.48.21) so operators can see
    // at a glance which of the two valid configs was attested.
    let line = `    [${g.tier}] ${g.name} · ${g.reason}`;
    if (
      g.name === "G-SMTP-ATTEST" &&
      g.tier === "ATTESTED" &&
      gatesResult.smtpAttestConfig === "X"
    ) {
      line =
        "    G-SMTP-ATTEST: ATTESTED · detected config = X " +
        "(Confirm email OFF; email-confirmation journey UNVERIFIED, " +
        "deferred to a later Brevo round)";
    } else if (
      g.name === "G-SMTP-ATTEST" &&
      g.tier === "ATTESTED" &&
      gatesResult.smtpAttestConfig === "Y"
    ) {
      line =
        "    G-SMTP-ATTEST: ATTESTED · detected config = Y " +
        "(Confirm email ON + custom SMTP; email-confirmation journey " +
        "will be exercised)";
    } else if (g.name === "G-DB-CRED" && g.tier === "ATTESTED") {
      // §16.48.22 printer: show probe output path + checked_at +
      // current_database (none are secrets — the probe writes
      // "postgres" by default).
      line =
        "    G-DB-CRED: ATTESTED · source = " +
        (g.source || "evidence/attestations/db-cred-verified.flag") +
        " · checked_at = " +
        (g.checked_at || "unknown") +
        " · current_database = " +
        (g.current_database === null || g.current_database === undefined
          ? "(not reported)"
          : g.current_database);
    }
    console.log(line);
    if (g.refusalCode) {
      console.log(`      refusalCode: ${g.refusalCode}`);
    }
    if (g.operator_action) {
      console.log(`      → ${g.operator_action}`);
    }
  }
  if (gatesResult.allPass) {
    console.log("    All §16.48.19 gates ATTESTED. Preflight does NOT itself");
    console.log("    authorise a connected run — the connected-run wrapper is");
    console.log("    a separate owner-gated step (Option α).");
  } else {
    console.log("    One or more §16.48.19 gates are not ATTESTED. The");
    console.log("    connected-run wrapper (Option α) must refuse until each");
    console.log("    gate reaches ATTESTED. Address the operator actions above.");
  }

  console.log("");
  console.log(FOOTER_1);
  console.log(FOOTER_2);
  console.log(FOOTER_3);
}

// Default DB-cred flag path (§16.48.22), computed lazily so this module
// stays side-effect-free at import time. Points at the probe's single
// output file. _db-cred-check.status.OUTPUT is retired.
function defaultDbCredFlagPath() {
  // The runner passes an absolute path via input when invoked directly; this
  // default is used only if the caller omits it. Pure string op — no fs or
  // process.cwd reads at module scope.
  return "evidence/attestations/db-cred-verified.flag";
}
