// Focused unit tests for the ChatErrorBanner · 2026-10-28.
//
// Confirms the shared consumer handles missing / malformed URL params
// safely, maps known codes to calm actionable copy, falls through to
// the generic failed-copy on unknown codes (never leaks raw strings),
// and marks blocking vs non-blocking errors correctly.
//
// Scope · the banner is intentionally a server component · we render
// it in isolation and assert on the resulting React tree via
// renderToStaticMarkup (no DOM runtime needed).

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatErrorBanner } from "../_error-banner";

const PEER = {
  peerAccountId: "4f112c32-46a3-4fa4-8b4a-1c5f50caed42",
  peerDisplayName: "Hendra Gunawan",
};

function render(props: Partial<Parameters<typeof ChatErrorBanner>[0]> = {}): string {
  const el = ChatErrorBanner({
    peerAccountId: PEER.peerAccountId,
    peerDisplayName: PEER.peerDisplayName,
    messageError: undefined,
    stickerError: undefined,
    uploadError: undefined,
    deleteError: undefined,
    ...props,
  });
  if (!el) return "";
  // renderToStaticMarkup HTML-escapes apostrophes (&#x27;) and other
  // chars · we assert against the user-visible string so decode the
  // handful of entities that matter for our test strings.
  return renderToStaticMarkup(el)
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

describe("ChatErrorBanner · param handling", () => {
  it("renders nothing when no error param is present", () => {
    expect(render({})).toBe("");
  });

  it("renders nothing for empty-string params (treats as missing)", () => {
    expect(
      render({
        messageError: "",
        stickerError: "",
        uploadError: "",
        deleteError: "",
      }),
    ).toBe("");
  });

  it("handles null safely (never throws, never renders)", () => {
    expect(
      render({
        messageError: null,
        stickerError: null,
        uploadError: null,
        deleteError: null,
      }),
    ).toBe("");
  });

  it("renders generic failed copy for an unknown message_error value (never leaks raw string)", () => {
    const html = render({ messageError: "something_weird_from_an_attacker" });
    expect(html).toContain("Message didn't send");
    expect(html).not.toContain("something_weird_from_an_attacker");
  });

  it("renders generic failed copy for an unknown delete_error value (never leaks raw string)", () => {
    const html = render({ deleteError: "Error: table users does not exist" });
    expect(html).toContain("Delete didn't complete");
    expect(html).not.toContain("table users does not exist");
    expect(html).not.toContain("Error:");
  });
});

describe("ChatErrorBanner · severity + known codes", () => {
  it("message_error=contacts_only is BLOCKING (no dismiss link, role=alert)", () => {
    const html = render({ messageError: "contacts_only" });
    expect(html).toContain("Message not sent");
    expect(html).toContain("Hendra"); // uses first-name only
    expect(html).not.toContain("Hendra Gunawan"); // not full name
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-nex-chat-error-banner="blocking"');
    expect(html).not.toContain("Dismiss");
  });

  it("message_error=send_failed is NON-BLOCKING (dismiss link + role=status)", () => {
    const html = render({ messageError: "send_failed" });
    expect(html).toContain("Message didn't send");
    expect(html).toContain('role="status"');
    expect(html).toContain('data-nex-chat-error-banner="non_blocking"');
    expect(html).toContain("Dismiss");
    expect(html).toContain(`/nex-native/chat/peer/${PEER.peerAccountId}`);
  });

  it("sticker_error=contacts_only mirrors message_error=contacts_only (blocking)", () => {
    const html = render({ stickerError: "contacts_only" });
    expect(html).toContain("Sticker not sent");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Dismiss");
  });

  it("upload_error=too_large maps to size-specific copy", () => {
    const html = render({ uploadError: "too_large" });
    expect(html).toContain("File too large");
    expect(html).toContain("smaller version");
  });

  it("upload_error=unsupported_type maps to type-specific copy", () => {
    const html = render({ uploadError: "unsupported_type" });
    expect(html).toContain("not supported");
    // Stage A · owner-authorised 2026-11-03 · copy updated so the
    // banner also mentions documents (Migration 259 extends the
    // allowed attachment_type set).
    expect(html).toContain("photos, videos, voice notes, and documents");
  });

  it("delete_error=not_allowed is BLOCKING (sender-only rule)", () => {
    const html = render({ deleteError: "not_allowed" });
    expect(html).toContain("Can't delete this message");
    expect(html).toContain("Only the person who sent");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Dismiss");
  });

  it("delete_error=too_late is BLOCKING (one-hour window)", () => {
    const html = render({ deleteError: "too_late" });
    expect(html).toContain("Delete window has passed");
    expect(html).toContain("within an hour");
    expect(html).toContain('role="alert"');
  });

  it("delete_error=not_found is NON-BLOCKING (already-gone message)", () => {
    const html = render({ deleteError: "not_found" });
    expect(html).toContain("Message already gone");
    expect(html).toContain('role="status"');
    expect(html).toContain("Dismiss");
  });
});

describe("ChatErrorBanner · priority order", () => {
  it("message_error takes priority when multiple params present", () => {
    const html = render({
      messageError: "send_failed",
      stickerError: "send_failed",
      uploadError: "failed",
      deleteError: "not_found",
    });
    expect(html).toContain("Message didn't send");
    expect(html).not.toContain("Sticker didn't send");
    expect(html).not.toContain("Upload didn't finish");
    expect(html).not.toContain("Message already gone");
  });

  it("sticker_error wins when message_error absent", () => {
    const html = render({
      stickerError: "send_failed",
      uploadError: "failed",
    });
    expect(html).toContain("Sticker didn't send");
    expect(html).not.toContain("Upload didn't finish");
  });
});
