// QA · C4 · payment resolver probe
import pkg from "pg";
import { readFileSync } from "node:fs";
const { Client } = pkg;
const dbUrl = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.*)$/m)?.[1];
const ck5 = readFileSync(".env.playwright.vault-ck5", "utf8");
const bizId = ck5.match(/PLAYWRIGHT_CK5_A_BUSINESS_ID=['"]?([^'"\n]*)['"]?$/m)?.[1];

// Register tsx on-the-fly so we can import TS files from node.
import("tsx").catch(() => { /* fallback below */ });

const { getSellerActiveMethods, getSellerMethodReadiness } = await import(
  "../../../src/lib/nex-native/payments/method-resolver-service.ts"
).catch(async () => {
  // Fallback: compile via tsx subprocess
  const { execSync } = await import("node:child_process");
  const out = execSync(
    `npx tsx -e "const m = await import('./src/lib/nex-native/payments/method-resolver-service.ts'); const a = await m.getSellerActiveMethods('${bizId}'); const r = await m.getSellerMethodReadiness('${bizId}'); console.log(JSON.stringify({ a, r }, null, 2));"`,
    { encoding: "utf8", cwd: process.cwd() },
  );
  console.log(out);
  process.exit(0);
});

const active = await getSellerActiveMethods(bizId);
const readiness = await getSellerMethodReadiness(bizId);
console.log(JSON.stringify({ businessId: bizId, active, readiness }, null, 2));
