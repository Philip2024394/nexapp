// src/components/nex-native/directory/__tests__/listing-card.test.tsx
//
// Phase A regression · the shared `ListingCard` primitive must:
//   · render required fields (title + href + category footer)
//   · render optional fields when present (image · description · city ·
//     discountLabel · priceNow · priceWas)
//   · render honest no-image monogram when imageUrl is null
//   · NEVER render fabricated / hardcoded price / discount / rating
//     literals · all monetary strings come from the view model
//   · tag the source correctly (Owner / Directory badge)
//   · always render the horizontal divider + colored category row

import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingCard } from "../listing-card";
import type { ListingCardViewModel } from "@/lib/nex-native/directory/landing-feed-service";

afterEach(() => {});

function vm(partial: Partial<ListingCardViewModel> = {}): ListingCardViewModel {
  return {
    id: partial.id ?? "id-1",
    slug: partial.slug ?? "slug-1",
    title: partial.title ?? "Acme Bakery",
    categoryLabel: partial.categoryLabel ?? "Food",
    categoryId: partial.categoryId ?? "bakery",
    categoryAccent: partial.categoryAccent ?? "#4DD17A",
    categoryIconCol: partial.categoryIconCol ?? 3,
    categoryIconRow: partial.categoryIconRow ?? 0,
    imageUrl: partial.imageUrl ?? null,
    description: partial.description ?? null,
    featuredOffering: partial.featuredOffering ?? null,
    city: partial.city ?? null,
    href: partial.href ?? "/nex-native/slug-1",
    source: partial.source ?? "nex_business",
    priceNow: partial.priceNow ?? null,
    priceWas: partial.priceWas ?? null,
    discountLabel: partial.discountLabel ?? null,
    priceAmountMinor: partial.priceAmountMinor ?? null,
    priceCurrency: partial.priceCurrency ?? null,
    sellerCountryIso: partial.sellerCountryIso ?? null,
    buyerLocalPrice: partial.buyerLocalPrice ?? null,
    marketScope: partial.marketScope ?? null,
  };
}

describe("ListingCard · required field rendering", () => {
  it("renders the title", () => {
    const html = renderToStaticMarkup(<ListingCard listing={vm({ title: "Hello" })} />);
    expect(html).toContain("Hello");
  });

  it("renders the href", () => {
    const html = renderToStaticMarkup(<ListingCard listing={vm({ href: "/nex-native/foo" })} />);
    expect(html).toContain("/nex-native/foo");
  });

  it("real-source listings render NO Owner / Directory chip (owner directive 2026-10-16 · redundant to visitors)", () => {
    const owner = renderToStaticMarkup(<ListingCard listing={vm({ source: "nex_business" })} />);
    const canon = renderToStaticMarkup(<ListingCard listing={vm({ source: "canonical" })} />);
    expect(owner).not.toContain("Owner");
    expect(canon).not.toContain("Directory");
  });

  it("mock_seed listings STILL render the SAMPLE chip (honest-labelling of preview data)", () => {
    const mock = renderToStaticMarkup(<ListingCard listing={vm({ source: "mock_seed" })} />);
    expect(mock).toContain("SAMPLE");
  });

  // Owner-approved repair pass 2026-10-16 · mock cards must NOT be
  // clickable links. The previous behaviour routed them to
  // `/nex-native/directory` as if they were real detail pages, which
  // read as a broken navigation to visitors.
  it("mock_seed listings render as a non-interactive <article>, NOT a <Link>", () => {
    const mock = renderToStaticMarkup(
      <ListingCard listing={vm({ source: "mock_seed", href: "/anywhere" })} />,
    );
    // Must NOT contain an anchor whose href points to the mock's
    // placeholder destination · the mock's href slot is now ignored.
    expect(mock).not.toMatch(/<a[^>]*href="\/anywhere"/);
    // Must render as an <article> with aria-disabled="true" so AT
    // reports the card as non-interactive.
    expect(mock).toMatch(/<article[^>]*aria-disabled="true"/);
  });

  it("mock_seed cards expose aria-label flagging them as SAMPLE previews", () => {
    const mock = renderToStaticMarkup(
      <ListingCard
        listing={vm({ source: "mock_seed", title: "Preview Beans" })}
      />,
    );
    expect(mock).toMatch(/aria-label="Preview Beans — SAMPLE preview, not clickable"/);
  });

  it("real listings (nex_business / canonical) STILL render as navigable <Link>", () => {
    const real = renderToStaticMarkup(
      <ListingCard
        listing={vm({ source: "nex_business", href: "/nex-native/real" })}
      />,
    );
    expect(real).toMatch(/<a[^>]*href="\/nex-native\/real"/);
    // And must not accidentally pick up the SAMPLE aria-label.
    expect(real).not.toMatch(/aria-disabled="true"/);
  });

  it("canonical listings STILL render as navigable <Link>", () => {
    const canon = renderToStaticMarkup(
      <ListingCard
        listing={vm({ source: "canonical", href: "/nex-native/canon-biz" })}
      />,
    );
    expect(canon).toMatch(/<a[^>]*href="\/nex-native\/canon-biz"/);
    expect(canon).not.toMatch(/aria-disabled="true"/);
  });

  it("ALWAYS renders the category footer (divider + icon + label + chevron)", () => {
    const html = renderToStaticMarkup(<ListingCard listing={vm()} />);
    // Divider: border-top on the footer div. Serialised style string
    // contains the border declaration.
    expect(html).toMatch(/border-top:\s*1px solid/);
    // Chevron
    expect(html).toContain("›");
    // Icon · the sprite URL
    expect(html).toContain("/nex-directory/icons/category-grid.png");
    // Label
    expect(html).toContain("Food");
  });

  it("category label text picks up the categoryAccent colour", () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={vm({ categoryAccent: "#FF8A2A", categoryLabel: "Products" })} />,
    );
    // The accent appears as both the colour on the label and the glow
    // on the icon's filter.
    expect(html).toContain("#FF8A2A");
    expect(html).toContain("Products");
  });

  it("category icon uses the correct sprite coordinates", () => {
    // col=2, row=0 → (2*100)/3 = 66.666...% × 1 row 0 → 0%
    // JS floating-point may render as 66.66666666666667% so we match
    // tolerantly.
    const html = renderToStaticMarkup(
      <ListingCard listing={vm({ categoryIconCol: 2, categoryIconRow: 0 })} />,
    );
    expect(html).toMatch(/background-position:\s*66\.6\d*%\s*0%/);
  });
});

describe("ListingCard · optional field rendering (present)", () => {
  it("renders an <img> when imageUrl is a non-null string", () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={vm({ imageUrl: "https://cdn/x.png" })} />,
    );
    expect(html).toContain("https://cdn/x.png");
    expect(html).toContain("<img");
  });

  it("renders the description when present", () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={vm({ description: "Fresh bread daily." })} />,
    );
    expect(html).toContain("Fresh bread daily.");
  });

  it("renders the city when present", () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={vm({ city: "Ubud" })} />,
    );
    expect(html).toContain("Ubud");
  });

  it("owner directive 2026-10-16 · discount badge is REMOVED from this card flow even when discountLabel is set", () => {
    const withBadge = renderToStaticMarkup(
      <ListingCard listing={vm({ discountLabel: "-40%" })} />,
    );
    expect(withBadge).not.toContain("-40%");
    expect(withBadge).not.toMatch(/-\d{1,2}%/);
  });

  it("renders the price row ONLY when priceNow is present", () => {
    const withPrice = renderToStaticMarkup(
      <ListingCard listing={vm({ priceNow: "$59.99" })} />,
    );
    expect(withPrice).toContain("$59.99");
    const withoutPrice = renderToStaticMarkup(<ListingCard listing={vm()} />);
    expect(withoutPrice).not.toContain("$");
  });

  it("owner directive 2026-10-16 · strikethrough priceWas is REMOVED even when supplied", () => {
    const both = renderToStaticMarkup(
      <ListingCard listing={vm({ priceNow: "$59.99", priceWas: "$99.99" })} />,
    );
    expect(both).toContain("$59.99");
    // The old was-price must NOT render anywhere.
    expect(both).not.toContain("$99.99");
    expect(both).not.toMatch(/text-decoration:\s*line-through/i);
  });
});

describe("ListingCard · honest no-image fallback", () => {
  it("renders monogram (first letter uppercase) when imageUrl is null", () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={vm({ title: "zebra", imageUrl: null })} />,
    );
    expect(html).toContain(">Z<");
    expect(html).not.toContain("<img");
  });

  it("falls back to '·' when title is empty / whitespace", () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={vm({ title: "   ", imageUrl: null })} />,
    );
    expect(html).toContain("·");
  });
});

describe("ListingCard · fabrication guard (owner rule #6)", () => {
  it("renders no $ sign, no %, no 'rating' text when the view model carries none", () => {
    const html = renderToStaticMarkup(
      <ListingCard
        listing={vm({
          title: "Clean Shop",
          description: "A nice place",
          city: "Bali",
        })}
      />,
    );
    expect(html).not.toContain("$");
    expect(html).not.toMatch(/\brating\b/i);
    expect(html).not.toMatch(/-\d{1,2}%/);
  });

  it("component source contains NO hardcoded price / discount / rating LITERALS (comments stripped)", async () => {
    // Looser than the Phase A version: the source IS now allowed to
    // mention `priceNow` / `discountLabel` because those are
    // optional view-model fields (never hardcoded values). The guard
    // still catches literal fabricated amounts.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const raw = fs.readFileSync(
      path.join(__dirname, "..", "listing-card.tsx"),
      "utf8",
    );
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    // No literal $NN or $NN.NN strings in the SOURCE.
    expect(src).not.toMatch(/"\$\d/);
    expect(src).not.toMatch(/\$\d{1,3}(\.\d{2})?/);
    // No literal -NN% strings.
    expect(src).not.toMatch(/-\d{1,2}%/);
    // No rating / star primitives.
    expect(src).not.toMatch(/\brating\b/i);
    expect(src).not.toMatch(/\bstars?\b/i);
    // No hardcoded "Premium" / "Luxury" / "Gourmet" product-name
    // literals the Phase A hardcoded DEALS array used.
    expect(src).not.toContain("Premium");
    expect(src).not.toContain("Luxury");
    expect(src).not.toContain("Gourmet");
  });
});

describe("ListingCard · size prop", () => {
  it("accepts 'compact' and 'grid' without throwing", () => {
    renderToStaticMarkup(<ListingCard listing={vm()} size="compact" />);
    renderToStaticMarkup(<ListingCard listing={vm()} size="grid" />);
  });
});

// ─── Phase A price-row patch · owner directive 2026-10-16 ──────────

describe("ListingCard · price row · owner directive 2026-10-16", () => {
  it("priceWas is NEVER rendered (strikethrough was-price removed)", () => {
    const html = renderToStaticMarkup(
      <ListingCard
        listing={vm({ priceNow: "$59.99", priceWas: "$99.99" })}
      />,
    );
    expect(html).toContain("$59.99");
    expect(html).not.toContain("$99.99");
    expect(html).not.toMatch(/text-decoration:\s*line-through/i);
  });

  it("discountLabel is NEVER rendered (orange discount pill removed)", () => {
    const html = renderToStaticMarkup(
      <ListingCard
        listing={vm({ priceNow: "$59.99", discountLabel: "-40%" })}
      />,
    );
    expect(html).not.toContain("-40%");
  });

  it("sellerCountryIso valid → the country flag badge renders beside the price", () => {
    const html = renderToStaticMarkup(
      <ListingCard
        listing={vm({ priceNow: "Rp 950,000", sellerCountryIso: "ID" })}
      />,
    );
    expect(html).toContain("Rp 950,000");
    // CountryFlag fallback renders the ISO code as text when
    // flagSrcFor is not supplied · reliable across every browser.
    expect(html).toContain(">ID<");
  });

  it("sellerCountryIso null → flag omitted, price alone", () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={vm({ priceNow: "$12.34", sellerCountryIso: null })} />,
    );
    expect(html).toContain("$12.34");
    expect(html).not.toContain(">GB<");
    expect(html).not.toContain(">ID<");
  });

  it("buyerLocalPrice is NULL in Phase A → NO buyer-currency line renders", () => {
    const html = renderToStaticMarkup(
      <ListingCard
        listing={vm({
          priceNow: "Rp 950,000",
          sellerCountryIso: "ID",
          buyerLocalPrice: null,
        })}
      />,
    );
    // Only one price appears · the authoritative seller line.
    const occurrences = (html.match(/Rp 950,000/g) ?? []).length;
    expect(occurrences).toBe(1);
    expect(html).not.toContain("~Rp");
  });

  it("buyerLocalPrice populated (future Phase 1.5 wire-up) → second line + second flag render", () => {
    const html = renderToStaticMarkup(
      <ListingCard
        listing={vm({
          priceNow: "Rp 950,000",
          sellerCountryIso: "ID",
          buyerLocalPrice: {
            priceDisplay: "~£47.80",
            countryIso: "GB",
            fxUpdatedAt: "2026-10-16T10:00:00Z",
          },
        })}
      />,
    );
    expect(html).toContain("Rp 950,000");
    expect(html).toContain("~£47.80");
    expect(html).toContain(">ID<");
    expect(html).toContain(">GB<");
  });

  it("price row has a data attribute anchor so e2e can target it", () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={vm({ priceNow: "Rp 1,000" })} />,
    );
    expect(html).toContain("data-nex-listing-price-row");
  });
});

describe("ListingCard · alignment · price-row anchored to bottom", () => {
  it("card body contains the middle-spacer div · pins price to the bottom regardless of description/city", () => {
    const html = renderToStaticMarkup(
      <ListingCard
        listing={vm({
          priceNow: "$1",
          description: null,
          city: null,
          sellerCountryIso: null,
        })}
      />,
    );
    // Structural anchor: the middle slot grows via flex:1 so the
    // price-row stays bottom-anchored even when description/city
    // are both absent.
    expect(html).toMatch(/flex:\s*1/);
    expect(html).toContain("data-nex-listing-price-row");
  });
});
