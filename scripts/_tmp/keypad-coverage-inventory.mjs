// scripts/_tmp/keypad-coverage-inventory.mjs
// Read-only · classify every nex-native file with raw <input>/<textarea>
// into keypad-coverage buckets. Pure static inventory, no edits.
import { execSync } from "node:child_process";

const grep = (pattern) => {
  try {
    return execSync(`git grep -lE ${JSON.stringify(pattern)} -- "src/app/nex-native"`, { encoding: "utf8" })
      .trim().split("\n").filter(Boolean);
  } catch (e) {
    return [];
  }
};

const inputs = new Set(grep("<input\\s"));
const textareas = new Set(grep("<textarea\\s"));
const matches = [...new Set([...inputs, ...textareas])];
const nexWired = new Set(grep("NexInput|NexTextarea"));

const inherited = new Set(
  execSync("git status --porcelain", { encoding: "utf8" })
    .trim().split("\n")
    .map((l) => l.slice(3).trim())
    .filter((p) => p.endsWith(".tsx") || p.endsWith(".ts"))
);

const EXCLUDE_PATTERNS = [
  /\/sign-in\//, /\/auth\//, /\/vault\//, /\/hq\//, /_pin-entry/, /_face-camera/,
  /_avatar-camera/, /_avatar-picker/, /_safe-trade-consent-modal/,
  /security-recovery/, /security-audit/, /payments\/_qr-actions/, /_e2e-/,
  /_report-user-modal/, /_report-flip-card/, /\/_face-/,
];
const SEALED_PATTERNS = [
  /chat-standard\/_joker-keypad/, /chat-standard\/_standard-experience/,
  /chat\/peer\/\[accountId\]\/_composer/, /chat-standard\/_universal-composer-footer/,
  /free-chat\/_composer-client/,
];
const CO_OWNER_PATTERNS = [
  /chat\/peer\/\[accountId\]\//, /^src\/app\/nex-native\/_actions\.ts$/,
  /crypto\//,
];

const bucket = { WIRED: [], SEALED: [], EXCLUDED: [], CO_OWNER_INHERITED: [], MISSING_CLEAN: [] };
for (const raw of matches) {
  const file = raw.replace(/\\/g, "/");
  if (SEALED_PATTERNS.some((r) => r.test(file))) bucket.SEALED.push(file);
  else if (EXCLUDE_PATTERNS.some((r) => r.test(file))) bucket.EXCLUDED.push(file);
  else if (nexWired.has(raw)) bucket.WIRED.push(file);
  else if (CO_OWNER_PATTERNS.some((r) => r.test(file)) || inherited.has(file)) bucket.CO_OWNER_INHERITED.push(file);
  else bucket.MISSING_CLEAN.push(file);
}

for (const k of Object.keys(bucket)) {
  console.log(`== ${k} (${bucket[k].length})`);
  for (const f of bucket[k].sort()) console.log(`  ${f}`);
}
