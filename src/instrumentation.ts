// instrumentation.ts
//
// 2026-11-19 r6 · prompt-7 continuation.
// Single server-boot side-channel: logs the project-ref CLASSIFICATION
// (sandbox / prod / legacy / unclassified) of the Supabase target the
// running process loaded. Values are NEVER echoed — only one of the
// fixed labels below. The file is deliberately tiny and does not
// introduce an app page or any runtime behaviour beyond the one log
// line.
//
// Purpose: §16.20.11 unknown "Running :3008 dev-server loaded target"
// gets resolved for the current boot. If the process reloads (e.g.
// Next.js HMR server restart on config change) a fresh line will be
// emitted.
//
// This file is executed by Next.js once per server process start (both
// server + edge). Browser runtimes will not import this.

export async function register(): Promise<void> {
  const SANDBOX = "kdstoyyeygcopkogqsyv";
  const PROD = "ijvqdvsvwtwxzcqmoqit";
  const LEGACY = "msdonkkechxzgagyguoe";

  function classify(raw: string | undefined): string {
    if (!raw) return "absent";
    if (raw.includes(SANDBOX)) return "sandbox (kdstoyyeygcopkogqsyv)";
    if (raw.includes(PROD)) return "PROD (ijvqdvsvwtwxzcqmoqit)";
    if (raw.includes(LEGACY)) return "legacy-quarantined";
    return "unclassified";
  }

  const publicUrl = classify(process.env.NEXT_PUBLIC_NEX_SUPABASE_URL);
  const dbUrl = classify(process.env.DATABASE_URL);
  const nexPgUrl = classify(process.env.NEX_POSTGRES_URL);
  const prelaunchFlag =
    process.env.NEX_PRELAUNCH_MODE === "true" ? "ON" : "OFF/absent";

  // Single-line boot log · no values, just labels.
  // eslint-disable-next-line no-console
  console.log(
    `[nex-boot] NEX_SUPABASE_URL=${publicUrl} · DATABASE_URL=${dbUrl} · NEX_POSTGRES_URL=${nexPgUrl} · NEX_PRELAUNCH_MODE=${prelaunchFlag}`,
  );
}
