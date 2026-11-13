// READ-ONLY probe · opens a public shop at 4 viewports, screenshots, and
// prints a small JSON summary. Does NOT modify code, does NOT commit.
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3009";
const SLUG = process.env.SLUG ?? "hendra-watches";
const URL = `${BASE}/nex-native/${SLUG}`;
const OUT = "C:/Users/Victus/nexapp/scripts/_tmp";

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "1024", width: 1024, height: 900 },
  { label: "768",  width: 768,  height: 900 },
  { label: "500",  width: 500,  height: 900 },
  { label: "400",  width: 400,  height: 820 },
];

const results = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15",
    });
    const page = await ctx.newPage();
    const resp = await page.goto(URL, { waitUntil: "networkidle", timeout: 30000 });

    // Measure the sealed frame
    const metrics = await page.evaluate(() => {
      const stage = document.querySelector(".nex-native-stage");
      const frame = document.querySelector(".nex-native-frame");
      const innerPf = document.querySelector("[data-nex-phone-frame]");
      const innerPd = document.querySelector("[data-nex-phone-device]");
      const stageBg = stage ? getComputedStyle(stage).background : null;
      const frameBox = frame ? frame.getBoundingClientRect() : null;
      const innerPfBox = innerPf ? innerPf.getBoundingClientRect() : null;
      const innerPdBox = innerPd ? innerPd.getBoundingClientRect() : null;
      const frameStyle = frame
        ? {
            width: getComputedStyle(frame).width,
            height: getComputedStyle(frame).height,
            borderRadius: getComputedStyle(frame).borderRadius,
            boxShadow: getComputedStyle(frame).boxShadow,
            position: getComputedStyle(frame).position,
          }
        : null;
      const chatCta = document.querySelector('[data-nex-shop-chat-fab], .nex-shop-chat-fab, a[href*="/chat/"]');
      const burger = document.querySelector('[data-nex-burger], button[aria-label*="menu" i]');
      const hasAuthWall = /sign.?in|create.?account/i.test(document.body.innerText) &&
        !document.body.innerText.includes("Shop");
      return {
        hasStage: !!stage,
        hasFrame: !!frame,
        hasInnerPhoneFrame: !!innerPf,
        hasInnerPhoneDevice: !!innerPd,
        frameStyle,
        frameBox,
        innerPfBox,
        innerPdBox,
        stageBg: stageBg?.slice(0, 80),
        hasChatCta: !!chatCta,
        hasBurger: !!burger,
        hasAuthWall,
        bodyLen: document.body.innerText.length,
      };
    });

    const file = `${OUT}/desktop-discovery-${vp.label}.png`;
    await page.screenshot({ path: file, fullPage: false });
    results.push({
      viewport: vp,
      status: resp?.status(),
      file,
      ...metrics,
    });
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
