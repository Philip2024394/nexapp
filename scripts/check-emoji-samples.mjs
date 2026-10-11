import { chromium } from "playwright";
const EXE =
  "C:\\Users\\Victus\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe";
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.url().includes("/dev-emoji-samples/")) {
    console.log(`  resp ${r.status()}  ${r.url()}`);
  }
});
await page.goto("http://localhost:3010/nex-native/dev/emoji-samples", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(1500);
const imgs = await page.locator("img").all();
console.log(`\nimg elements on page: ${imgs.length}`);
for (const img of imgs) {
  const src = await img.getAttribute("src");
  const naturalWidth = await img.evaluate((el) => el.naturalWidth);
  const box = await img.boundingBox();
  console.log(
    `  src=${src}  naturalWidth=${naturalWidth}  box=${JSON.stringify(box)}`,
  );
}
console.log(`\npage errors: ${errors.length}`);
for (const e of errors.slice(0, 5)) console.log(`  ! ${e.slice(0, 200)}`);
await browser.close();
