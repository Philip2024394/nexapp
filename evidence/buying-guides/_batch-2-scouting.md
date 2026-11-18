# Batch 2 Buying-Guide Scouting Shortlist

Scouted: 2026-11-17
Branch: release-audit-v1-2026-11-14
Source taxonomy: `src/lib/nex-native/catalogue/departments.ts` (30 depts, ~215 subcats, all `enabled: true`)
Rolex already published (watches). Batch 1 in flight: mobile-phones, laptops, running-shoes, handbags, leather-wallets.

Owner constraint recap:
- Guide only where substantive, observable buyer questions exist AND Google is weak (affiliate listicles dominate, no authoritative buyer-education source).
- Fashion/leather test seller — lean product-quality / construction topics.
- Skip Accommodation/Property (no seller surface yet) and Music/Film (scope conflict).
- No medical advice. No topics pinned to current year's models or pricing.

Scope-check: every slug below maps to a real subcategory in `departments.ts`.

---

## Shortlist (8 picks, prioritised)

| # | Route slug | Parent subcat (slug) | Department | Angle | Buyer-question signal | Why substance (not thin-affiliate) | Overlap / sibling-risk | Icon |
|---|---|---|---|---|---|---|---|---|
| 1 | `leather-belts` | `accessories` | `fashion_clothing` | How to tell a full-grain belt from a bonded/split strip, which buckles fail, and why a £15 belt lasts longer than a £120 one. | Very strong. Reddit r/BuyItForLife + r/goodyearwelt have multi-year threads ("what belt will last forever"); "full grain vs top grain belt" is a well-defined query with poor, listicle-dominated results. | Material science (full-grain vs top-grain vs bonded), stitching (saddle-stitch vs lock-stitch), buckle hardware (solid brass vs pot-metal), tang-hole construction, and vegetable-tanned vs chrome-tanned aging — all evergreen, all observable in photos. | Sibling of leather-wallets — different because belts are load-bearing (buckle/hole stress) and have a distinct construction vocabulary; no cannibalisation. | Package |
| 2 | `leather-jackets` | `mens` | `fashion_clothing` | How to grade a leather jacket: hide type (lamb vs cow vs horsehide), tannage, lining, stitching, and why "genuine leather" is the lowest tier not the highest. | Strong. "Is genuine leather real leather" is one of the most-searched leather questions (StyleForum, r/leathercraft, r/malefashionadvice). Google surface is dominated by brand pages and roundups, little buyer-education. | Horween/Shinki tannery lore, aniline vs pigmented finish, break-in behaviour, how to spot glued seams, repairability, jacket weight (oz). Evergreen criteria, photographable. | Not an overlap with handbags/wallets — wearable construction and fit criteria dominate. | Shirt |
| 3 | `hand-tools-chisels` | `hand_tools` | `tools_diy_construction` | How to buy a bench chisel that holds an edge: steel (O1 vs A2 vs PM-V11), hardness, grind, handle fit, and when a £10 Narex beats a £90 "premium" brand. | Strong and underserved. r/woodworking, r/handtools, and Fine Woodworking forums have deep recurring threads. Google surface is affiliate-mill + Amazon SEO — genuinely weak. | Steel metallurgy is evergreen technical content, tang construction, sharpening geometry, flatness-of-back specs. Observable, measurable. | None. Tools dept is untouched by Batch 1. | Wrench |
| 4 | `power-tool-batteries` | `power_tools` | `tools_diy_construction` | What Ah / voltage / cell chemistry actually mean, why "20V" and "18V" are the same thing, and how to avoid dead-after-two-years battery packs. | Very strong. r/Tools, r/BatteryBrand threads — this is one of the single most-asked DIY questions and Google surface is dominated by brand marketing. | Cell chemistry (21700 vs 18650), BMS behaviour, voltage sag under load, platform lock-in cost, counterfeit detection. Technical, evergreen (chemistry doesn't change yearly). | None. Could tangentially touch Electronics but battery here is tool-specific. | Battery |
| 5 | `leather-boots` | `shoes` | `fashion_clothing` | Welted construction explained: Goodyear vs Blake vs cemented, why resoleability matters, and how to read a boot cross-section. | Very strong. r/goodyearwelt is an entire subreddit about this; "Goodyear welt vs blake stitch" has clear buyer intent. Google surface = brand pages + listicles. | Construction cross-sections, tannery provenance, leather types (chromexcel, horsehide, waxed flesh), outsole options, break-in. Deeply photographable. | Sibling of running-shoes (Batch 1) — completely different because running shoes are performance/biomechanics, leather boots are construction/longevity. No cannibalisation. | Footprints |
| 6 | `mechanical-keyboards` | `computer_accessories` | `electronics_technology` | Switch types (linear/tactile/clicky), hot-swap vs soldered, keycap profiles (Cherry vs OEM vs SA), and why PBT beats ABS. | Strong. r/MechanicalKeyboards is a huge, well-organised community. Google surface has decent coverage but it's fragmented across blogs and brand pages — a consolidated buyer guide is genuinely useful. | Switch spec sheets (actuation force, travel), stabiliser construction, PCB layout, firmware (QMK/VIA). Evergreen (the vocabulary is stable). | Sibling of laptops (Batch 1) — different vertical, no overlap. | Keyboard |
| 7 | `fountain-pens` | `office_stationery` | `books_education_stationery` | Nib material and grind, filling systems (cartridge/converter/piston), ink compatibility, and why a £25 Lamy writes better than a £300 badge pen. | Moderate-to-strong. r/fountainpens, Fountain Pen Network — small but obsessively well-informed audience. Google surface is almost entirely vendor + listicle; no good buyer-ed source. | Nib geometry, tipping material (iridium vs steel), feed design, piston-vs-cartridge mechanics, resin vs celluloid vs ebonite bodies. Measurable, evergreen. | None. | Gift |
| 8 | `cycling-helmets` | `cycling` | `sports_fitness_outdoors` | How safety standards actually compare (MIPS, SPIN, WaveCel), when to replace a helmet, and why price doesn't predict safety. | Strong. Virginia Tech helmet ratings is the canonical third-party source, well-referenced in r/cycling, r/bikecommuting. Google surface is brand pages + listicles. | Independent third-party test data exists (Virginia Tech, Folksam), construction (EPS density, shell type), fit-system engineering. Evergreen safety criteria. | Sibling of running-shoes (both sports) — different subcategory, different buyer concern (safety not biomechanics). | Shield |

---

## Considered and rejected

- **Mattresses** (`bedroom` / `bedding_textiles`) — Google is a nuclear-waste zone of affiliate-mill SEO. Even with a strong angle, breaking through would require perishable price/discount data. Reject.
- **Coffee machines** (`kitchen_appliances`) — fashion/leather test seller unlikely to stock, and affiliate-saturated. Reject.
- **Hair tools / stylers** (`haircare`) — Dyson-dominated vertical, perishable model-year comparisons, affiliate-mill-dominated. Reject.
- **Best laptops / best phones roundup clones** — scope conflict with Batch 1 anyway. Reject.
- **Small animals** (`small_animals`, pets) — low buyer-question substance; welfare content risks veering into veterinary advice. Reject.
- **Vitamins & supplements** (`vitamins_supplements`) — borders on medical advice; owner rule excludes. Reject.
- **Solar panels** (`solar_energy`) — substance exists but tightly tied to current incentive schemes and installer pricing; perishable. Reject.
- **TVs** (`tv_entertainment`) — affiliate-mill-saturated + perishable (panel generations change yearly). Reject for Batch 2; could revisit with a specs-only angle later.
- **Cameras** (`cameras_photography`) — DPReview/B&H already own the authoritative buyer-education surface; Nex would be a thin latecomer. Reject.
- **Running watches / smartwatches** (`watches` / `health_monitoring`) — overlaps uncomfortably with published Rolex (watches) route and perishable to model-years. Reject.
- **Fragrances** (`fragrances`) — community-driven (r/fragrance) but buyer questions are subjective (scent preference), hard to write evergreen criteria-based guide. Reject.
- **Electric bikes** (`cycling` / `electric_vehicles`) — strong substance BUT heavily tied to current battery tech / local regulations / price — perishable. Reject for Batch 2.
- **Fishing rods / reels** (`fishing`) — strong hobbyist substance, but very narrow audience; defer unless seller signal emerges.
- **Baby car seats** (`travel_safety`) — substance exists but strays into safety-liability territory that needs legal review. Reject for now.
- **Musical instruments / guitars** (`musical_instruments`) — adjacent to Music/Film scope-removal tension; defer for owner clarification rather than risk scope conflict.
- **Cookware** (`cookware`) — tempting (clad construction, carbon-vs-cast-iron) but Serious Eats / America's Test Kitchen own this surface authoritatively; Nex would be a thin latecomer. Reject.
- **Second-hand phones** (`pre_owned_phones`) — overlaps directly with Batch 1 mobile-phones. Reject.

---

## Notes to the publishing agent

- The three leather-adjacent picks (belts, jackets, boots) match the owner's fashion/leather test seller. If forced to drop one for load-balancing, drop **leather-jackets** (highest construction-detail cost) rather than belts or boots.
- Picks 3 and 4 (chisels, power-tool batteries) are the strongest "Google is genuinely weak" picks — the highest marginal value from a well-cited Nex guide.
- Pick 7 (fountain pens) is the smallest audience but highest "no good source exists" score. Treat as optional stretch.
