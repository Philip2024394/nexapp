import { test } from "@playwright/test";

test("C30 · header + sort + green dot", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.context().addCookies([
    { name: "nex_dev_override", value: "nex-99901", url: "http://localhost:3026" },
  ]);
  await page.goto("http://localhost:3026/nex-native/contacts", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector(".nex-native-frame", { timeout: 20_000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${testInfo.outputDir}/c30-top.png`, fullPage: false });

  const probe = await page.evaluate(() => {
    const cart = document.querySelector('[data-nex-contacts-cart-trigger]') as HTMLElement | null;
    const drawerWrapper = document.querySelector('[data-nex-contacts-global-drawer]') as HTMLElement | null;
    const drawerBtn = drawerWrapper?.querySelector('button') as HTMLElement | null;
    const header = document.querySelector('[data-nex-contacts-root] header') as HTMLElement | null;
    const rows = Array.from(document.querySelectorAll('[data-nex-contacts-row-name]')).map(n => n.textContent?.trim());
    const presence = Array.from(document.querySelectorAll('[data-nex-contacts-row-presence-bottom]')).map(n => n.textContent?.trim());
    return {
      cartRect: cart?.getBoundingClientRect(),
      drawerWrapperRect: drawerWrapper?.getBoundingClientRect(),
      drawerBtnSize: drawerBtn ? { w: drawerBtn.offsetWidth, h: drawerBtn.offsetHeight } : null,
      cartOrder: cart && drawerWrapper ? (cart.getBoundingClientRect().left < drawerWrapper.getBoundingClientRect().left ? "cart-left-of-drawer" : "cart-right-of-drawer") : null,
      headerRight: header?.getBoundingClientRect().right,
      rows,
      presence,
    };
  });
  console.log(JSON.stringify(probe, null, 2));

  // scroll to confirm all 6
  await page.evaluate(() => {
    const m = document.querySelector('[data-nex-contacts-root]') as HTMLElement | null;
    if (m) m.scrollTop = 400;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${testInfo.outputDir}/c30-mid.png`, fullPage: false });
});
