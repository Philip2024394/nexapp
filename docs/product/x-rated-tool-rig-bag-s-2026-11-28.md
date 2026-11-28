# X-Rated Tool Belts · Product: Utility Duffel (Small) · 2026-11-28
## Reviewed payload · NOT inserted · awaiting owner ingestion decision

Owner spec: a small Cordura-600 utility duffel, Tool Rig Bag category,
£7.50 GBP. Image supplied. This file is the reviewed payload ready to
go into either the merchant Create Product UI or a one-shot seed
script. No DB writes have happened.

---

## nex_product row (canonical shape · migration 003 + 075)

| Field          | Value                                                                                  | Notes |
| -------------- | -------------------------------------------------------------------------------------- | ----- |
| `business_id`  | *(X-Rated Tool Belts, resolved via slug `x-rated-tool-belts`)*                          | Looked up at insert time, never hard-coded. |
| `name`         | `X-Rated Tool Belts Utility Duffel · Small`                                            | Canonical product name. |
| `description`  | *(see Description block below)*                                                        | Markdown-safe paragraph. |
| `price_pence`  | `750`                                                                                  | £7.50 GBP · stored as bigint minor units per migration 003. |
| `currency`     | `GBP`                                                                                  | ISO-4217 uppercase 3-char. |
| `status`       | `draft`                                                                                | Promote to `live` only after image upload + final review. |

---

## Description (cleaned)

> **Water-resistant Cordura-600D utility duffel built for tool belt rigs and the kit that goes with them.** Compact, durable, and with a dedicated outside pocket for scaffolder's cards or site drawings. Never been easier to carry your tool belt rig neatly stored at the end of the day, or to transport it from one job site to the next.

---

## nex_product.spec (JSONB · migration 075 canonical keys)

```json
{
  "condition": "new",
  "brand": "X-Rated Tool Belts",
  "materials": ["Cordura 600D", "polyester lining"],
  "dimensions": { "w": 30, "h": 20, "d": 12, "unit": "cm" },
  "additional": {
    "water_resistance": "water-resistant",
    "size_label": "S",
    "features": [
      "outside pocket for scaffolder's cards or site drawings",
      "compact for tool belt rigs and tools",
      "transportable between job sites"
    ]
  }
}
```

Flags for your review:

- `size_label` lives under `additional` — if you plan on offering M/L/XL in the same listing, use `nex_product_variant` (migration 035) with `attribute='size'` instead. Current shape treats S as its own standalone listing.
- Materials array uses the Cordura brand name correctly (fixed from original "coldura, condura 600, cordura, polyester"). If you want the polyester line dropped entirely say so.

---

## Category / section placement

The directive says "category: Tool Rig Bag". No category or section by that name exists yet in the catalogue. Two options:

- **(i) New product section** on the X-Rated shop called *Tool Rig Bag* (uses `nex_product_section` from migration 107). Future bag sizes (M, L, XL) would land in the same section.
- **(ii) Existing X-Rated section** — if you already have a bags or storage section, place the duffel there and skip the new section.

Confirm which.

---

## Image

- Source: `C:\Users\Victus\Downloads\Black XRATED BELTS Utility Duffel.png` · 3.3 MB · PNG.
- Destination bucket: product-media (likely `nex-business-product-media` or similar — I will verify the exact bucket name before upload, not guess). Access pattern: public read on live products.
- Upload path: via merchant Create Product UI (drag-and-drop) OR a reviewed one-shot upload step in a seed script.

---

## Ingestion — your call

Pick one:

1. **Merchant UI** — you sign into the sandbox at `/nex-native/manage/products`, use Create Product, paste the fields above, upload the PNG. Zero code from me.
2. **Reviewed seed script** — I write `scripts/seed-x-rated-utility-duffel-s.mjs`. You review, run against sandbox with your service-role key. Still no prod touch from me.
3. **Hold** — leave this payload parked until the X-Rated Chat Checkout plan (separate task, 4 approvals pending) is approved and we batch all X-Rated product additions together.

No DB rows will be created from this doc alone.
