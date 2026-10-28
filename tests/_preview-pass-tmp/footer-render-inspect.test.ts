import { describe, test, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/nex-native/nex-keyboard/nex-textarea", () => ({
  NexTextarea: (props: any) =>
    React.createElement("textarea", {
      "data-nex-mock-nex-textarea": "true",
      ...props,
    }),
}));

import { LiveViewerFooter } from "../../src/components/nex-native/live-commerce/LiveViewerFooter";

test("inspect order of data attrs in rendered HTML", () => {
  const html = renderToStaticMarkup(
    React.createElement(LiveViewerFooter, {
      viewShopHref: "/x",
      shareUrl: "https://x",
      shareTitle: "x",
      onLike: () => {},
      onComment: () => {},
      onShareEvidence: () => {},
    }),
  );
  const attrs = [
    "data-nex-live-footer-like",
    "data-nex-live-footer-share",
    "data-nex-live-footer-view-shop",
    "data-nex-live-footer-go-live",
    "View Shop",
    "Shop",
    "Market",
  ];
  console.log("TOTAL LENGTH=" + html.length);
  for (const a of attrs) {
    const first = html.indexOf(a);
    console.log(`${a} first@=${first}`);
  }
  // Expose where "View Shop" is - likely nowhere
  // Expose actual label used
  const labelMatch = html.match(/data-nex-live-footer-view-shop[\s\S]{0,2000}<\/a>/);
  console.log("--- view-shop button HTML (first 500 chars after attr):");
  if (labelMatch) console.log(labelMatch[0].slice(0, 500));
});
