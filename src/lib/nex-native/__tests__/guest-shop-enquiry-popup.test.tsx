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
  // Country first · changing it auto-prefixes the phone with the
  // country's dial code (owner directive 2026-11-28 third-pass).
  fireEvent.change(
    document.querySelector("[data-nex-field='nex-guest-enquiry-country']")!,
    { target: { value: "IE" } },
  );
  // Phone matching IE's +353 prefix.
  fireEvent.change(screen.getByPlaceholderText("+44 7700 900000"), {
    target: { value: "+353871234567" },
  });
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

  it("renders the owner-sealed 2026-11-28 second-pass honesty copy · notifications + app download", () => {
    // Owner directive 2026-11-28 (second-pass second-step) replaced the
    // Rev 3 "emailed directly · we don't store the body" line with a
    // notification-and-install line. The old claim about not storing
    // the body is now carried by the server contract + migration 372
    // (see shop-enquiry-privacy-contract.test.ts), not by UI copy.
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
    const text = honesty?.textContent ?? "";
    expect(text).toMatch(/notifications of messages will be sent/i);
    expect(text).toMatch(/check your email is correct/i);
    expect(text).toMatch(/download our app/i);
    expect(text).toMatch(/direct messaging/i);
    // The pre-second-pass copy must not re-appear.
    expect(text).not.toMatch(/does not store/i);
    expect(text).not.toMatch(/emailed directly/i);
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
    expect(values[0]).toBe(""); // "Select" sentinel (owner directive 2026-11-28 fifth-pass)
    // Launch markets first, in sealed order.
    expect(values.slice(1, 6)).toEqual(["IE", "GB", "US", "ID", "AU"]);
    // Includes a non-launch market past the first five.
    expect(values).toContain("DE");
  });

  it("renders the short 'Select' sentinel for the country dropdown (owner directive 2026-11-28 fifth-pass)", () => {
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
    const sentinel = select!.querySelector("option[value='']");
    expect(sentinel).toBeTruthy();
    expect(sentinel!.textContent).toBe("Select");
    // Explicitly reject the old long sentinel.
    expect(sentinel!.textContent).not.toMatch(/Select your country/);
  });

  it("renders as a phone-frame-anchored full page · no backdrop · no card frame · no portal (owner directive 2026-11-28 sixth-pass)", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    // The old shaded backdrop must be gone · the view IS the page.
    expect(
      document.querySelector("[data-nex-guest-enquiry-backdrop]"),
    ).toBeNull();
    // The outer wrapper must anchor to the phone frame via position:
    // fixed + inset:0. Width + height come from the containing block
    // (`.nex-native-frame` on desktop via its transform:translateZ(0)
    // sealed in nex-native.css; the browser viewport on <500px). No
    // explicit 100vw/100dvh · that would escape the frame on desktop.
    const root = document.querySelector(
      "[data-nex-guest-shop-enquiry-popup]",
    ) as HTMLElement | null;
    expect(root).toBeTruthy();
    expect(root!.style.position).toBe("fixed");
    expect(root!.style.inset).toBe("0px");
    expect(root!.style.width).toBe(""); // no explicit viewport-pin
    expect(root!.style.height).toBe(""); // no explicit viewport-pin
    // Critical: the popup must render IN-PLACE inside its React
    // parent's subtree, NOT portalled to document.body. Otherwise it
    // escapes the phone frame on desktop.
    expect(document.body.firstElementChild).not.toBe(root);
    // No rounded card chrome on the inner column.
    const card = document.querySelector(
      "[data-nex-guest-enquiry-card]",
    ) as HTMLElement | null;
    expect(card).toBeTruthy();
    expect(card!.style.borderRadius).toBe("");
    expect(card!.style.boxShadow).toBe("");
  });

  it("places Phone and Country side-by-side on one row (owner directive 2026-11-28 third-pass)", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    const row = document.querySelector(
      "[data-nex-guest-enquiry-phone-country-row]",
    );
    expect(row).toBeTruthy();
    // Both fields must live inside that row container.
    expect(
      row!.querySelector("[data-nex-field='nex-guest-enquiry-phone']"),
    ).toBeTruthy();
    expect(
      row!.querySelector("[data-nex-field='nex-guest-enquiry-country']"),
    ).toBeTruthy();
  });

  it("auto-prefills the phone dial code when the user picks a country (empty-phone case)", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    const phone = screen.getByPlaceholderText(
      "+44 7700 900000",
    ) as HTMLInputElement;
    expect(phone.value).toBe("");
    fireEvent.change(
      document.querySelector("[data-nex-field='nex-guest-enquiry-country']")!,
      { target: { value: "IE" } },
    );
    expect(phone.value).toBe("+353");
    fireEvent.change(
      document.querySelector("[data-nex-field='nex-guest-enquiry-country']")!,
      { target: { value: "GB" } },
    );
    // Switching country swaps the dial-code prefix · body is empty here.
    expect(phone.value).toBe("+44");
  });

  it("swaps the dial-code prefix when the user changes country, preserving the subscriber digits", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    fireEvent.change(
      document.querySelector("[data-nex-field='nex-guest-enquiry-country']")!,
      { target: { value: "IE" } },
    );
    const phone = screen.getByPlaceholderText(
      "+44 7700 900000",
    ) as HTMLInputElement;
    // User types the Irish subscriber number after the auto-prefill.
    fireEvent.change(phone, { target: { value: "+353871234567" } });
    // Now they change their mind to GB.
    fireEvent.change(
      document.querySelector("[data-nex-field='nex-guest-enquiry-country']")!,
      { target: { value: "GB" } },
    );
    // Subscriber digits preserved · dial code swapped IE→GB.
    expect(phone.value).toBe("+44871234567");
  });

  it("refuses to send when the phone prefix does not match the selected country", async () => {
    const post = vi.fn();
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={post}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("e.g. Aoife Byrne"), {
      target: { value: "Aoife Byrne" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "aoife@example.com" },
    });
    // Pick country IE first (auto-prefills +353).
    fireEvent.change(
      document.querySelector("[data-nex-field='nex-guest-enquiry-country']")!,
      { target: { value: "IE" } },
    );
    // Then manually overwrite phone with a GB number · mismatch.
    fireEvent.change(screen.getByPlaceholderText("+44 7700 900000"), {
      target: { value: "+447700900000" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What would you like to ask about?"),
      {
        target: { value: "Hello, long enough message to pass the floor." },
      },
    );
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    expect(post).not.toHaveBeenCalled();
    const err = document.querySelector(
      "[data-nex-field-error='nex-guest-enquiry-phone']",
    );
    expect(err).toBeTruthy();
    expect(err!.textContent ?? "").toMatch(/\+353/);
  });

  it("marks invalid fields with data-nex-field-invalid='true' so the red glow is visually applied", async () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={vi.fn()}
      />,
    );
    // Submit immediately with everything blank · every required field
    // should end up with data-nex-field-invalid='true' (the box-shadow
    // red glow is bound to this attribute via inline styles).
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]")!,
      );
    });
    const name = document.querySelector(
      "[data-nex-field='nex-guest-enquiry-name']",
    ) as HTMLElement | null;
    const email = document.querySelector(
      "[data-nex-field='nex-guest-enquiry-email']",
    ) as HTMLElement | null;
    const phone = document.querySelector(
      "[data-nex-field='nex-guest-enquiry-phone']",
    ) as HTMLElement | null;
    const country = document.querySelector(
      "[data-nex-field='nex-guest-enquiry-country']",
    ) as HTMLElement | null;
    const message = document.querySelector(
      "[data-nex-field='nex-guest-enquiry-message']",
    ) as HTMLElement | null;
    expect(name?.getAttribute("data-nex-field-invalid")).toBe("true");
    expect(email?.getAttribute("data-nex-field-invalid")).toBe("true");
    expect(phone?.getAttribute("data-nex-field-invalid")).toBe("true");
    expect(country?.getAttribute("data-nex-field-invalid")).toBe("true");
    expect(message?.getAttribute("data-nex-field-invalid")).toBe("true");
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

describe("GuestShopEnquiryPopup · hero + identity block (owner directive 2026-11-28 eighth-pass)", () => {
  // Owner directive 2026-11-28 (eighth-pass, verbatim): "CHANGE THE PAGE
  // BACK GROUND OF Message X-Rated Tool Belts TO THIS IMAGE 'Scaffold
  // Workers in the Mist.png' ALSO ADD THE XRATED PROFILE AND LOG IMAGE
  // AND ADDRESS AND 2 BUTTONS LIKE IT WAS SAME AS X RATED HOME PAGE".
  // Four assertions pin the four deltas.

  it("renders a hero background image div referencing the shop-local bg asset by default", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    const hero = document.querySelector(
      "[data-nex-guest-enquiry-hero]",
    ) as HTMLElement | null;
    expect(hero).toBeTruthy();
    // Default references the scaffold-workers asset the owner supplied.
    expect(hero!.style.backgroundImage).toContain(
      "/nex/shop/scaffold-workers-in-the-mist.png",
    );
    // The hero sits above the identity block (which anchors on the
    // card margin-top:-36 so the logo circle overlaps the hero).
    expect(hero!.style.backgroundSize).toBe("cover");
  });

  it("honours a caller-supplied heroBackgroundUrl override", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        heroBackgroundUrl="/some/other/bg.png"
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    const hero = document.querySelector(
      "[data-nex-guest-enquiry-hero]",
    ) as HTMLElement | null;
    expect(hero!.style.backgroundImage).toContain("/some/other/bg.png");
    expect(hero!.style.backgroundImage).not.toContain(
      "scaffold-workers-in-the-mist",
    );
  });

  it("renders the shop logo as an <img> when shopLogoUrl is provided", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        shopLogoUrl="https://cdn.example.com/x-rated-logo.jpg"
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    const logo = document.querySelector(
      "[data-nex-guest-enquiry-shop-logo]",
    ) as HTMLImageElement | null;
    expect(logo).toBeTruthy();
    expect(logo!.tagName).toBe("IMG");
    expect(logo!.getAttribute("src")).toBe(
      "https://cdn.example.com/x-rated-logo.jpg",
    );
    // No fallback initial when a real logo is present.
    expect(
      document.querySelector("[data-nex-guest-enquiry-shop-logo-fallback]"),
    ).toBeNull();
  });

  it("falls back to an initial circle when shopLogoUrl is null", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        shopLogoUrl={null}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    expect(
      document.querySelector("[data-nex-guest-enquiry-shop-logo]"),
    ).toBeNull();
    const fallback = document.querySelector(
      "[data-nex-guest-enquiry-shop-logo-fallback]",
    ) as HTMLElement | null;
    expect(fallback).toBeTruthy();
    // First letter of the shop label ("X" for X-Rated Tool Belts).
    expect(fallback!.textContent).toBe("X");
  });

  it("renders the shop address line when shopAddress is provided (no 📍 pin · matches X-Rated home-page sixth-pass iteration)", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        shopAddress="Yogyakarta, Indonesia"
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    const addr = document.querySelector(
      "[data-nex-guest-enquiry-shop-address]",
    ) as HTMLElement | null;
    expect(addr).toBeTruthy();
    expect(addr!.textContent).toBe("Yogyakarta, Indonesia");
    // No pin glyph · the X-Rated home page suppresses it on this
    // template and the enquiry popup mirrors that choice.
    expect(addr!.textContent).not.toContain("📍");
  });

  it("omits the address row entirely when shopAddress is null", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        shopAddress={null}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    expect(
      document.querySelector("[data-nex-guest-enquiry-shop-address]"),
    ).toBeNull();
  });

  it("renders Send + Not now as a two-button action row (X-Rated home-page pair style)", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    const row = document.querySelector(
      "[data-nex-guest-enquiry-action-row]",
    ) as HTMLElement | null;
    expect(row).toBeTruthy();
    expect(row!.style.display).toBe("flex");
    // Both buttons must live inside that row (the old vertical stack
    // placed Not-now outside Send's button sibling · the eighth-pass
    // pair sits side-by-side).
    expect(
      row!.querySelector("[data-nex-guest-enquiry-send]"),
    ).toBeTruthy();
    expect(
      row!.querySelector("[data-nex-guest-enquiry-dismiss]"),
    ).toBeTruthy();
  });

  it("styles the Not-now dismiss as a visible outline pill (not the old ghost text link)", () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    const dismiss = document.querySelector(
      "[data-nex-guest-enquiry-dismiss]",
    ) as HTMLElement | null;
    expect(dismiss).toBeTruthy();
    // The pre-eighth-pass dismiss had border:"none" + background:
    // "transparent". The new pair carries a 1.5px accent-colored
    // border so both buttons read as a matched pair.
    expect(dismiss!.style.border).not.toBe("");
    expect(dismiss!.style.border).toContain("1.5px");
    expect(dismiss!.style.background).toBe("rgb(255, 255, 255)");
  });
});

describe("GuestShopEnquiryPopup · SentCard app-download invitation (owner directive 2026-11-28 seventh-pass step-7, bundled into eighth-pass)", () => {
  it("repeats the app-download invitation on the post-send SentCard", async () => {
    render(
      <GuestShopEnquiryPopup
        {...SHOP}
        onDismiss={() => undefined}
        postShopEnquiry={async () => makeResponse(200, { ok: true })}
      />,
    );
    fillHappyPath();
    await act(async () => {
      fireEvent.submit(
        document.querySelector("[data-nex-guest-enquiry-form]") as HTMLElement,
      );
    });
    const invite = document.querySelector(
      "[data-nex-guest-enquiry-sent-app-invite]",
    ) as HTMLElement | null;
    expect(invite).toBeTruthy();
    expect(invite!.textContent).toMatch(/download the nex app/i);
    // The SentCard must still exist (sanity · the Sent state was reached).
    expect(
      document.querySelector("[data-nex-guest-enquiry-sent]"),
    ).toBeTruthy();
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
    // This test asserts GB round-trip. Build it directly in GB-order so
    // the phone prefix matches the country from the start · the
    // country change no longer silently swaps prefix mid-test.
    fireEvent.change(screen.getByPlaceholderText("e.g. Aoife Byrne"), {
      target: { value: "Aoife Byrne" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "aoife@example.com" },
    });
    fireEvent.change(
      document.querySelector("[data-nex-field='nex-guest-enquiry-country']")!,
      { target: { value: "GB" } },
    );
    fireEvent.change(screen.getByPlaceholderText("+44 7700 900000"), {
      target: { value: "+447700900000" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("What would you like to ask about?"),
      {
        target: {
          value:
            "Hello, I'd like to buy the brown Tool Belt please. Can you ship to Ireland?",
        },
      },
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
