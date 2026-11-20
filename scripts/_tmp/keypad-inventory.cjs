// scripts/_tmp/keypad-inventory.cjs — read-only classification.
const { execSync } = require("child_process");

const run = (cmd) => {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  } catch (e) {
    console.error("cmd failed:", cmd, "\n", e.message);
    return [];
  }
};

const inputs = run('git grep -lE "<input\\s" -- src/app/nex-native');
const textareas = run('git grep -lE "<textarea\\s" -- src/app/nex-native');
const matches = Array.from(new Set([...inputs, ...textareas])).map((f) =>
  f.replace(/\\/g, "/")
);

const wired = new Set(
  run('git grep -lE "NexInput|NexTextarea" -- src').map((f) =>
    f.replace(/\\/g, "/")
  )
);

const inh = new Set(
  run("git status --porcelain").map((l) => l.slice(3).trim().replace(/\\/g, "/"))
);

console.log(
  "match_count:",
  matches.length,
  "wired_count:",
  wired.size,
  "inherited_count:",
  inh.size
);

const EXCL = [
  /\/sign-in\//,
  /\/auth\//,
  /\/vault\//,
  /\/hq\//,
  /_pin-entry/,
  /_face-camera/,
  /_avatar-camera/,
  /_avatar-picker/,
  /_safe-trade-consent-modal/,
  /security-recovery/,
  /security-audit/,
  /payments\/_qr-actions/,
  /_e2e-/,
  /_report-user-modal/,
  /_report-flip-card/,
];
const SEALED = [
  /chat-standard\/_joker-keypad/,
  /chat-standard\/_standard-experience/,
  /chat\/peer\/\[accountId\]\/_composer/,
  /chat-standard\/_universal-composer-footer/,
  /free-chat\/_composer-client/,
];
const COOWN = [
  /chat\/peer\/\[accountId\]\//,
  /^src\/app\/nex-native\/_actions\.ts$/,
  /crypto\//,
];

const bucket = {
  WIRED: [],
  SEALED: [],
  EXCLUDED: [],
  CO_OWNER_INHERITED: [],
  MISSING_CLEAN: [],
};
for (const file of matches) {
  if (SEALED.some((r) => r.test(file))) bucket.SEALED.push(file);
  else if (EXCL.some((r) => r.test(file))) bucket.EXCLUDED.push(file);
  else if (wired.has(file)) bucket.WIRED.push(file);
  else if (COOWN.some((r) => r.test(file)) || inh.has(file))
    bucket.CO_OWNER_INHERITED.push(file);
  else bucket.MISSING_CLEAN.push(file);
}
for (const k of ["WIRED", "SEALED", "EXCLUDED", "CO_OWNER_INHERITED", "MISSING_CLEAN"]) {
  console.log(`== ${k} (${bucket[k].length})`);
  for (const f of bucket[k].sort()) console.log(" ", f);
}
