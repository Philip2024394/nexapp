#!/usr/bin/env node
// §16.48.25 · Gate A Connected Matrix · rerun orchestrator (Agent C).
//
// READ + CALL existing scripts only. NO signUp. NO admin.updateUserById.
// NO password resets. NO commits. NO pushes. NO deploys. NO dev-server
// changes. Sandbox only (`kdstoyyeygcopkogqsyv`). Prod `ijvqdvsvwtwxzcqmoqit`
// is SEALED — this script HARD REFUSES if prod ref appears in URL or DB URL.
//
// Flow:
//   1. Safety preamble (4 checks). Exit 3 on failure.
//   2. Phase 1: run _diag-rls-16-48-24.mjs. Parse the three
//      `[session|participant|message] authed-A SELECT:` lines.
//      If any carries ERROR 42P17 / infinite recursion → STOP, exit 1.
//   3. Phase 2: run 9 verification scripts in order, single attempt each.
//      Stop on first FAIL or STOP_RATE_LIMITED.
//   4. Write `_results.16-48-25.json.OUTPUT` atomically.
//   5. Print one-line DONE summary.
//
// Passwords: read `GATE_A_TEST_PASSWORD_A|B|C` from THIS process env and
// forward unchanged to children. Never log them. Redact to `***` if an
// error message would otherwise surface them.

import { readFileSync, writeFileSync, renameSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dir, "../..");
const MATRIX_DIR = __dir;
const PROD_REF = "ijvqdvsvwtwxzcqmoqit";
const CANON_REF = "kdstoyyeygcopkogqsyv";

const CAPTURE_PATH = join(MATRIX_DIR, "99_identity_capture.json.OUTPUT");
const DIAG_PATH = join(MATRIX_DIR, "_diag-rls-16-48-24.mjs");
const VERDICT_PATH = join(MATRIX_DIR, "_results.16-48-25.json.OUTPUT");

// ---------- helpers ---------------------------------------------------------

function readEnvLocal(key) {
  try {
    const raw = readFileSync(resolve(REPO_ROOT, ".env.local"), "utf8");
    const m = raw.match(new RegExp(`^${key}=(.*)$`, "m"));
    if (!m) return null;
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v;
  } catch {
    return null;
  }
}

function redactPasswords(s) {
  if (!s) return s;
  let out = s;
  for (const label of ["A", "B", "C"]) {
    const pw = process.env[`GATE_A_TEST_PASSWORD_${label}`];
    if (pw && pw.length >= 3) {
      // Replace all occurrences with `***`.
      out = out.split(pw).join("***");
    }
  }
  return out;
}

function tailLines(s, n) {
  if (!s) return "";
  const lines = s.split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}

function atomicWriteJson(path, obj) {
  const tmp = `${path}.tmp-${randomBytes(4).toString("hex")}`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}

function nowIso() {
  return new Date().toISOString();
}

function newRunId() {
  return randomBytes(8).toString("hex");
}

function runChild(scriptPath, env, timeoutMs = 120_000) {
  return new Promise((resolveP) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(process.execPath, [scriptPath], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      if (!settled) {
        try { child.kill("SIGKILL"); } catch {}
      }
    }, timeoutMs);
    child.stdout.on("data", (b) => { stdout += b.toString("utf8"); });
    child.stderr.on("data", (b) => { stderr += b.toString("utf8"); });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveP({ exit: -1, stdout, stderr: `${stderr}\nSPAWN_ERROR: ${err.message}` });
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveP({
        exit: typeof code === "number" ? code : -1,
        stdout,
        stderr,
        signal: signal ?? null,
      });
    });
  });
}

function fail(reason, code = 3) {
  console.error(`ABORT: ${redactPasswords(reason)}`);
  // Try to persist a verdict stub so we don't silently vanish.
  try {
    atomicWriteJson(VERDICT_PATH, {
      round: "§16.48.25",
      run_id: newRunId(),
      started_at: nowIso(),
      finished_at: nowIso(),
      target_ref: CANON_REF,
      phase_1_rls_recursion_cleared: false,
      entries: [],
      stop_reason: `preamble_abort: ${reason}`,
    });
  } catch {}
  process.exit(code);
}

// ---------- 1. Safety preamble ---------------------------------------------

function safetyPreamble() {
  const publicUrl = readEnvLocal("NEXT_PUBLIC_NEX_SUPABASE_URL");
  if (!publicUrl) fail("NEXT_PUBLIC_NEX_SUPABASE_URL missing from .env.local");
  if (publicUrl.includes(PROD_REF)) fail("NEXT_PUBLIC_NEX_SUPABASE_URL contains prod ref — refusing");
  if (!publicUrl.includes(CANON_REF)) fail("NEXT_PUBLIC_NEX_SUPABASE_URL does not contain sandbox ref");

  const dbUrl = readEnvLocal("SANDBOX_DATABASE_URL");
  if (!dbUrl) fail("SANDBOX_DATABASE_URL missing from .env.local");
  if (dbUrl.includes(PROD_REF)) fail("SANDBOX_DATABASE_URL contains prod ref — refusing");
  if (!dbUrl.includes(CANON_REF)) fail("SANDBOX_DATABASE_URL does not contain sandbox ref");

  for (const label of ["A", "B", "C"]) {
    const v = process.env[`GATE_A_TEST_PASSWORD_${label}`];
    if (!v || v.length === 0) {
      fail(`GATE_A_TEST_PASSWORD_${label} not set — pass it in env, do NOT reset passwords`);
    }
  }

  if (!existsSync(CAPTURE_PATH)) fail(`identity capture missing: ${CAPTURE_PATH}`);
  let capture;
  try {
    capture = JSON.parse(readFileSync(CAPTURE_PATH, "utf8"));
  } catch (e) {
    fail(`identity capture is not valid JSON: ${e.message}`);
  }
  for (const label of ["A", "B", "C"]) {
    if (!capture?.[label]?.nex_account_id) {
      fail(`identity capture missing ${label}.nex_account_id`);
    }
  }

  return { publicUrl, capture };
}

// ---------- 2. Phase 1: RLS recursion probe --------------------------------

async function phase1(childEnv) {
  if (!existsSync(DIAG_PATH)) {
    return { ok: false, reason: `diag script missing: ${DIAG_PATH}`, raw: "" };
  }
  const { exit, stdout, stderr } = await runChild(DIAG_PATH, childEnv, 120_000);
  const combined = `${stdout}\n${stderr}`;

  const want = ["[session] authed-A SELECT:", "[participant] authed-A SELECT:", "[message] authed-A SELECT:"];
  const foundLines = {};
  for (const needle of want) {
    const lines = combined.split(/\r?\n/);
    const line = lines.find((l) => l.includes(needle));
    foundLines[needle] = line ?? null;
  }

  const stillRecursing = Object.values(foundLines).some((l) => {
    if (!l) return false;
    return l.includes("42P17") || /infinite recursion/i.test(l);
  });

  return {
    ok: !stillRecursing,
    reason: stillRecursing
      ? "42P17 / infinite recursion still present on one of session/participant/message"
      : null,
    exit,
    raw: combined,
    found: foundLines,
  };
}

// ---------- 3. Phase 2: script dispatch ------------------------------------

// Agent C spec-name → resolver. Each slot provides:
//   spec_name:   the name as printed in the §16.48.25 instructions
//   prefix:      numeric prefix to glob when spec name is missing
const SLOTS = [
  { spec_name: "40_v_w1_new.mjs", prefix: "40_" },
  { spec_name: "41_v_w1_duplicate.mjs", prefix: "41_" },
  { spec_name: "44_v_w2_new.mjs", prefix: "44_" },
  { spec_name: "45_v_w2_duplicate.mjs", prefix: "45_" },
  { spec_name: "50_v_fail_fast.mjs", prefix: "50_" },
  { spec_name: "52_v_fail_fast_kinds.mjs", prefix: "52_" },
  { spec_name: "60_v_rate_limit.mjs", prefix: "60_" },
  { spec_name: "65_v_rate_limit_shapes.mjs", prefix: "65_" },
  { spec_name: "66_v_rate_limit_kinds.mjs", prefix: "66_" },
];

function resolveSlot(slot) {
  // Prefer exact spec name if it exists on disk.
  const direct = join(MATRIX_DIR, slot.spec_name);
  if (existsSync(direct)) {
    return { resolved: slot.spec_name, mismatch: false, path: direct };
  }
  // Fall back to glob-by-prefix within matrix dir, excluding non-.mjs and archives.
  let entries;
  try {
    entries = readdirSync(MATRIX_DIR);
  } catch {
    entries = [];
  }
  const matches = entries.filter(
    (f) => f.startsWith(slot.prefix) && f.endsWith(".mjs") && !f.includes(".OUTPUT"),
  );
  if (matches.length === 1) {
    return {
      resolved: matches[0],
      mismatch: true,
      path: join(MATRIX_DIR, matches[0]),
    };
  }
  if (matches.length > 1) {
    return {
      resolved: null,
      mismatch: true,
      path: null,
      ambiguous: matches,
    };
  }
  return { resolved: null, mismatch: true, path: null };
}

function classify(exit, stdout, stderr) {
  const all = `${stdout}\n${stderr}`;
  if (exit === 0) return { verdict: "PASS", rate_limited: false, detail: "exit 0" };

  const rateLimited = /\b429\b/.test(all) || /rate[\s_-]?limit/i.test(all);
  if (rateLimited) {
    return { verdict: "STOP_RATE_LIMITED", rate_limited: true, detail: "rate-limit signal in output" };
  }
  if (/\bBLOCKED\b/.test(all)) {
    return { verdict: "BLOCKED", rate_limited: false, detail: "BLOCKED marker in output" };
  }
  return { verdict: "FAIL", rate_limited: false, detail: `exit ${exit}` };
}

async function phase2(childEnv) {
  const entries = [];
  let stopReason = null;

  for (const slot of SLOTS) {
    const r = resolveSlot(slot);
    if (!r.resolved) {
      entries.push({
        file: slot.spec_name,
        resolved_file: null,
        mismatch: true,
        ambiguous: r.ambiguous ?? null,
        exit: null,
        verdict: "BLOCKED",
        detail: r.ambiguous
          ? `multiple matches for prefix ${slot.prefix}: ${r.ambiguous.join(", ")}`
          : `script file not found (spec=${slot.spec_name}, prefix=${slot.prefix})`,
        rate_limited: false,
        last_lines: "",
      });
      continue; // "mark as BLOCKED and continue to the next"
    }

    const { exit, stdout, stderr } = await runChild(r.path, childEnv, 180_000);
    const cls = classify(exit, stdout, stderr);
    const combinedTail = tailLines(`${stdout}\n${stderr}`.trimEnd(), 40);

    entries.push({
      file: slot.spec_name,
      resolved_file: r.resolved,
      mismatch: r.mismatch,
      exit,
      verdict: cls.verdict,
      detail: cls.detail,
      rate_limited: cls.rate_limited,
      last_lines: redactPasswords(combinedTail),
    });

    if (cls.verdict === "STOP_RATE_LIMITED") {
      stopReason = `rate_limited_at:${r.resolved}`;
      break;
    }
    if (cls.verdict === "FAIL") {
      stopReason = `first_fail_at:${r.resolved}`;
      break;
    }
  }

  return { entries, stopReason };
}

// ---------- main -----------------------------------------------------------

async function main() {
  const started_at = nowIso();
  const run_id = newRunId();

  safetyPreamble();

  // Forward only the three passwords explicitly (plus whatever the child
  // naturally inherits from process.env — we use the full env so children
  // can still read .env.local themselves if they want to).
  const childEnv = {
    GATE_A_TEST_PASSWORD_A: process.env.GATE_A_TEST_PASSWORD_A,
    GATE_A_TEST_PASSWORD_B: process.env.GATE_A_TEST_PASSWORD_B,
    GATE_A_TEST_PASSWORD_C: process.env.GATE_A_TEST_PASSWORD_C,
  };

  // Phase 1.
  const p1 = await phase1(childEnv);
  if (!p1.ok) {
    console.error("PHASE 1 FAIL: 42P17 still present — migration not applied or ineffective");
    const verdict = {
      round: "§16.48.25",
      run_id,
      started_at,
      finished_at: nowIso(),
      target_ref: CANON_REF,
      phase_1_rls_recursion_cleared: false,
      entries: [],
      stop_reason: `phase_1_fail: ${p1.reason}`,
      phase_1_diag: {
        exit: p1.exit ?? null,
        found: p1.found ?? null,
        tail: redactPasswords(tailLines(p1.raw, 40)),
      },
    };
    atomicWriteJson(VERDICT_PATH, verdict);
    console.log(`DONE §16.48.25 · phase1=fail · entries=0 · stop=${verdict.stop_reason}`);
    process.exit(1);
  }
  console.log("PHASE 1 OK: no 42P17 detected");

  // Phase 2.
  const { entries, stopReason } = await phase2(childEnv);

  const verdict = {
    round: "§16.48.25",
    run_id,
    started_at,
    finished_at: nowIso(),
    target_ref: CANON_REF,
    phase_1_rls_recursion_cleared: true,
    entries,
    stop_reason: stopReason,
  };
  atomicWriteJson(VERDICT_PATH, verdict);

  console.log(
    `DONE §16.48.25 · phase1=ok · entries=${entries.length} · stop=${stopReason ?? "none"}`,
  );
  // Exit 0 regardless of per-entry FAIL — the verdict file carries truth.
  process.exit(0);
}

main().catch((err) => {
  console.error(`UNCAUGHT: ${redactPasswords(err?.stack || String(err))}`);
  try {
    atomicWriteJson(VERDICT_PATH, {
      round: "§16.48.25",
      run_id: newRunId(),
      started_at: nowIso(),
      finished_at: nowIso(),
      target_ref: CANON_REF,
      phase_1_rls_recursion_cleared: false,
      entries: [],
      stop_reason: `uncaught: ${err?.message ?? "unknown"}`,
    });
  } catch {}
  process.exit(2);
});
