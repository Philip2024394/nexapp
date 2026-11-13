// Driver companion to hq-recovery-e2e-smoke.mjs.
// Invoked by the mjs harness via tsx + --conditions=react-server. Dynamic-
// imports the incident-service and emits a single JSON line prefixed with
// "DRIVER:" to stdout for the harness to parse.

/* eslint-disable no-console */

async function main() {
  const [, , subcommand, incidentId] = process.argv;
  if (!subcommand) {
    console.error("usage: hq-recovery-e2e-smoke-driver.ts <fetchRecent|fetchEvents> <incidentId>");
    process.exit(2);
  }
  try {
    const mod = await import("../../src/lib/nex-native/incident/incident-service.ts");
    if (subcommand === "fetchRecent") {
      // Reset the probe so this fresh invocation re-detects the table.
      mod._resetIncidentProbeForTests();
      const rows = await mod.fetchRecentIncidents(100);
      const found = rows.some((r: { id: string }) => r.id === incidentId);
      console.log("DRIVER:" + JSON.stringify({ subcommand, count: rows.length, found }));
      return;
    }
    if (subcommand === "fetchEvents") {
      mod._resetIncidentProbeForTests();
      try {
        const events = await mod.fetchIncidentEvents(incidentId);
        console.log("DRIVER:" + JSON.stringify({ subcommand, count: events.length, threw: false }));
        return;
      } catch (e) {
        console.log(
          "DRIVER:" +
            JSON.stringify({
              subcommand,
              count: -1,
              threw: true,
              error: e instanceof Error ? e.message : String(e),
            }),
        );
        return;
      }
    }
    console.error(`unknown subcommand ${subcommand}`);
    process.exit(2);
  } catch (e) {
    console.error("driver import/exec failed:", e);
    process.exit(3);
  }
}

void main();
