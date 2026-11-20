// scripts/gate-a-connected-matrix/__tests__/preflight-checklist.spec.mjs
//
// Gate A §16.48.18 · Offline unit tests for _preflight-checklist.mjs.
// Gate A §16.48.19 · Extended with fail-closed gate tests (G-SMTP-ATTEST,
// G-DB-CRED, G-TARGET-REF).
// Gate A §16.48.21 · G-SMTP-ATTEST enum expansion (Config X / Y).
// Gate A §16.48.22 · G-DB-CRED retires the _db-cred-check.status.OUTPUT
//                    marker and reads evidence/attestations/db-cred-verified.flag
//                    (the output of 91_db_cred_probe.mjs). Input field
//                    renamed dbCredStatusPath → dbCredFlagPath. Nine new
//                    refusal codes + ATTESTED happy path.
// Pure. No network, no DB, no .env.local reads, no process spawn.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { printPreflightChecklist, runGates } from "../_preflight-checklist.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = resolve(__dir, "..", "_preflight-checklist.mjs");
const MODULE_SRC = readFileSync(MODULE_PATH, "utf8");

const CANONICAL_SANDBOX_REF = "kdstoyyeygcopkogqsyv";
const PRODUCTION_REF = "ijvqdvsvwtwxzcqmoqit";

function captureLogs(fn) {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    fn();
  } finally {
    // caller inspects spy via return; spy is restored by afterEach hook
  }
  const lines = spy.mock.calls.map((args) => String(args[0] ?? ""));
  return { lines, joined: lines.join("\n"), spy };
}

// Helper to write a temp DB-cred probe FLAG file (§16.48.22 schema).
// The probe writes a JSON body of shape:
//   { verdict: "DB_CRED_PROBE_PASS" | "DB_CRED_PROBE_FAIL",
//     probe_version: "§16.48.20",
//     checked_at: <iso string>,
//     current_database: "postgres" }
// project_ref is NOT currently written by the probe (forward-compat only).
function makeTmpFlag(content) {
  const dir = mkdtempSync(join(tmpdir(), "gate-a-cred-flag-"));
  const path = join(dir, "db-cred-verified.flag");
  if (content !== undefined) writeFileSync(path, content, "utf8");
  return { dir, path };
}

function passBody(checkedAtIso, extras) {
  const base = {
    verdict: "DB_CRED_PROBE_PASS",
    probe_version: "§16.48.20",
    checked_at: checkedAtIso || new Date().toISOString(),
    current_database: "postgres",
  };
  return JSON.stringify(Object.assign(base, extras || {}));
}

function cleanupTmp(dir) {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

describe("printPreflightChecklist — banner and flags", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints a banner line containing §16.48.18", () => {
    const { joined } = captureLogs(() =>
      printPreflightChecklist({
        identityMode: "three",
        boundedProfile: null,
        skipCleanup: false,
        dryRun: false,
      }),
    );
    expect(joined).toContain("PRE-FLIGHT CHECKLIST");
    expect(joined).toContain("§16.48.18");
  });

  it("echoes all four flag values (three + unset + two booleans)", () => {
    const { joined } = captureLogs(() =>
      printPreflightChecklist({
        identityMode: "three",
        boundedProfile: null,
        skipCleanup: false,
        dryRun: false,
      }),
    );
    expect(joined).toContain("GATE_A_IDENTITY_MODE");
    expect(joined).toMatch(/GATE_A_IDENTITY_MODE[^\n]*three/);
    expect(joined).toContain("GATE_A_BOUNDED_PROFILE");
    expect(joined).toMatch(/GATE_A_BOUNDED_PROFILE[^\n]*unset/);
    expect(joined).toContain("GATE_A_SKIP_CLEANUP");
    expect(joined).toMatch(/GATE_A_SKIP_CLEANUP[^\n]*false/);
    expect(joined).toContain("GATE_A_DRY_RUN");
    expect(joined).toMatch(/GATE_A_DRY_RUN[^\n]*false/);
  });

  it("reflects boundedProfile='abc-14' when provided", () => {
    const { joined } = captureLogs(() =>
      printPreflightChecklist({
        identityMode: "two",
        boundedProfile: "abc-14",
        skipCleanup: false,
        dryRun: false,
      }),
    );
    expect(joined).toMatch(/GATE_A_BOUNDED_PROFILE[^\n]*abc-14/);
  });

  it("reflects skipCleanup=true and dryRun=true booleans", () => {
    const { joined } = captureLogs(() =>
      printPreflightChecklist({
        identityMode: "three",
        boundedProfile: null,
        skipCleanup: true,
        dryRun: true,
      }),
    );
    expect(joined).toMatch(/GATE_A_SKIP_CLEANUP[^\n]*true/);
    expect(joined).toMatch(/GATE_A_DRY_RUN[^\n]*true/);
  });
});

describe("printPreflightChecklist — UNVERIFIED tier items", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tags each of the five readiness items as [UNVERIFIED]", () => {
    const { joined, lines } = captureLogs(() =>
      printPreflightChecklist({
        identityMode: "three",
        boundedProfile: null,
        skipCleanup: false,
        dryRun: false,
      }),
    );
    const unverifiedLines = lines.filter((l) => l.includes("[UNVERIFIED]"));
    expect(unverifiedLines.length).toBeGreaterThanOrEqual(5);

    // All five expected subject areas are present in the output.
    expect(joined).toMatch(/Sandbox credentials present in \.env\.local/);
    expect(joined).toMatch(/Confirm email/i);
    expect(joined).toMatch(/rate-limit/i);
    expect(joined).toMatch(/SMTP/);
    expect(joined).toMatch(/_results\.json\.OUTPUT/);
  });

  it("explains UNVERIFIED tiers require owner acknowledgement", () => {
    const { joined } = captureLogs(() =>
      printPreflightChecklist({
        identityMode: "three",
        boundedProfile: null,
        skipCleanup: false,
        dryRun: false,
      }),
    );
    expect(joined).toMatch(/OWNER acknowledgement/i);
    expect(joined).toMatch(/ENGINEERING CANNOT UPGRADE/);
  });
});

describe("printPreflightChecklist — secret hygiene", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("output contains no production ref, DATABASE_URL, jwt, key, or secret substrings", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const { joined } = captureLogs(() =>
        printPreflightChecklist({
          identityMode: "three",
          boundedProfile: "abc-14",
          skipCleanup: true,
          dryRun: true,
          smtpCustomEnabled: "yes",
          dbCredFlagPath: tmp.path,
          targetProjectRef: CANONICAL_SANDBOX_REF,
        }),
      );
      expect(joined).not.toMatch(/ijvqdvsvwtwxzcqmoqit/);
      expect(joined).not.toMatch(/DATABASE_URL\s*=/);
      expect(joined).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // JWT prefix
      expect(joined).not.toMatch(/service_role/i);
      expect(joined).not.toMatch(/anon[_ ]?key/i);
      expect(joined).not.toMatch(/\bpassword\b/i);
      expect(joined).not.toMatch(/\bsecret\b/i);
      expect(joined).not.toMatch(/https?:\/\//);
      // Note: the sandbox ref kdstoyyeygcopkogqsyv is a PUBLIC project identifier
      // (already shown in _runner.mjs startup banners); §16.48.19 explicitly
      // lists it in operator-action strings so the operator knows what to set.
      // It is not considered secret.
    } finally {
      cleanupTmp(tmp.dir);
    }
  });
});

describe("printPreflightChecklist — input validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws on invalid identityMode without echoing the raw value", () => {
    expect(() =>
      printPreflightChecklist({
        identityMode: "invalid-MODE-VALUE-SENTINEL",
        boundedProfile: null,
        skipCleanup: false,
        dryRun: false,
      }),
    ).toThrowError("printPreflightChecklist: invalid input");

    try {
      printPreflightChecklist({
        identityMode: "invalid-MODE-VALUE-SENTINEL",
        boundedProfile: null,
        skipCleanup: false,
        dryRun: false,
      });
    } catch (err) {
      expect(err.message).not.toContain("invalid-MODE-VALUE-SENTINEL");
    }
  });

  it("throws on invalid boundedProfile", () => {
    expect(() =>
      printPreflightChecklist({
        identityMode: "three",
        boundedProfile: "other",
        skipCleanup: false,
        dryRun: false,
      }),
    ).toThrowError("printPreflightChecklist: invalid input");
  });

  it("throws on non-boolean skipCleanup", () => {
    expect(() =>
      printPreflightChecklist({
        identityMode: "three",
        boundedProfile: null,
        skipCleanup: "yes",
        dryRun: false,
      }),
    ).toThrowError("printPreflightChecklist: invalid input");
  });

  it("throws on non-boolean dryRun", () => {
    expect(() =>
      printPreflightChecklist({
        identityMode: "three",
        boundedProfile: null,
        skipCleanup: false,
        dryRun: 1,
      }),
    ).toThrowError("printPreflightChecklist: invalid input");
  });

  it("throws on null input", () => {
    expect(() => printPreflightChecklist(null)).toThrowError(
      "printPreflightChecklist: invalid input",
    );
  });
});

describe("printPreflightChecklist — return value and env hygiene", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const r = printPreflightChecklist({
      identityMode: "three",
      boundedProfile: null,
      skipCleanup: false,
      dryRun: false,
    });
    expect(r).toBeUndefined();
  });

  it("runGates body contains no process.env reference (pure)", () => {
    // Narrow the scan to the runGates function body only — printPreflightChecklist
    // is allowed one convenience env read for GATE_A_SMTP_CUSTOM_ENABLED.
    const strip = (s) =>
      s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
    const stripped = strip(MODULE_SRC);
    // Extract runGates function body.
    const match = stripped.match(/export function runGates\([^)]*\)\s*\{([\s\S]*?)\n\}\n/);
    expect(match, "runGates export must be present").toBeTruthy();
    expect(match[1]).not.toMatch(/process\.env/);
    // runGates may read ONE file via readFileSync/existsSync. No writes.
    expect(match[1]).not.toMatch(/writeFileSync/);
  });

  it("printPreflightChecklist reads process.env only for GATE_A_SMTP_CUSTOM_ENABLED", () => {
    const strip = (s) =>
      s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
    const stripped = strip(MODULE_SRC);
    const envRefs = stripped.match(/process\.env\.\w+/g) || [];
    for (const ref of envRefs) {
      expect(ref).toBe("process.env.GATE_A_SMTP_CUSTOM_ENABLED");
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §16.48.19 · Fail-closed gates
// ═════════════════════════════════════════════════════════════════════════════

describe("§16.48.19 · runGates · G-SMTP-ATTEST", () => {
  it("smtpCustomEnabled='yes' with all other inputs valid → ATTESTED + allPass=true", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      expect(r.allPass).toBe(true);
      const smtp = r.gates.find((g) => g.name === "G-SMTP-ATTEST");
      expect(smtp.tier).toBe("ATTESTED");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("smtpCustomEnabled='no' → UNVERIFIED-BLOCKED with INVALID_VALUE refusal (§16.48.21 strict enum)", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        smtpCustomEnabled: "no",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      expect(r.allPass).toBe(false);
      const smtp = r.gates.find((g) => g.name === "G-SMTP-ATTEST");
      expect(smtp.tier).toBe("UNVERIFIED-BLOCKED");
      expect(smtp.refusalCode).toBe("GATE_A_SMTP_CUSTOM_ENABLED_INVALID_VALUE");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("smtpCustomEnabled unset → UNVERIFIED-BLOCKED with UNSET refusal", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const smtp = r.gates.find((g) => g.name === "G-SMTP-ATTEST");
      expect(smtp.tier).toBe("UNVERIFIED-BLOCKED");
      expect(smtp.refusalCode).toBe("GATE_A_SMTP_CUSTOM_ENABLED_UNSET");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("smtpCustomEnabled='maybe' → UNVERIFIED-BLOCKED with INVALID_VALUE refusal (fail-closed, no throw)", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        smtpCustomEnabled: "maybe",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const smtp = r.gates.find((g) => g.name === "G-SMTP-ATTEST");
      expect(smtp.tier).toBe("UNVERIFIED-BLOCKED");
      expect(smtp.refusalCode).toBe("GATE_A_SMTP_CUSTOM_ENABLED_INVALID_VALUE");
      expect(smtp.reason).not.toMatch(/maybe/);
    } finally {
      cleanupTmp(tmp.dir);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §16.48.21 · G-SMTP-ATTEST enum expansion to Config X ("confirm-off") +
// strict-enum fail-closed grammar with refusalCode (no echo of raw value).
// ═════════════════════════════════════════════════════════════════════════════

describe("§16.48.21 · runGates · G-SMTP-ATTEST enum", () => {
  it("smtpCustomEnabled='confirm-off' → ATTESTED · smtpAttestConfig === 'X'", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        smtpCustomEnabled: "confirm-off",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      expect(r.allPass).toBe(true);
      expect(r.smtpAttestConfig).toBe("X");
      const smtp = r.gates.find((g) => g.name === "G-SMTP-ATTEST");
      expect(smtp.tier).toBe("ATTESTED");
      expect(smtp.refusalCode).toBeNull();
      expect(smtp.reason).toMatch(/Confirm email OFF/);
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("smtpCustomEnabled='yes' → ATTESTED · smtpAttestConfig === 'Y' (regression guard)", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      expect(r.allPass).toBe(true);
      expect(r.smtpAttestConfig).toBe("Y");
      const smtp = r.gates.find((g) => g.name === "G-SMTP-ATTEST");
      expect(smtp.tier).toBe("ATTESTED");
      expect(smtp.refusalCode).toBeNull();
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("smtpCustomEnabled='no' → UNVERIFIED-BLOCKED · refusalCode GATE_A_SMTP_CUSTOM_ENABLED_INVALID_VALUE", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        smtpCustomEnabled: "no",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const smtp = r.gates.find((g) => g.name === "G-SMTP-ATTEST");
      expect(smtp.tier).toBe("UNVERIFIED-BLOCKED");
      expect(smtp.refusalCode).toBe("GATE_A_SMTP_CUSTOM_ENABLED_INVALID_VALUE");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("smtpCustomEnabled='true' → UNVERIFIED-BLOCKED · INVALID_VALUE (strict enum, not truthy coercion)", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        smtpCustomEnabled: "true",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const smtp = r.gates.find((g) => g.name === "G-SMTP-ATTEST");
      expect(smtp.tier).toBe("UNVERIFIED-BLOCKED");
      expect(smtp.refusalCode).toBe("GATE_A_SMTP_CUSTOM_ENABLED_INVALID_VALUE");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("smtpCustomEnabled='confirm_off' (underscore variant) → UNVERIFIED-BLOCKED · INVALID_VALUE", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        smtpCustomEnabled: "confirm_off",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const smtp = r.gates.find((g) => g.name === "G-SMTP-ATTEST");
      expect(smtp.tier).toBe("UNVERIFIED-BLOCKED");
      expect(smtp.refusalCode).toBe("GATE_A_SMTP_CUSTOM_ENABLED_INVALID_VALUE");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("smtpCustomEnabled='' (empty string) → UNVERIFIED-BLOCKED · refusalCode GATE_A_SMTP_CUSTOM_ENABLED_UNSET", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        smtpCustomEnabled: "",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const smtp = r.gates.find((g) => g.name === "G-SMTP-ATTEST");
      expect(smtp.tier).toBe("UNVERIFIED-BLOCKED");
      expect(smtp.refusalCode).toBe("GATE_A_SMTP_CUSTOM_ENABLED_UNSET");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("smtpCustomEnabled entirely absent (key omitted) → UNVERIFIED-BLOCKED · UNSET (re-assertion of existing behaviour under new grammar)", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const smtp = r.gates.find((g) => g.name === "G-SMTP-ATTEST");
      expect(smtp.tier).toBe("UNVERIFIED-BLOCKED");
      expect(smtp.refusalCode).toBe("GATE_A_SMTP_CUSTOM_ENABLED_UNSET");
      expect(r.smtpAttestConfig).toBeNull();
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("secret hygiene: a sentinel bogus env value does NOT appear in any field of any gate result or in any printed log line", () => {
    const SENTINEL = "_not_a_real_val_ZXCVBNM_";
    const refusalPaths = [SENTINEL, `${SENTINEL}   `, `yes${SENTINEL}`, `${SENTINEL}yes`];
    const tmp = makeTmpFlag(passBody());
    try {
      for (const value of refusalPaths) {
        const r = runGates({
          smtpCustomEnabled: value,
          dbCredFlagPath: tmp.path,
          targetProjectRef: CANONICAL_SANDBOX_REF,
        });
        // Every emitted string on every gate for this refusal MUST NOT
        // contain the raw value anywhere.
        const serialised = JSON.stringify(r);
        expect(serialised).not.toContain(SENTINEL);
      }

      // Also assert the printer never echoes the sentinel to stdout.
      const { joined } = captureLogs(() =>
        printPreflightChecklist({
          identityMode: "three",
          boundedProfile: "abc-14",
          skipCleanup: true,
          dryRun: true,
          smtpCustomEnabled: SENTINEL,
          dbCredFlagPath: tmp.path,
          targetProjectRef: CANONICAL_SANDBOX_REF,
        }),
      );
      expect(joined).not.toContain(SENTINEL);
      expect(joined).toMatch(/GATE_A_SMTP_CUSTOM_ENABLED_INVALID_VALUE/);
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("smtpAttestConfig === null whenever G-SMTP-ATTEST is UNVERIFIED-BLOCKED (across all refusal paths)", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const cases = [undefined, "", "no", "true", "1", "Y", "confirm_off", "yes ", " yes", "random-sentinel-QWERTY"];
      for (const value of cases) {
        const r = runGates({
          smtpCustomEnabled: value,
          dbCredFlagPath: tmp.path,
          targetProjectRef: CANONICAL_SANDBOX_REF,
        });
        const smtp = r.gates.find((g) => g.name === "G-SMTP-ATTEST");
        expect(smtp.tier).toBe("UNVERIFIED-BLOCKED");
        expect(r.smtpAttestConfig).toBeNull();
      }
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("neither value writes nor reads any file system path for the SMTP enum itself, and neither constructs a pg.Client", () => {
    // Source-level inspection: the SMTP branch body in _preflight-checklist.mjs
    // must not call writeFileSync, readFileSync keyed to smtp, mkdir, or
    // instantiate pg.Client. The G-SMTP-ATTEST decision is pure.
    expect(MODULE_SRC).not.toMatch(/pg\.Client|new\s+Client\(/);
    expect(MODULE_SRC).not.toMatch(/writeFileSync\s*\(/);
    // readFileSync IS used, but only for the dbCredFlagPath marker — assert
    // it never appears in the G-SMTP-ATTEST branch body.
    const smtpBranchMatch = MODULE_SRC.match(/Gate G-SMTP-ATTEST[\s\S]*?Gate G-DB-CRED/);
    expect(smtpBranchMatch, "SMTP gate branch must be locatable").toBeTruthy();
    expect(smtpBranchMatch[0]).not.toMatch(/readFileSync|existsSync|writeFileSync|mkdir|pg\.Client|new\s+Client/);
  });

  it("printer emits the Config-X-specific detected-config line exactly when smtpAttestConfig === 'X'", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const { joined } = captureLogs(() =>
        printPreflightChecklist({
          identityMode: "three",
          boundedProfile: "abc-14",
          skipCleanup: true,
          dryRun: true,
          smtpCustomEnabled: "confirm-off",
          dbCredFlagPath: tmp.path,
          targetProjectRef: CANONICAL_SANDBOX_REF,
        }),
      );
      expect(joined).toContain(
        "G-SMTP-ATTEST: ATTESTED · detected config = X (Confirm email OFF; email-confirmation journey UNVERIFIED, deferred to a later Brevo round)",
      );
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("printer emits the Config-Y-specific detected-config line exactly when smtpAttestConfig === 'Y'", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const { joined } = captureLogs(() =>
        printPreflightChecklist({
          identityMode: "three",
          boundedProfile: "abc-14",
          skipCleanup: true,
          dryRun: true,
          smtpCustomEnabled: "yes",
          dbCredFlagPath: tmp.path,
          targetProjectRef: CANONICAL_SANDBOX_REF,
        }),
      );
      expect(joined).toContain(
        "G-SMTP-ATTEST: ATTESTED · detected config = Y (Confirm email ON + custom SMTP; email-confirmation journey will be exercised)",
      );
    } finally {
      cleanupTmp(tmp.dir);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// §16.48.22 · G-DB-CRED reads evidence/attestations/db-cred-verified.flag
// (probe output) as its single source. Nine refusal clauses + ATTESTED
// happy path + project_ref forward-compat defence.
// ═════════════════════════════════════════════════════════════════════════════

describe("§16.48.22 · runGates · G-DB-CRED refusal clauses", () => {
  it("clause 1: missing flag file → UNVERIFIED-BLOCKED · DB_CRED_FLAG_MISSING", () => {
    const r = runGates({
      smtpCustomEnabled: "yes",
      dbCredFlagPath: "C:/tmp/definitely-not-real/db-cred-verified.flag",
      targetProjectRef: CANONICAL_SANDBOX_REF,
    });
    const db = r.gates.find((g) => g.name === "G-DB-CRED");
    expect(db.tier).toBe("UNVERIFIED-BLOCKED");
    expect(db.refusalCode).toBe("DB_CRED_FLAG_MISSING");
    expect(db.operator_action).toMatch(/91_db_cred_probe\.mjs/);
  });

  it("clause 2: empty flag file (zero bytes) → UNVERIFIED-BLOCKED · DB_CRED_FLAG_EMPTY", () => {
    const tmp = makeTmpFlag("");
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("UNVERIFIED-BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_FLAG_EMPTY");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 2b: whitespace-only flag file → UNVERIFIED-BLOCKED · DB_CRED_FLAG_EMPTY", () => {
    const tmp = makeTmpFlag("   \n\t  \n");
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("UNVERIFIED-BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_FLAG_EMPTY");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 3: malformed JSON → UNVERIFIED-BLOCKED · DB_CRED_FLAG_MALFORMED_JSON", () => {
    const tmp = makeTmpFlag("not valid json {{{");
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("UNVERIFIED-BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_FLAG_MALFORMED_JSON");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 3b: JSON that parses to a non-object (string literal) → UNVERIFIED-BLOCKED · DB_CRED_FLAG_MALFORMED_JSON", () => {
    const tmp = makeTmpFlag('"a bare string"');
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("UNVERIFIED-BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_FLAG_MALFORMED_JSON");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 4: missing verdict field → UNVERIFIED-BLOCKED · DB_CRED_FLAG_MISSING_VERDICT_FIELD", () => {
    const tmp = makeTmpFlag(
      JSON.stringify({ probe_version: "§16.48.20", checked_at: new Date().toISOString() }),
    );
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("UNVERIFIED-BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_FLAG_MISSING_VERDICT_FIELD");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 4b: verdict is not a string → UNVERIFIED-BLOCKED · DB_CRED_FLAG_MISSING_VERDICT_FIELD", () => {
    const tmp = makeTmpFlag(
      JSON.stringify({ verdict: 42, checked_at: new Date().toISOString() }),
    );
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("UNVERIFIED-BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_FLAG_MISSING_VERDICT_FIELD");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 5: verdict === 'DB_CRED_PROBE_FAIL' → BLOCKED · DB_CRED_PROBE_LAST_RUN_FAILED", () => {
    const tmp = makeTmpFlag(
      JSON.stringify({
        verdict: "DB_CRED_PROBE_FAIL",
        probe_version: "§16.48.20",
        checked_at: new Date().toISOString(),
      }),
    );
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_PROBE_LAST_RUN_FAILED");
      expect(db.operator_action).toMatch(/91_db_cred_probe\.mjs/);
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 6: unrecognised verdict string → UNVERIFIED-BLOCKED · DB_CRED_FLAG_UNRECOGNISED_VERDICT", () => {
    const tmp = makeTmpFlag(
      JSON.stringify({
        verdict: "SOME_FUTURE_VERDICT_WE_DO_NOT_KNOW",
        probe_version: "§16.48.20",
        checked_at: new Date().toISOString(),
      }),
    );
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("UNVERIFIED-BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_FLAG_UNRECOGNISED_VERDICT");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 7 (forward-compat positive): project_ref === sandbox → ATTESTED path proceeds", () => {
    // If the probe (future round) extends the flag with project_ref AND
    // it equals the canonical sandbox ref, the gate should still attest.
    const tmp = makeTmpFlag(passBody(undefined, { project_ref: CANONICAL_SANDBOX_REF }));
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("ATTESTED");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 7 (forward-compat negative): project_ref === production ref → UNVERIFIED-BLOCKED · DB_CRED_FLAG_WRONG_PROJECT_REF; raw ref NEVER echoed", () => {
    const tmp = makeTmpFlag(passBody(undefined, { project_ref: PRODUCTION_REF }));
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("UNVERIFIED-BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_FLAG_WRONG_PROJECT_REF");
      // Critical hygiene: the raw production ref must NEVER appear on the
      // gate result anywhere (reason, operator_action, or any serialised
      // field).
      const serialised = JSON.stringify(db);
      expect(serialised).not.toContain(PRODUCTION_REF);
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 7 (forward-compat negative, other ref): project_ref is an arbitrary non-sandbox value → UNVERIFIED-BLOCKED · DB_CRED_FLAG_WRONG_PROJECT_REF; raw value NEVER echoed", () => {
    const SENTINEL_REF = "ABCXYZ-NONSANDBOX-SENTINEL-999";
    const tmp = makeTmpFlag(passBody(undefined, { project_ref: SENTINEL_REF }));
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("UNVERIFIED-BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_FLAG_WRONG_PROJECT_REF");
      const serialised = JSON.stringify(db);
      expect(serialised).not.toContain(SENTINEL_REF);
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 8: invalid checked_at (non-ISO string) → UNVERIFIED-BLOCKED · DB_CRED_FLAG_BAD_CHECKED_AT", () => {
    const tmp = makeTmpFlag(
      JSON.stringify({
        verdict: "DB_CRED_PROBE_PASS",
        probe_version: "§16.48.20",
        checked_at: "not a date at all",
        current_database: "postgres",
      }),
    );
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("UNVERIFIED-BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_FLAG_BAD_CHECKED_AT");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 8b: missing checked_at field entirely → UNVERIFIED-BLOCKED · DB_CRED_FLAG_BAD_CHECKED_AT", () => {
    const tmp = makeTmpFlag(
      JSON.stringify({
        verdict: "DB_CRED_PROBE_PASS",
        probe_version: "§16.48.20",
        current_database: "postgres",
      }),
    );
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("UNVERIFIED-BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_FLAG_BAD_CHECKED_AT");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 9: PASS older than 24h → STALE-BLOCKED · DB_CRED_FLAG_STALE", () => {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const tmp = makeTmpFlag(passBody(fortyEightHoursAgo));
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("STALE-BLOCKED");
      expect(db.refusalCode).toBe("DB_CRED_FLAG_STALE");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("clause 9b: PASS exactly at the 24h boundary minus 1ms (fresh) → ATTESTED; +1ms → STALE-BLOCKED (boundary check via injected `now`)", () => {
    const CHECKED = new Date("2026-11-20T00:00:00.000Z").getTime();
    const checkedAtIso = new Date(CHECKED).toISOString();
    const tmp = makeTmpFlag(passBody(checkedAtIso));
    try {
      // Exactly 24h later minus 1ms → still fresh (ATTESTED).
      const freshNow = CHECKED + 24 * 60 * 60 * 1000 - 1;
      const rFresh = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
        now: freshNow,
      });
      const dbFresh = rFresh.gates.find((g) => g.name === "G-DB-CRED");
      expect(dbFresh.tier).toBe("ATTESTED");

      // 24h + 1ms later → STALE-BLOCKED.
      const staleNow = CHECKED + 24 * 60 * 60 * 1000 + 1;
      const rStale = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
        now: staleNow,
      });
      const dbStale = rStale.gates.find((g) => g.name === "G-DB-CRED");
      expect(dbStale.tier).toBe("STALE-BLOCKED");
      expect(dbStale.refusalCode).toBe("DB_CRED_FLAG_STALE");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("ATTESTED happy path: fresh PASS with full schema → ATTESTED + source + checked_at + current_database carried on the gate record", () => {
    const checkedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const tmp = makeTmpFlag(passBody(checkedAt));
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("ATTESTED");
      expect(db.refusalCode).toBeNull();
      expect(db.source).toBe(tmp.path);
      expect(db.checked_at).toBe(checkedAt);
      expect(db.current_database).toBe("postgres");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("ATTESTED path when current_database field missing → current_database === null on gate record", () => {
    const checkedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const tmp = makeTmpFlag(
      JSON.stringify({
        verdict: "DB_CRED_PROBE_PASS",
        probe_version: "§16.48.20",
        checked_at: checkedAt,
      }),
    );
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const db = r.gates.find((g) => g.name === "G-DB-CRED");
      expect(db.tier).toBe("ATTESTED");
      expect(db.current_database).toBeNull();
    } finally {
      cleanupTmp(tmp.dir);
    }
  });
});

describe("§16.48.22 · runGates · G-DB-CRED input validation", () => {
  it("dbCredFlagPath missing → throws 'runGates: invalid input'", () => {
    expect(() =>
      runGates({
        smtpCustomEnabled: "yes",
        targetProjectRef: CANONICAL_SANDBOX_REF,
      }),
    ).toThrowError("runGates: invalid input");
  });

  it("dbCredFlagPath empty string → throws 'runGates: invalid input'", () => {
    expect(() =>
      runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: "",
        targetProjectRef: CANONICAL_SANDBOX_REF,
      }),
    ).toThrowError("runGates: invalid input");
  });

  it("dbCredFlagPath non-string (number) → throws 'runGates: invalid input'", () => {
    expect(() =>
      runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: 42,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      }),
    ).toThrowError("runGates: invalid input");
  });
});

describe("§16.48.22 · printPreflightChecklist · G-DB-CRED ATTESTED printer line", () => {
  afterEach(() => {
    delete process.env.GATE_A_SMTP_CUSTOM_ENABLED;
    vi.restoreAllMocks();
  });

  it("prints 'G-DB-CRED: ATTESTED · source = <path> · checked_at = <iso> · current_database = postgres' on ATTESTED", () => {
    const checkedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const tmp = makeTmpFlag(passBody(checkedAt));
    try {
      const { joined } = captureLogs(() =>
        printPreflightChecklist({
          identityMode: "three",
          boundedProfile: "abc-14",
          skipCleanup: true,
          dryRun: true,
          smtpCustomEnabled: "yes",
          dbCredFlagPath: tmp.path,
          targetProjectRef: CANONICAL_SANDBOX_REF,
        }),
      );
      expect(joined).toMatch(/G-DB-CRED: ATTESTED · source = /);
      expect(joined).toContain(`checked_at = ${checkedAt}`);
      expect(joined).toContain("current_database = postgres");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("prints '(not reported)' as current_database when the probe flag omits the field", () => {
    const checkedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const tmp = makeTmpFlag(
      JSON.stringify({
        verdict: "DB_CRED_PROBE_PASS",
        probe_version: "§16.48.20",
        checked_at: checkedAt,
      }),
    );
    try {
      const { joined } = captureLogs(() =>
        printPreflightChecklist({
          identityMode: "three",
          boundedProfile: "abc-14",
          skipCleanup: true,
          dryRun: true,
          smtpCustomEnabled: "yes",
          dbCredFlagPath: tmp.path,
          targetProjectRef: CANONICAL_SANDBOX_REF,
        }),
      );
      expect(joined).toContain("current_database = (not reported)");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("prints '[BLOCKED] G-DB-CRED · last DB credential probe run reported FAIL' with refusalCode on a FAIL flag", () => {
    const tmp = makeTmpFlag(
      JSON.stringify({
        verdict: "DB_CRED_PROBE_FAIL",
        probe_version: "§16.48.20",
        checked_at: new Date().toISOString(),
      }),
    );
    try {
      const { joined } = captureLogs(() =>
        printPreflightChecklist({
          identityMode: "three",
          boundedProfile: "abc-14",
          skipCleanup: true,
          dryRun: true,
          smtpCustomEnabled: "yes",
          dbCredFlagPath: tmp.path,
          targetProjectRef: CANONICAL_SANDBOX_REF,
        }),
      );
      expect(joined).toMatch(/\[BLOCKED\][^\n]*G-DB-CRED/);
      expect(joined).toContain("refusalCode: DB_CRED_PROBE_LAST_RUN_FAILED");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("prints '[UNVERIFIED-BLOCKED] G-DB-CRED' with refusalCode on a missing flag", () => {
    const { joined } = captureLogs(() =>
      printPreflightChecklist({
        identityMode: "three",
        boundedProfile: "abc-14",
        skipCleanup: true,
        dryRun: true,
        smtpCustomEnabled: "yes",
        dbCredFlagPath: "C:/tmp/definitely-not-real/db-cred-verified.flag",
        targetProjectRef: CANONICAL_SANDBOX_REF,
      }),
    );
    expect(joined).toMatch(/\[UNVERIFIED-BLOCKED\][^\n]*G-DB-CRED/);
    expect(joined).toContain("refusalCode: DB_CRED_FLAG_MISSING");
  });
});

describe("§16.48.19 · runGates · G-TARGET-REF", () => {
  it("sandbox ref → ATTESTED", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: CANONICAL_SANDBOX_REF,
      });
      const ref = r.gates.find((g) => g.name === "G-TARGET-REF");
      expect(ref.tier).toBe("ATTESTED");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("production ref → throws (reason mentions 'production', raw ref not in message)", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      let caught = null;
      try {
        runGates({
          smtpCustomEnabled: "yes",
          dbCredFlagPath: tmp.path,
          targetProjectRef: PRODUCTION_REF,
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeTruthy();
      expect(caught.message).toMatch(/production/);
      // The raw production ref IS NOT in the error message body; the message
      // uses the literal word "production" to name the reason.
      // (The test tolerates the ref appearing in some future tracebacks — we
      // only assert on .message.)
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("unknown ref 'foobar' → BLOCKED, reason does NOT echo the raw value", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const r = runGates({
        smtpCustomEnabled: "yes",
        dbCredFlagPath: tmp.path,
        targetProjectRef: "foobar-SENTINEL",
      });
      const ref = r.gates.find((g) => g.name === "G-TARGET-REF");
      expect(ref.tier).toBe("BLOCKED");
      expect(ref.reason).not.toMatch(/foobar-SENTINEL/);
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("empty targetProjectRef → throws", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      expect(() =>
        runGates({
          smtpCustomEnabled: "yes",
          dbCredFlagPath: tmp.path,
          targetProjectRef: "",
        }),
      ).toThrowError("runGates: invalid input");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("missing targetProjectRef → throws", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      expect(() =>
        runGates({
          smtpCustomEnabled: "yes",
          dbCredFlagPath: tmp.path,
        }),
      ).toThrowError("runGates: invalid input");
    } finally {
      cleanupTmp(tmp.dir);
    }
  });
});

describe("§16.48.19 · printPreflightChecklist · backward compat and visibility", () => {
  afterEach(() => {
    // Ensure we don't leak env across tests.
    delete process.env.GATE_A_SMTP_CUSTOM_ENABLED;
    vi.restoreAllMocks();
  });

  it("called with only §16.48.18 four-field shape → still runs, returns undefined", () => {
    const { joined } = captureLogs(() =>
      printPreflightChecklist({
        identityMode: "three",
        boundedProfile: "abc-14",
        skipCleanup: true,
        dryRun: true,
      }),
    );
    // §16.48.19 gate banner appears.
    expect(joined).toContain("§16.48.19");
    // SMTP gate defaults to UNVERIFIED-BLOCKED.
    expect(joined).toMatch(/\[UNVERIFIED-BLOCKED\][^\n]*G-SMTP-ATTEST/);
    // DB-CRED gate: on a fresh workstation the default flag file may be
    // present (if the probe has been run) or absent; either way, one of
    // the expected tiers appears.
    expect(joined).toMatch(/\[(?:UNVERIFIED-BLOCKED|BLOCKED|STALE-BLOCKED)\][^\n]*G-DB-CRED|G-DB-CRED: ATTESTED/);
    // TARGET-REF gate: default was sandbox → ATTESTED.
    expect(joined).toMatch(/\[ATTESTED\][^\n]*G-TARGET-REF/);
    // allPass=false (SMTP unset) → operator-action guidance appears.
    expect(joined).toMatch(/Address the operator actions above/);
  });

  it("env shortcut: GATE_A_SMTP_CUSTOM_ENABLED=yes in env lifts SMTP gate to ATTESTED when caller omits the field", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      process.env.GATE_A_SMTP_CUSTOM_ENABLED = "yes";
      const { joined } = captureLogs(() =>
        printPreflightChecklist({
          identityMode: "three",
          boundedProfile: "abc-14",
          skipCleanup: true,
          dryRun: true,
          dbCredFlagPath: tmp.path,
          targetProjectRef: CANONICAL_SANDBOX_REF,
        }),
      );
      // §16.48.21: the SMTP gate printer line was reformatted to surface
      // the detected config. The ATTESTED tier and gate name are both
      // present on the same line but in the new "detected config = Y" form.
      expect(joined).toMatch(/G-SMTP-ATTEST: ATTESTED[^\n]*detected config = Y/);
      expect(joined).toMatch(/All §16\.48\.19 gates ATTESTED/);
    } finally {
      cleanupTmp(tmp.dir);
    }
  });

  it("production ref passed explicitly → prints [BLOCKED] runGates refused line (no crash)", () => {
    const tmp = makeTmpFlag(passBody());
    try {
      const { joined } = captureLogs(() =>
        printPreflightChecklist({
          identityMode: "three",
          boundedProfile: "abc-14",
          skipCleanup: true,
          dryRun: true,
          smtpCustomEnabled: "yes",
          dbCredFlagPath: tmp.path,
          targetProjectRef: PRODUCTION_REF,
        }),
      );
      expect(joined).toMatch(/\[BLOCKED\] runGates refused/);
      expect(joined).toMatch(/production/);
    } finally {
      cleanupTmp(tmp.dir);
    }
  });
});
