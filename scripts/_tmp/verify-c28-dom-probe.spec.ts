import { test } from "@playwright/test";

test("C28 · DOM scroll probe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3022" },
  ]);
  await page.goto("http://localhost:3022/nex-native/contacts", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(4000);

  const probe = await page.evaluate(() => {
    const el = (sel: string) => document.querySelector(sel) as HTMLElement | null;
    const row = el("[data-nex-contacts-row]");
    const main = el("[data-nex-contacts-root]");
    const slide = el("[data-nex-page-slide-root]");
    const frame = el(".nex-native-frame");
    const stage = el(".nex-native-stage");
    const probe = (e: HTMLElement | null, name: string) => {
      if (!e) return { name, found: false };
      const cs = getComputedStyle(e);
      return {
        name,
        found: true,
        scrollHeight: e.scrollHeight,
        clientHeight: e.clientHeight,
        offsetHeight: e.offsetHeight,
        overflow: cs.overflow,
        overflowY: cs.overflowY,
        position: cs.position,
        height: cs.height,
      };
    };
    return {
      numContactRows: document.querySelectorAll("[data-nex-contacts-row]").length,
      row: probe(row, "row[0]"),
      main: probe(main, "contacts-root"),
      slide: probe(slide, "slide-root"),
      frame: probe(frame, "nex-native-frame"),
      stage: probe(stage, "nex-native-stage"),
      bodyHeight: document.body.scrollHeight,
      windowInnerHeight: window.innerHeight,
    };
  });
  console.log("DOM probe:", JSON.stringify(probe, null, 2));
});
