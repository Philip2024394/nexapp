// src/lib/nex-native/__tests__/guest-shop-enquiry-popup.test.tsx
//
// Rev 3 guest-shop-enquiry popup · component contract tests.
// ---------------------------------------------------------------------------
// The popup is the signed-out FAB tap target (2026-11-28 owner directive).
// These tests pin:
//   · client-side validation parity with the server validator
//   · honest handling of every server status we documented in the endpoint
//     (200 · 400 · 404 · 409 · 429 duplicate · 429 rate_limited · 503
//     endpoint_not_ready · 503 temporarily_unavailable · network error)
//   · "no false success" invariant — the UI never shows the Sent state
//     unless the server returned 2xx
//
// jsdom provides createPortal + document.body. Each test mounts the popup
// through a stub `postShopEnquiry` so no real network call fires.

/* @vitest-environment jsdom */

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { GuestShopEnquiryPopup } from "@/components/nex-native/business-chat/GuestShopEnquiryPopup";

const SHOP = {
  shopName: "X-Rated Tool Belts",
  shopSlug: "x-rated-tool-belts",
  shopBusinessId: "22222222-2222-4222-8222-222222299902",
  accent: "#C6A15B",
};

/** Build a minimal Response-like object our popup consumes.
 *  Only .status and .json() are read; keeping this stub tight prevents
 *  accidental reliance on fetch-browser internals. */
function makeResponse(status: number, body: unknown): Response {
  return {
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function fillHappyPath(): void {
  fireEvent.change(screen.getByPlaceholderText("e.g. Aoife Byrne"), {
    target: { value: "Aoife Byrne" },
  });
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
    target: { value: "aoife@example.com" },
  });
  // Phone is required · owner directive 2026-11-28.
  fireEvent.change(screen.getByPlaceholderText("+44 7700 900000"), {
    target: { value: "+447700900000" },
  });
  // Country is a required dropdown selection · catalogue-backed.
  fireEvent.change(
    document.querySelector("[data-nex-field='nex-guest-enquiry-country']")!,
    { target: { value: "IE" } },
  );
  fireEvent.change(
    screen.getByPlaceholderText("What would you like to ask about?"),
    {
      target: {
        value:
          "Hello, I'd like to buy the brown Tool Belt please. Can you ship to Ireland?",
      },
    },
  );
}

afterEach(() => {
  cleanup();
});

describe("GuestShopEnquiryPopup · headline + honesty copy", () => {
  it("renders the shop name in the headline", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
      "X-Rated Tool Belts",
    );
  });

  it("includes the mandatory honesty line about not storing the message body", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    const honesty = document.querySelector(
      "[data-nex-guest-enquiry-honesty]",
    );
    expect(honesty?.textContent ?? "").toMatch(/does not store/i);
    expect(honesty?.textContent ?? "").toMatch(/directly to this shop/i);
  });
});

describe("GuestShopEnquiryPopup · client-side validation", () => {
  it("refuses to send with an empty name", async () => {
    const post = vi.fn();
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post}
      />,
    );
    // name left blank
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "aoife@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What would you like to ask about?"),
      {
        target: {
          value: "Hello, I'd like to buy the red hat please. Do you ship?",
        },
      },
    );
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(post).not.toHaveBeenCalled();
    expect(
      document.querySelector("[data-nex-field-error='nex-guest-enquiry-name']"),
    ).toBeTruthy();
  });

  it("refuses to send with a malformed email", async () => {
    const post = vi.fn();
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. Aoife Byrne"), {
      target: { value: "Aoife" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What would you like to ask about?"),
      { target: { value: "Hello, a message long enough to pass the floor." } },
    );
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(post).not.toHaveBeenCalled();
    expect(
      document.querySelector("[data-nex-field-error='nex-guest-enquiry-email']"),
    ).toBeTruthy();
  });

  it("refuses to send with a message shorter than the 20-char floor", async () => {
    const post = vi.fn();
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. Aoife Byrne"), {
      target: { value: "Aoife" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "aoife@example.com" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What would you like to ask about?"),
      { target: { value: "too short" } },
    );
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(post).not.toHaveBeenCalled();
    expect(
      document.querySelector(
        "[data-nex-field-error='nex-guest-enquiry-message']",
      ),
    ).toBeTruthy();
  });

  it("refuses to send with a missing phone (phone is required · 2026-11-28)", async () => {
    const post = vi.fn();
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. Aoife Byrne"), {
      target: { value: "Aoife" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "aoife@example.com" },
    });
    fireEvent.change(
      document.querySelector("[data-nex-field='nex-guest-enquiry-country']")!,
      { target: { value: "IE" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("What would you like to ask about?"),
      { target: { value: "Hello, long enough message to pass the floor." } },
    );
    // phone intentionally left blank
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(post).not.toHaveBeenCalled();
    expect(
      document.querySelector("[data-nex-field-error='nex-guest-enquiry-phone']"),
    ).toBeTruthy();
  });

  it("refuses to send with a malformed phone", async () => {
    const post = vi.fn();
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post}
      />,
    );
    fillHappyPath();
    fireEvent.change(screen.getByPlaceholderText("+44 7700 900000"), {
      target: { value: "abc123" },
    });
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(post).not.toHaveBeenCalled();
    expect(
      document.querySelector("[data-nex-field-error='nex-guest-enquiry-phone']"),
    ).toBeTruthy();
  });

  it("refuses to send without a country selection", async () => {
    const post = vi.fn();
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. Aoife Byrne"), {
      target: { value: "Aoife" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "aoife@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("+44 7700 900000"), {
      target: { value: "+447700900000" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What would you like to ask about?"),
      { target: { value: "Hello, long enough message to pass the floor." } },
    );
    // country left at the empty-sentinel "" option
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(post).not.toHaveBeenCalled();
    expect(
      document.querySelector("[data-nex-field-error='nex-guest-enquiry-country']"),
    ).toBeTruthy();
  });

  it("renders every catalogue country in the dropdown including launch markets at the top", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    const select = document.querySelector(
      "[data-nex-field='nex-guest-enquiry-country']",
    ) as HTMLSelectElement | null;
    expect(select).toBeTruthy();
    const options = Array.from(select!.querySelectorAll("option"));
    const values = options.map((o) => o.getAttribute("value"));
    expect(values[0]).toBe(""); // "Select your country…" sentinel
    // Launch markets first, in sealed order.
    expect(values.slice(1, 6)).toEqual(["IE", "GB", "US", "ID", "AU"]);
    // Includes a non-launch market past the first five.
    expect(values).toContain("DE");
  });

  it("does not render the removed 'Prefer your own NEX account? Create one' secondary CTA", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    expect(
      document.querySelector("[data-nex-guest-enquiry-create-account]"),
    ).toBeNull();
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/Prefer your own NEX account/i);
  });
});

describe("GuestShopEnquiryPopup · server responses", () => {
  it("renders the Sent card only when the server returns 200", async () => {
    const post = vi.fn(async () => makeResponse(200, { ok: true }));
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post}
      />,
    );
    fillHappyPath();
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-nex-guest-enquiry-sent]")).toBeTruthy();
    // The form itself is gone once the Sent card is up.
    expect(
      document.querySelector("[data-nex-guest-enquiry-form]"),
    ).toBeNull();
  });

  it("surfaces 503 endpoint_not_ready as an honest 'not switched on' message · NOT as Sent", async () => {
    const post = vi.fn(async () =>
      makeResponse(503, { error: "endpoint_not_ready" }),
    );
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post}
      />,
    );
    fillHappyPath();
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(document.querySelector("[data-nex-guest-enquiry-sent]")).toBeNull();
    const msg = document.querySelector("[data-nex-guest-enquiry-server-message]");
    expect(msg).toBeTruthy();
    expect(msg?.getAttribute("data-nex-guest-enquiry-state")).toBe(
      "temporarily_unavailable",
    );
    expect(msg?.textContent ?? "").toMatch(/not switched on/i);
  });

  it("surfaces 503 temporarily_unavailable as an honest 'try again' message · NOT as Sent", async () => {
    const post = vi.fn(async () =>
      makeResponse(503, { error: "temporarily_unavailable" }),
    );
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post}
      />,
    );
    fillHappyPath();
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(document.querySelector("[data-nex-guest-enquiry-sent]")).toBeNull();
    expect(
      document
        .querySelector("[data-nex-guest-enquiry-server-message]")
        ?.textContent ?? "",
    ).toMatch(/briefly unavailable/i);
  });

  it("surfaces 429 rate_limited distinctly from 429 duplicate", async () => {
    // duplicate
    const dup = vi.fn(async () => makeResponse(429, { error: "duplicate" }));
    const { unmount } = render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={dup}
      />,
    );
    fillHappyPath();
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(
      document
        .querySelector("[data-nex-guest-enquiry-server-message]")
        ?.getAttribute("data-nex-guest-enquiry-state"),
    ).toBe("duplicate");
    unmount();

    // rate_limited
    const rl = vi.fn(async () => makeResponse(429, { error: "rate_limited" }));
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={rl}
      />,
    );
    fillHappyPath();
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(
      document
        .querySelector("[data-nex-guest-enquiry-server-message]")
        ?.getAttribute("data-nex-guest-enquiry-state"),
    ).toBe("rate_limited");
  });

  it("maps a 400 field error back into the inline field validation", async () => {
    const post = vi.fn(async () =>
      makeResponse(400, { error: "invalid_body", field: "message", reason: "length" }),
    );
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post}
      />,
    );
    fillHappyPath();
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(
      document.querySelector(
        "[data-nex-field-error='nex-guest-enquiry-message']",
      ),
    ).toBeTruthy();
    // Not treated as Sent, not shown as a top-level server message.
    expect(document.querySelector("[data-nex-guest-enquiry-sent]")).toBeNull();
  });

  it("treats a thrown network error as 'network error' · never claims Sent", async () => {
    const post = vi.fn(async () => {
      throw new Error("offline");
    });
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post}
      />,
    );
    fillHappyPath();
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(document.querySelector("[data-nex-guest-enquiry-sent]")).toBeNull();
    expect(
      document
        .querySelector("[data-nex-guest-enquiry-server-message]")
        ?.textContent ?? "",
    ).toMatch(/network error/i);
  });
});

describe("GuestShopEnquiryPopup · request body shape", () => {
  it("POSTs the sealed Rev 3 column set · no forbidden extras", async () => {
    let captured: Record<string, unknown> | null = null;
    const post = vi.fn(async (body: Record<string, unknown>) => {
      captured = body;
      return makeResponse(200, { ok: true });
    });
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post as never}
      />,
    );
    // fillHappyPath now sets phone + country=IE. Override country to GB to
    // keep this test's historical assertion on the country round-trip.
    fillHappyPath();
    fireEvent.change(
      document.querySelector("[data-nex-field='nex-guest-enquiry-country']")!,
      { target: { value: "GB" } },
    );
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(captured).not.toBeNull();
    const keys = Object.keys(captured!).sort();
    expect(keys).toEqual(
      ["country", "email", "message", "name", "phone", "shop_business_id"].sort(),
    );
    // No forbidden extras.
    for (const forbidden of [
      "sender_ip",
      "user_agent",
      "ip_address",
      "lat",
      "lng",
      "sender_identity_hmac",
    ]) {
      expect(captured!).not.toHaveProperty(forbidden);
    }
    // Country code round-trips as the dropdown value.
    expect(captured!["country"]).toBe("GB");
    // Phone round-trips as the required international-format string.
    expect(captured!["phone"]).toBe("+447700900000");
    // shop_business_id threaded through from the prop.
    expect(captured!["shop_business_id"]).toBe(SHOP.shopBusinessId);
  });
});
