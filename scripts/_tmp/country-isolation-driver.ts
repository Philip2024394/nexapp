// Driver companion to country-isolation-smoke.mjs.
// Verifies the security-monitor dedupe cache is NOT country-scoped.

/* eslint-disable no-console */

async function main() {
  const monitor = await import("../../src/lib/nex-native/security-monitor/security-monitor.ts");
  monitor._resetMonitorDedupForTests();

  // First signal · tagged ireland.
  process.env.NEX_APP_COUNTRY = "ireland";
  const r1 = await monitor.reportRateLimitEscalation({
    action: "e2e-isolation",
    scope: "auth",
    affectedCount: 1,
    thresholdCrossed: 1,
    windowSeconds: 60,
  });
  console.log("DRIVER:" + JSON.stringify({ step: 1, country: "ireland", result: r1 }));

  // Second signal · same scope + category · now tagged indonesia.
  process.env.NEX_APP_COUNTRY = "indonesia";
  const r2 = await monitor.reportRateLimitEscalation({
    action: "e2e-isolation",
    scope: "auth",
    affectedCount: 2,
    thresholdCrossed: 1,
    windowSeconds: 60,
  });
  console.log("DRIVER:" + JSON.stringify({ step: 2, country: "indonesia", result: r2 }));
}

void main().catch((e) => {
  console.error("driver failed:", e);
  process.exit(1);
});
