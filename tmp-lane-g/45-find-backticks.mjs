import { readFileSync } from "node:fs";
const lines = readFileSync("src/app/nex-native/hq/journey-map/page.tsx", "utf8").split("\n");
for (let i = 1700; i < 1860; i++) {
  const l = lines[i - 1];
  if (!l) continue;
  for (let j = 0; j < l.length; j++) {
    const ch = l.charCodeAt(j);
    if (ch === 0x60) {
      const prev = j > 0 ? l.charCodeAt(j - 1) : 0;
      if (prev !== 0x5c) {
        console.log(i + " col " + (j + 1) + " | " + l);
        break;
      }
    }
  }
}
