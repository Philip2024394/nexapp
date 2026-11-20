#!/usr/bin/env node
// Secret-free check of which Supabase/Postgres targets .env.local declares.
// NEVER prints values, URLs, or secrets. Prints only variable name, presence,
// and a short label drawn from a fixed operator-known set. No network.
// No dotenv runtime. Written 2026-11-19 for Prompt-7 continuation reconciliation.

import fs from "node:fs";
import path from "node:path";

const FILE = path.resolve(process.cwd(), ".env.local");

// Env vars that NEX code paths actually read (from a grep against src/).
// If an entry is absent from the output, the file did not declare it (active or commented).
const WATCH = [
  // NEX browser/server auth + admin
  "NEX_SUPABASE_URL",
  "NEXT_PUBLIC_NEX_SUPABASE_URL",
  "NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY",
  "NEX_SUPABASE_SERVICE_ROLE_KEY",
  // Legacy non-NEX Supabase (voice/translation)
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  // Direct postgres
  "NEX_POSTGRES_URL",
  "NEX_TAXONOMY_POSTGRES_URL",
  "DATABASE_URL",
  // Sandbox siblings
  "SANDBOX_SUPABASE_URL",
  "SANDBOX_DATABASE_URL",
];

// Operator-confirmed project references. These are the ONLY tokens the
// script matches against the value. They are already published in this
// repo's CLAUDE.md §8 (prod) and in sealed sandbox-policy memory (sandbox).
// Legacy ref is quarantined per CLAUDE.md §8. Matching reveals only which
// known project a var points at, never the credential portion of the URL.
const PROJECT_REFS = [
  { token: "ijvqdvsvwtwxzcqmoqit", label: "nex-prod" },
  { token: "kdstoyyeygcopkogqsyv", label: "nex-sandbox" },
  { token: "msdonkkechxzgagyguoe", label: "legacy-quarantined" },
];

// Postgres host category — never DB name, user, or password.
const PG_HOSTS = [
  { token: "pooler.supabase.com", label: "supabase-pooler" },
  { token: "supabase.co", label: "supabase-direct" },
  { token: "localhost", label: "localhost" },
  { token: "127.0.0.1", label: "localhost" },
];

/**
 * Classify a raw value into a short label without echoing any portion of it.
 * @param {string} raw value (NEVER logged)
 * @returns {string} label from a fixed set
 */
function classify(raw) {
  if (raw === undefined || raw === null) return "absent";
  const v = String(raw).trim();
  if (v === "") return "empty";
  // Strip wrapping quotes without logging anything.
  const inner = v.replace(/^['"]|['"]$/g, "");
  for (const r of PROJECT_REFS) {
    if (inner.includes(r.token)) {
      // If also a postgres URL, note pooler/direct for extra context.
      for (const h of PG_HOSTS) {
        if (inner.includes(h.token)) return `${r.label} via ${h.label}`;
      }
      return r.label;
    }
  }
  for (const h of PG_HOSTS) {
    if (inner.includes(h.token)) return h.label;
  }
  return "unknown-target";
}

function run() {
  if (!fs.existsSync(FILE)) {
    console.log("STATUS=env-file-missing");
    process.exit(2);
  }
  let text;
  try {
    text = fs.readFileSync(FILE, "utf8");
  } catch {
    console.log("STATUS=env-file-unreadable");
    process.exit(2);
  }

  const lines = text.split(/\r?\n/);
  const state = Object.fromEntries(
    WATCH.map((k) => [k, { active: "absent", commentedLabels: [] }])
  );

  for (const rawLine of lines) {
    const line = rawLine ?? "";
    const commented = /^\s*#/.test(line);
    const body = line.replace(/^\s*#\s*/, "");
    const m = body.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2];
    if (!WATCH.includes(key)) continue;
    const label = classify(val);
    if (commented) {
      state[key].commentedLabels.push(label);
    } else if (state[key].active === "absent") {
      // dotenv semantics: first active declaration wins
      state[key].active = label;
    }
  }

  const rows = [["VAR", "ACTIVE_LABEL", "COMMENTED_VARIANTS"]];
  for (const k of WATCH) {
    const s = state[k];
    const commented =
      s.commentedLabels.length > 0 ? s.commentedLabels.join(" | ") : "-";
    rows.push([k, s.active, commented]);
  }

  const widths = [0, 0, 0];
  for (const r of rows) {
    for (let i = 0; i < 3; i++) {
      if (r[i].length > widths[i]) widths[i] = r[i].length;
    }
  }
  for (const r of rows) {
    console.log(
      r[0].padEnd(widths[0]) +
        "  " +
        r[1].padEnd(widths[1]) +
        "  " +
        r[2].padEnd(widths[2])
    );
  }

  console.log("");
  console.log(
    "NOTE: This reflects .env.local on disk at check time. The already-running :3008 process snapshotted env at its own boot; its loaded target is NOT verified by this check. Treat loaded-target as UNKNOWN until an app-side diagnostic the operator trusts, or a restart, confirms it."
  );
}

try {
  run();
} catch {
  // Explicitly do NOT include error message — may contain file content.
  console.log("STATUS=inspection-failed-sanitized");
  process.exit(3);
}
