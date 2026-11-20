import { readFileSync } from "node:fs";
const lines = readFileSync("src/app/nex-native/hq/journey-map/page.tsx", "utf8").split("\n");
for (const n of [1734, 1736, 1742, 1753, 1754, 1761]) {
  const ln = lines[n - 1];
  console.log("line " + n + ": " + JSON.stringify(ln));
}
