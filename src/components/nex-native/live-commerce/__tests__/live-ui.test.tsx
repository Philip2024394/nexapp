// src/components/nex-native/live-commerce/__tests__/live-ui.test.tsx
//
// Phase 2 · Live interaction UI build tests.
// Covers: LiveCommentsOverlay + LiveViewerFooter rendered-HTML
// + source-shape wiring on the viewer client.

import { describe, test, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/nex-native/nex-keyboard/nex-textarea", () => ({
  NexTextarea: (props: {
    value: string;
    placeholder?: string;
    maxLength?: number;
    disabled?: boolean;
    "data-nex-live-footer-text-input"?: string;
  }) =>
    React.createElement("textarea", {
      "data-nex-mock-nex-textarea": "true",
      "data-nex-live-footer-text-input":
        props["data-nex-live-footer-text-input"],
      maxLength: props.maxLength,
      disabled: props.disabled,
      placeholder: props.placeholder,
      defaultValue: props.value,
    }),
}));

import { LiveCommentsOverlay } from "../LiveCommentsOverlay";
import { LiveViewerFooter } from "../LiveViewerFooter";

/* ─── LiveCommentsOverlay ─────────────────────────────────── */

describe("LiveCommentsOverlay · rendered", () => {
  test("empty comments · renders nothing", () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveCommentsOverlay, { comments: [] }),
    );
    expect(html).toBe("");
  });

  test("renders NEX-ID + text · no author display name", () => {
    // Owner directive 2026-10-25 (F1) · SSR tests pass the opt-in
    // `initialVisibleEntries` prop so renderToStaticMarkup can see
    // comments. Production never passes this prop · the useEffect
    // admits comments as they arrive from `props.comments`.
    const seed = [
      {
        authorAccountId: "11111111-1111-1111-1111-111111111111",
        text: "This is a comment",
        clientSentAt: "2026-10-24T22:00:00Z",
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(LiveCommentsOverlay, {
        comments: seed,
        initialVisibleEntries: seed,
      }),
    );
    expect(html).toContain("data-nex-live-comments-overlay");
    expect(html).toContain("nex-11111111");
    expect(html).toContain("This is a comment");
  });

  test("caps the visible tail at MAX_VISIBLE_COMMENTS (sealed = 3)", () => {
    // Owner spec 2026-10-24 (LiveCommentsOverlay.tsx line 36) · the
    // sealed on-screen cap is 3, not 6. The SSR seed applies the
    // same tail rule so this test matches the real post-admit cap.
    const comments = Array.from({ length: 20 }, (_, i) => ({
      authorAccountId: `${i}`,
      text: `comment ${i}`,
      clientSentAt: `${i}`,
    }));
    const html = renderToStaticMarkup(
      React.createElement(LiveCommentsOverlay, {
        comments,
        initialVisibleEntries: comments,
      }),
    );
    // Only the last 3 render · earlier comments are not in the DOM.
    expect(html).toContain("comment 19");
    expect(html).toContain("comment 18");
    expect(html).toContain("comment 17");
    expect(html).not.toContain("comment 16");
    expect(html).not.toContain("comment 14");
    expect(html).not.toContain("comment 5");
  });

  test("uses custom resolveNexId when provided", () => {
    const seed = [
      {
        authorAccountId: "abc-123",
        text: "x",
        clientSentAt: "x",
      },
    ];
    const html = renderToStaticMarkup(
      React.createElement(LiveCommentsOverlay, {
        comments: seed,
        initialVisibleEntries: seed,
        resolveNexId: () => "nex-99999",
      }),
    );
    expect(html).toContain("nex-99999");
  });

  test("aria-live=polite · screen-reader friendly", () => {
    const seed = [
      { authorAccountId: "a", text: "x", clientSentAt: "x" },
    ];
    const html = renderToStaticMarkup(
      React.createElement(LiveCommentsOverlay, {
        comments: seed,
        initialVisibleEntries: seed,
      }),
    );
    expect(html).toContain('aria-live="polite"');
  });

  test("prefers-reduced-motion rule present", () => {
    const seed = [
      { authorAccountId: "a", text: "x", clientSentAt: "x" },
    ];
    const html = renderToStaticMarkup(
      React.createElement(LiveCommentsOverlay, {
        comments: seed,
        initialVisibleEntries: seed,
      }),
    );
    expect(html).toContain("prefers-reduced-motion");
  });
});

/* ─── LiveViewerFooter ────────────────────────────────────── */

describe("LiveViewerFooter · rendered", () => {
  const base = {
    viewShopHref: "/nex-native/shop",
    shareUrl: "https://nex.app/live/123",
    shareTitle: "Watch this NEX Live",
    onLike: () => {},
    onComment: () => {},
    onShareEvidence: () => {},
  };

  test("renders Like, View Shop, Share, and the text input", () => {
    // Owner directive 2026-10-25 (F2) · the default label is
    // context-aware since the 2026-10-24 "View Shop" vs "View
    // Market" change (LiveViewerFooter.tsx line 56). Callers that
    // want the "View Shop" label pass it explicitly as
    // `viewTargetLabel` · when omitted, the fallback is "Shop". The
    // test exercises the explicit-label path.
    const html = renderToStaticMarkup(
      React.createElement(LiveViewerFooter, {
        ...base,
        viewTargetLabel: "View Shop",
      }),
    );
    expect(html).toContain("data-nex-live-footer-like");
    expect(html).toContain("data-nex-live-footer-view-shop");
    expect(html).toContain("data-nex-live-footer-share");
    expect(html).toContain("data-nex-live-footer-text-input");
    expect(html).toContain("data-nex-live-footer-send");
    expect(html).toContain("View Shop");
    expect(html).toContain("Like");
    expect(html).toContain("Share");
  });

  test("uses the NEX keypad primitive (NexTextarea) for the text input", () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveViewerFooter, base),
    );
    expect(html).toContain("data-nex-mock-nex-textarea");
  });

  test("layout order · Like · View Shop · Share (left · center · right)", () => {
    // Owner directive 2026-10-25 (F2) · the previous `indexOf` on
    // raw HTML matched the data-attribute names inside the <style>
    // blocks (which list `like,share,go-live,view-shop` in CSS
    // selector order) · not the actual rendered buttons. Fix: locate
    // the opening <button or <a tag that carries each attribute so
    // we're measuring real DOM order.
    const html = renderToStaticMarkup(
      React.createElement(LiveViewerFooter, base),
    );
    const findTagIdx = (attr: string): number => {
      // Match the first `<button ... data-nex-...` or
      // `<a ... data-nex-...` opening tag that contains the attr.
      const re = new RegExp(`<(?:button|a)\\b[^>]*${attr}\\b`, "");
      const m = re.exec(html);
      return m ? m.index : -1;
    };
    const likeIdx = findTagIdx("data-nex-live-footer-like");
    const viewShopIdx = findTagIdx("data-nex-live-footer-view-shop");
    const shareIdx = findTagIdx("data-nex-live-footer-share");
    expect(likeIdx).toBeGreaterThan(-1);
    expect(viewShopIdx).toBeGreaterThan(likeIdx);
    expect(shareIdx).toBeGreaterThan(viewShopIdx);
  });

  test("View Shop button is an anchor to the provided href", () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveViewerFooter, {
        ...base,
        viewShopHref: "/nex-native/aisha-vintage",
      }),
    );
    expect(html).toContain('href="/nex-native/aisha-vintage"');
  });

  test("isLiked=true renders a filled heart + red treatment", () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveViewerFooter, { ...base, isLiked: true }),
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("❤");
  });

  test("isLiked=false renders an outline heart", () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveViewerFooter, { ...base, isLiked: false }),
    );
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("♡");
  });

  test("disabled=true · Send + Like + Share disabled; View Shop stays navigable", () => {
    const html = renderToStaticMarkup(
      React.createElement(LiveViewerFooter, { ...base, disabled: true }),
    );
    // View Shop is an <a>, not a <button>, and remains tappable so
    // the viewer can always leave the live surface for the shop.
    expect(html).toContain("data-nex-live-footer-view-shop");
    // Buttons carry the disabled attribute. Attribute order isn't
    // guaranteed · check that each button tag contains both.
    const likeBtn = html.match(/<button[^>]*data-nex-live-footer-like[^>]*>/);
    expect(likeBtn?.[0]).toMatch(/disabled/);
    const shareBtn = html.match(/<button[^>]*data-nex-live-footer-share[^>]*>/);
    expect(shareBtn?.[0]).toMatch(/disabled/);
  });
});

/* ─── Source-shape · viewer client wiring ──────────────────── */

const VIEWER_CLIENT = readFileSync(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "app",
    "nex-native",
    "live-commerce",
    "[sessionId]",
    "_viewer-client.tsx",
  ),
  "utf8",
);

describe("Viewer client · mounts the footer + comments overlay", () => {
  test("imports both new components", () => {
    expect(VIEWER_CLIENT).toMatch(
      /import \{ LiveCommentsOverlay \} from "@\/components\/nex-native\/live-commerce\/LiveCommentsOverlay"/,
    );
    // Owner directive 2026-10-25 (F2) · the LiveViewerFooter import
    // was legitimately extended to include `type LiveReplyContext`
    // between `LiveViewerFooter` and `type ShareEvidence` as part
    // of the owner-authorised reply-context feature. Allow any
    // intermediate imports (whitespace, types, named imports)
    // between them without weakening the assertion that both the
    // component and ShareEvidence are imported from the same path.
    expect(VIEWER_CLIENT).toMatch(
      /\bLiveViewerFooter\b[\s\S]*?\btype ShareEvidence\b[\s\S]*?\} from "@\/components\/nex-native\/live-commerce\/LiveViewerFooter"/,
    );
  });

  test("imports the comments channel wrapper", () => {
    expect(VIEWER_CLIENT).toMatch(
      /openLiveCommentsChannel[\s\S]*?from "@\/lib\/nex-native\/live-broadcast\/live-comments-channel"/,
    );
  });

  test("opens the comments channel with role='viewer' + selfAccountId", () => {
    expect(VIEWER_CLIENT).toMatch(
      /openLiveCommentsChannel\(\{[\s\S]*?role:\s*"viewer"[\s\S]*?selfAccountId:\s*viewerAccountId/,
    );
  });

  test("closes the comments channel in the useEffect cleanup", () => {
    expect(VIEWER_CLIENT).toMatch(/commentsChannel\.close\(\)/);
  });

  test("comments ring buffer caps at 50 (defence-in-depth)", () => {
    expect(VIEWER_CLIENT).toMatch(/next\.length > 50/);
  });

  test("comments overlay only mounts when state === 'live'", () => {
    expect(VIEWER_CLIENT).toMatch(
      /state === "live"[\s\S]*?<LiveCommentsOverlay/,
    );
  });

  test("footer mounts in idle/waiting/connecting/live · hidden in dead states", () => {
    // Pre-live states render the footer in disabled mode so viewers
    // see the Like / View Shop / Share affordances arrive · taps are
    // gated by the `disabled` prop. Dead states (ended / at-capacity
    // / offline) hide the footer entirely.
    expect(VIEWER_CLIENT).toMatch(
      /state === "idle"[\s\S]*?state === "waiting"[\s\S]*?state === "connecting"[\s\S]*?state === "live"[\s\S]*?<LiveViewerFooter/,
    );
  });

  test("footer is disabled when state !== 'live' OR broadcaster not yet identified", () => {
    expect(VIEWER_CLIENT).toMatch(
      /disabled=\{state !== "live" \|\| !broadcasterAccountId\}/,
    );
  });

  test("isSelf is derived from broadcasterAccountId === viewerAccountId", () => {
    expect(VIEWER_CLIENT).toMatch(
      /const isSelf = broadcasterAccountId !== null[\s\S]*?broadcasterAccountId === viewerAccountId/,
    );
  });

  test("footer is HIDDEN when viewer is watching their own broadcast", () => {
    expect(VIEWER_CLIENT).toMatch(
      /&& !isSelf \&\&[\s\S]*?<LiveViewerFooter/,
    );
  });

  test("self-indicator renders in place of footer when isSelf && state === 'live'", () => {
    expect(VIEWER_CLIENT).toMatch(/data-nex-live-viewer-self-indicator/);
    expect(VIEWER_CLIENT).toMatch(/isSelf \&\& state === "live"/);
    expect(VIEWER_CLIENT).toMatch(/You(&apos;|')?re the broadcaster/);
  });

  test("vertical swipeable feed · touch handlers wired to main", () => {
    expect(VIEWER_CLIENT).toMatch(/onTouchStart=\{handleTouchStart\}/);
    expect(VIEWER_CLIENT).toMatch(/onTouchEnd=\{handleTouchEnd\}/);
  });

  test("swipe up (dy < 0) advances to nextSessionId", () => {
    expect(VIEWER_CLIENT).toMatch(
      /if \(dy < 0 && nextSessionId\)[\s\S]*?router\.push\(`\/nex-native\/live-commerce\/\$\{nextSessionId\}`\)/,
    );
  });

  test("swipe down (dy > 0) returns to prevSessionId", () => {
    expect(VIEWER_CLIENT).toMatch(
      /else if \(dy > 0 && prevSessionId\)[\s\S]*?router\.push\(`\/nex-native\/live-commerce\/\$\{prevSessionId\}`\)/,
    );
  });

  test("swipe threshold · ignores sub-60px travel + horizontal-dominant gestures", () => {
    expect(VIEWER_CLIENT).toMatch(/Math\.abs\(dy\) < 60/);
    expect(VIEWER_CLIENT).toMatch(/Math\.abs\(dx\) > Math\.abs\(dy\)/);
  });

  test("keyboard nav · ArrowUp/ArrowDown + PageUp/PageDown mirror swipe", () => {
    expect(VIEWER_CLIENT).toMatch(/ev\.key === "ArrowDown".*?nextSessionId/);
    expect(VIEWER_CLIENT).toMatch(/ev\.key === "ArrowUp".*?prevSessionId/);
    expect(VIEWER_CLIENT).toMatch(/PageDown/);
    expect(VIEWER_CLIENT).toMatch(/PageUp/);
  });

  test("keyboard nav · skipped when composer textarea is focused", () => {
    expect(VIEWER_CLIENT).toMatch(
      /target\.tagName === "TEXTAREA" \|\| target\.tagName === "INPUT"/,
    );
  });

  test("main element is 100dvh × 100vw with touchAction: pan-y", () => {
    expect(VIEWER_CLIENT).toMatch(/height: "100dvh"/);
    expect(VIEWER_CLIENT).toMatch(/width: "100vw"/);
    expect(VIEWER_CLIENT).toMatch(/touchAction: "pan-y"/);
  });

  test("edge behaviour · no wraparound (null when at boundary)", () => {
    expect(VIEWER_CLIENT).toMatch(
      /currentIndex < siblings\.length - 1[\s\S]*?: null/,
    );
    expect(VIEWER_CLIENT).toMatch(/currentIndex > 0 \? siblings\[currentIndex - 1\] : null/);
  });

  test("current session guaranteed in sibling list even if DB misses it", () => {
    // Server-side defence · the page.tsx prepends the current session
    // id so index lookup is always defined.
    const PAGE_TSX = readFileSync(
      resolve(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "app",
        "nex-native",
        "live-commerce",
        "[sessionId]",
        "page.tsx",
      ),
      "utf8",
    );
    expect(PAGE_TSX).toMatch(/!siblingSessionIds\.includes\(sessionId\)/);
    expect(PAGE_TSX).toMatch(/\[sessionId, \.\.\.siblingSessionIds\]/);
  });

  test("broadcaster's own session excluded from the swipe list", () => {
    const PAGE_TSX = readFileSync(
      resolve(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "app",
        "nex-native",
        "live-commerce",
        "[sessionId]",
        "page.tsx",
      ),
      "utf8",
    );
    expect(PAGE_TSX).toMatch(
      /\.filter\(\(s\) => s\.broadcaster_account_id !== viewerAccountId\)/,
    );
  });

  test("footer sits OUTSIDE the video div so StateOverlay cannot cover it", () => {
    // StateOverlay is `position: absolute; inset: 0` on the video
    // div. Keeping the footer as a sibling of the video div (not a
    // child) means the overlay doesn't paint over the Like/Share
    // chrome in pre-live states.
    expect(VIEWER_CLIENT).toMatch(
      /<LiveCommentsOverlay[\s\S]*?\)\}[\s\S]*?<\/div>[\s\S]*?<LiveViewerFooter/,
    );
  });

  test("share-evidence handler records the evidence tag", () => {
    expect(VIEWER_CLIENT).toMatch(
      /handleShareEvidence[\s\S]*?nexLiveLastShareEvidence/,
    );
  });

  test("viewShopHref routes to the broadcaster's NEX profile", () => {
    expect(VIEWER_CLIENT).toMatch(
      /\/nex-native\/u\/\$\{broadcasterAccountId\}/,
    );
  });

  test("comment post echoes locally (self-broadcast is filtered by the channel)", () => {
    // Owner directive 2026-10-25 (F2) · `channel.post` legitimately
    // takes an optional second argument (the reply context) since
    // the 2026-10-24 reply-mode feature. Allow either `post(text)`
    // or `post(text, <anything>)` without weakening the assertion
    // that `text` is the first argument.
    expect(VIEWER_CLIENT).toMatch(
      /handleSendComment[\s\S]*?channel\.post\(\s*text[,)\s]/,
    );
    expect(VIEWER_CLIENT).toMatch(/handleSendComment[\s\S]*?setComments/);
  });
});
