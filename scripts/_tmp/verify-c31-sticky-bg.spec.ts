import { test } from "@playwright/test";

test("C31 · sticky header + fixed wave bg", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3029" },
  ]);
  await page.goto("http://localhost:3029/nex-native/contacts", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${testInfo.outputDir}/c31-top.png`, fullPage: false });

  const before = await page.evaluate(() => {
    const scroll = document.querySelector('[data-nex-contacts-root]') as HTMLElement | null;
    const shell = document.querySelector('[data-nex-contacts-shell]') as HTMLElement | null;
    const header = document.querySelector('[data-nex-contacts-root] header') as HTMLElement | null;
    const bgImg = shell?.querySelector('img') as HTMLImageElement | null;
    return {
      headerTop: header?.getBoundingClientRect().top,
      bgTop: bgImg?.getBoundingClientRect().top,
      bgLeft: bgImg?.getBoundingClientRect().left,
      scrollHeight: scroll?.scrollHeight,
      clientHeight: scroll?.clientHeight,
    };
  });
  console.log("before scroll:", before);

  await page.evaluate(() => {
    const m = document.querySelector('[data-nex-contacts-root]') as HTMLElement | null;
    if (m) m.scrollTop = 500;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${testInfo.outputDir}/c31-scrolled.png`, fullPage: false });

  const after = await page.evaluate(() => {
    const scroll = document.querySelector('[data-nex-contacts-root]') as HTMLElement | null;
    const shell = document.querySelector('[data-nex-contacts-shell]') as HTMLElement | null;
    const header = document.querySelector('[data-nex-contacts-root] header') as HTMLElement | null;
    const bgImg = shell?.querySelector('img') as HTMLImageElement | null;
    return {
      scrollTop: scroll?.scrollTop,
      headerTop: header?.getBoundingClientRect().top,
      bgTop: bgImg?.getBoundingClientRect().top,
      bgLeft: bgImg?.getBoundingClientRect().left,
    };
  });
  console.log("after scroll:", after);
});
