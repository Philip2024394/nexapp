# NEX · Export Maker & B2B Marketplace Research · 2026-10-27

> **Status**: live research only · research-quality report, not a product decision.
>
> **Scope**: evaluate the strategic hypothesis that NEX pivots (while retaining existing functionality) to a connected experience for Indonesian makers / manufacturers / export-capable producers reaching international buyers — "Made for U." applied to custom + wholesale production discovery, video provenance, direct chat, and export trust.
>
> **Not touched by this doc**: application code, DB schemas, migrations, pricing, entitlements, Vault, locked product doctrine, production configuration.
>
> **Dirty tree**: preserved · zero code changes · docs-only addition.
>
> **Agents used**: 3 parallel live-research passes (competitive landscape; seller-side dissatisfaction + WTP; buyer-side + Indonesia opportunity + sizing). Reddit was not directly fetchable; Reddit evidence is routed through outlets that already summarised the threads. All material claims are URL-cited with publication year.

---

## 1 · Executive summary

**The gap NEX would occupy — "mix of Indonesian independent makers AND established manufacturers, live production video + recorded factory tours, direct chat, structured custom/wholesale enquiry, and export trust evidence, all in one coherent surface" — is NOT currently filled by any single competitor.** Alibaba comes closest on B2B (10 of 12 capabilities) but has no indie-maker shape and no Indonesian focus. Faire + Ankorstore occupy the trust-first indie-wholesale space brilliantly (Faire ≈ US$117M ARR 2024, 700K retailers) but ship no live video, no production tours, and have no Indonesia emphasis. TikTok Shop and Shopee Live hit live-commerce + chat strongly but are consumer-facing with no B2B/wholesale primitive, no supplier verification, no MOQ, no export orientation. Qlapa — the direct Indonesian precedent — closed March 2019 after failing to beat Tokopedia/Bukalapak's "burn money" domestic strategy.

**However:** the evidence for the gap is stronger than the evidence that it is sufficiently painful + addressable + commercially large enough to carry a company. The strongest validated positive signal is NOT seller dissatisfaction with Etsy (real but overwhelmingly resolved by close-the-shop or Shopify, not by migrating to a new marketplace). It is the **buyer-side** signal: Faire's growth proves international retailers will pay a platform premium to escape the Alibaba trust problem, and Trade Expo Indonesia 2024 drew **8,042 buyers from 140 countries** and claimed USD 22.73B in MoU-level deal volume — i.e. there is demonstrable international demand for Indonesian product, with persistent trust/communication friction in current channels.

**Realistic Year-1 ceiling** (bottom-up, LOW confidence): 1,000–5,000 paying suppliers × ~US$100/year subscription ≈ US$100k–500k ARR. This is **not** a TikTok-scale consumer business. It is a **vertical B2B trust layer** for a specific country, in the shape of Faire-for-Indonesia with video provenance. Volume is unlikely to come from supplier count; it is more likely to come from eventually competing for a share of the ~US$5-20B/year Indonesian export flow in NEX-fit categories (furniture, handicraft, batik, artisan silver) via subscription + value-added services — a much larger addressable revenue envelope than registration counts suggest, but requires buyer-side traction NEX has not yet proven.

**Our recommendation**: a focused 30-day validation (§12) before any product build. If and only if that validation produces evidence of (a) paying-supplier willingness, (b) buyer-side activation, (c) a defensible wedge not covered by Alibaba+Faire+We-Buy-From-Indonesia, proceed. Otherwise, test alternative framings (notably: wedging into the Faire-adjacent, international-boutique-buyer side with Indonesian-only inventory, rather than competing head-on with Alibaba).

---

## 2 · Competitive landscape · verified feature matrix

Twelve capabilities assessed: (1) product discovery, (2) makers+manufacturers in one feed, (3) wholesale/B2B, (4) custom-manufacturing enquiries, (5) livestream commerce, (6) recorded production video, (7) direct messaging, (8) business verification (beyond reviews), (9) samples/MOQ, (10) export info, (11) persistent supplier business profiles, (12) reviews/dispute/payments/logistics.

V = verified · P = partial · NF = not found · UNKNOWN = unverified.

| Platform | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Alibaba.com | V | P (mfg-dominant) | V | V | V (TradeRoom, factory tours) | V | V | V (Verified Supplier, SGS/TÜV) | V | V | V | V |
| Made-in-China.com | V | NF (mfg only) | V | V | P (semi-monthly live) | V | V | V | V | V | V | V |
| Global Sources | V | NF | V | V | NF (trade shows) | P | V | V (strict audits) | V | V | V | P |
| IndiaMART | V | P | V | V | NF | P | V | V | V | P | V | P |
| Faire | V | P (indie brands) | V | NF | NF | P (static YouTube on brand pages) | V | P (curation) | P (brand-MOQ) | P | V | V (Net-60, returns) |
| Ankorstore | V | P | V | NF | NF | P (brand video 2026) | V | P | P | P (EU) | V | V (BNPL 60/90) |
| Etsy | V | NF (handmade only) | NF | P | NF | NF | V | P | NF | NF | V | V |
| Amazon Handmade | V | NF (≤20 staff) | NF | P | NF | NF | V | V (approval app) | NF | P | V | V |
| TikTok Shop | V | NF (resellers) | NF | NF | V | V | V | P | NF | NF | P | V |
| Shopee Live (ID) | V | NF | NF | NF | V (Live Studio 2026) | V | V | P | NF | NF | V | V |
| Tokopedia | V | P | P | NF | V (post-TikTok merger) | V | V | P | NF | NF | V | V |
| Blibli | V | P | V (Blibli Business) | NF | NF | NF | V | V | P | NF | V | V |
| Whatnot / Popshop / NTWRK | V | NF (collectibles / drops) | NF | NF | V | NF | V | P | NF | NF | V | V |
| Not On The High Street / The Grommet / UncommonGoods / Minted | V | V (indie / artist curated) | NF | P | NF | P | P | V (curated) | NF | NF | V | V |
| Instagram / FB Shops | V | P | NF | NF | V (Live Shopping) | V | V (DMs) | NF | NF | NF | P | P |
| We Buy From Indonesia (Kadin, Aug 2026) | P | V (ID exporters) | V | UNKNOWN | NF | UNKNOWN | UNKNOWN | V (gov-backed) | UNKNOWN | V | P | NF |
| Marketplace Profile (2026, new) | V | V | V | V | P | V (centrepiece) | V | P | V | V | V | UNKNOWN |

**Closest competitors to NEX's described concept**:

- **Alibaba.com** · ≈10/12 · 2026 added TradeRoom (live haggling → chat-to-order), integrated factory-video audits, 3rd-party inspections at checkout. **Falls short**: structurally manufacturer-first (no indie-maker identity), industrial UX, no Indonesian focus, livestream is bolt-on not primary surface.
- **Faire + Ankorstore (as category)** · ≈7/12 · Faire 100K brands + ~700K retailers, Net-60 payment terms, AR/returns. Ankorstore dropped reorder commission to 0% Jan 2026, added fintech (Aria BNPL). **Falls short**: no live video, no production-process video, no custom-manufacturing enquiry, no Indonesia specialism, no mfg-tier suppliers.
- **TikTok Shop / Shopee Live** · ≈6/12 but excel at 5+6+7. Shopee Live conversion ~3× regular listings; Shopee Live Studio launched 2026. **Falls short**: no B2B/wholesale shape, no verification depth, no MOQ/custom, no export orientation, every live is ephemeral content vs durable supplier profile.

**Platform-specific 2024–2026 context**:
- **Qlapa** (Indonesian handmade marketplace) · shut down March 2 2019 after "could not turn into a profitable, sustainable business" vs Tokopedia/Bukalapak domestic burn-money competition. Direct precedent for the NEX concept, failed.
- **Tokopedia × TikTok Shop merger** (Indonesia, 2026) · 64.3M monthly visits March 2026 · "Fashion Playground" live events · Rest of World (2025-07-14) documented thousands of sellers migrating to zero-fee Toco after 50%+ revenue drops.
- **TikTok Shop US** · 25 Feb 2026 discontinued seller-shipping; all orders must use TikTok Fulfilment (Fulfilled by TikTok / Upgraded TikTok Shipping / Collections by TikTok) — meaningful friction for independent US makers.
- **Ankorstore** · zero reorder commission (Jan 2026), subscription (Plus) + fintech (Aria) pivot, brand YouTube video (Apr 2026).
- **Alibaba.com** · 81% of buyers reportedly use AI supplier-verification tools (Alibaba self-reported); TradeRoom + inspection integration released 2025-26.
- **Minted** · 5th Independent Artist Day (Apr 2026); AI customisation that still pays original artist royalties.
- **Kadin "We Buy From Indonesia"** (Aug 2026) · government-backed; trilingual ID/EN/ZH; targets ~US$240B non-core export sector. Trade-data mapping tool, not live commerce. **This is NEX's most strategically important adjacent entrant**: if Kadin owns the "official" Indonesian-export discovery narrative, NEX must differentiate on video + indie-maker + commercial-tool quality.

**Primary sources** (Section 2): seller.alibaba.com/blogs/2026/global/b2b-ecommerce/alibaba-com-global-influence-guide-2026 · smartbuy.alibaba.com/buyingguides/alibaba-video-live · easyimex.com/blog/alibaba-supplier-verification-guide/ · merchtitans.com/blog/faire-wholesale-marketplace-guide · ecommerce-times.com/faire-in-2026-the-wholesale-marketplace-betting-big-on-global-expansion/ · blog.ankorstore.com/ankorstore-product-news-april-2026/ · vinasources.com/blog/alibaba-vs-global-sources-vs-indiamart-vs-made-in-china/ · globalsources.com/knowledge/9-leading-sourcing-platforms-hks/ · gineehub.com/insights/shopee-live-commerce-peluang-2026/ · kr-asia.com/indonesian-online-marketplace-qlapa-shuts-down · en.antaranews.com/news/424989/kadin-launches-export-tech-platform-we-buy-from-indonesia · tradexpoindonesia.com/about/general-information/ · stackinfluence.com/blog/top-live-shopping-platforms-2026-tiktok-amazon · amzbase.com/guides/amazon-handmade-guide/ · nifty.ai/post/etsy-seller-account-requirements · prlog.org/13138923-marketplace-profile-launches-the-worlds-first-video-based-b2b-supplier-directory.html · newbuyingagent.com/resources/live-stream-factory-tours-a-hassle-free-buyer-s-verification-strategy · wholesalefashiontrends.com/blogs/news/how-to-source-products-for-tiktok-live-selling-from-usa-based-wholesale-vendors.

---

## 3 · Does an equivalent all-in-one product already exist?

**No.** No single product combines the twelve capabilities above into one coherent, actively-used offering. The closest is Alibaba on raw feature count, but Alibaba is a manufacturer-first B2B directory with Chinese operational DNA and no indie-maker identity. Faire + Ankorstore solve the trust-first wholesale buyer problem but are retailer-facing West only and offer no live/production-process video. TikTok Shop is pure consumer live commerce with no B2B primitives.

**The honest version of the answer**: NEX's full stack is unoccupied, but each individual capability is widely available on at least one existing platform. The question is whether *integration* alone is a defensible wedge, which the evidence suggests requires an additional country-vertical (Indonesia-specific) or product-vertical (e.g. handicraft+batik+artisan silver, not head-on with Alibaba's furniture/electronics) commitment.

---

## 4 · Etsy / handmade seller dissatisfaction · evidence review

Nine recurring seller problems emerged with multi-source evidence:

- **P1 Fees compounding to 20-25% of revenue** · April 2022 transaction-fee hike (5% → 6.5%) triggered a 14,000+ seller strike (TechCrunch 2022-04-11). Mandatory 15% Offsite Ads (reduces to 12%, not zero). Modern Retail 2024-04-18 and Belleflamme 2024-09-25 converge on 10-25% effective take-rate.
- **P2 Platform-controlled search + sudden visibility collapse** · "Total search invisibility" wave reported Nov 2025 (EcommerceBytes 2025-11-16). Etsy lost ~1.4M active sellers in a year (7M → 5.6M).
- **P3 Mass-produced / dropshipped / AI-generated goods crowding handmade** · CEO Josh Silverman publicly acknowledged "race to the bottom" (Axios 2024-11-15). May 2024 crackdown disabled AutoDS/ShineOn/CJDropshipping API access.
- **P4 Payment reserves / funds held 45-90 days** · UK sellers organised boycott (Quartz 2023); multiple Etsy community threads 2024 ("Etsy Holding my funds $5000 for 5 months now").
- **P5 AI/bot-driven account suspensions** · Support described as "a robot that has no clue what you are typing" (Consumer Affairs 2025).
- **P6 No customer ownership / no mailing list export** · Direct cause of Shopify-ward migration.
- **P7 Faire-specific** · Opaque account closures, 25% reorder commission, slow support (Shopify App Store review 1418807, Trustpilot pages 3-7). Faire overall still 4.5-stars across 12,191 reviews; the complaint-vocal minority is real but is a minority.
- **P8 Alibaba buyer-side** · 2023 China Consumer Association data cited as "42% of cross-border trade disputes = supplier identity fraud" (secondary-cite only, original report not independently retrieved). Verified-Gold Supplier badge is paid, not vetted.
- **P9 Indonesia-specific** · ANTARA 2024 reported only US$58M of US$275M identified export opportunities converted to actual POs. Rest of World 2025-07-14 documented "thousands" of Indonesian sellers moving to zero-fee Toco after TikTok-Tokopedia merger drove 50%+ revenue drops.

**Separation discipline** (based on ~45 evidence items):

| Problem | Dislike-only | Searching | Migrated | Returned | Paying for alt |
|---|---|---|---|---|---|
| P1 Fees | ~55% | ~30% | ~10% (mostly to Shopify) | low signal | ~10% (Shopify $29/mo; Artisans Coop $100+3%) |
| P2 Search collapse | ~65% | ~15% | ~5% | not seen | low signal · more close than migrate |
| P3 Mass-produced | ~75% | ~15% | ~10% | not seen | n/a |
| P4 Reserves | ~45% | ~30% | ~20% (Shopify explicitly cited) | low | ~15% |
| P5 AI suspensions | ~70% | ~15% | ~5-10% (own site) | not seen | n/a |
| P6 No customer ownership | ~30% | ~40% | ~25% (Shopify) | low | ~25% · Shopify at $29/mo |
| P7 Faire | ~70% | ~20% | low (no scale alt) | n/a | n/a |
| P8 Alibaba fraud | ~60% | ~25% | ~10% (direct sourcing / Veri services) | n/a | ~10% |
| P9 Indonesia SME | ~40% | ~40% | ~15% (Toco) | n/a | low signal |

**Hardest honest finding**: evidence for *paying* for an alternative is thinner than evidence for *dislike*. Shopify is the only paid alternative with mass adoption — and it's a site-builder, not a marketplace. Artisans Cooperative (US$100 buy-in + 3% commission, launched Nov 2024), Goimagine (closing 2026), Mayhem, Toco, Depop, Teleport cumulatively absorbed a small fraction of Etsy's 1.4M lost sellers; most appear to have simply closed.

**Etsy's own 2024 subscription survey ($5/$15/$20 tiers)** is the strongest direct signal that Etsy itself believes there is willingness-to-pay headroom. Public reaction was unfavourable.

---

## 5 · Public-forum evidence table (selected rows · full set in agent output appendix below)

| Date | Source URL | Participant | Problem | Actively seeking alt? |
|---|---|---|---|---|
| 2024-04-18 | modernretail.co/.../amazon-ification-of-etsy | sellers Kiara Mendez, Carissa Hawkes, Danna Crawford | Fees + commoditisation | Yes · migrated to Depop/Teleport/Jamble |
| 2024-05-09 | valueaddedresource.net/etsy-dropshipping-crackdown | r/EtsySellers thread | Mass-produced competition | No (celebrating enforcement) |
| 2024-11-15 | axios.com/.../etsy-ceo-gen-ai-drop-shipping | CEO J. Silverman | AI/dropship floods | n/a |
| 2024-05-28 | apps.shopify.com/reviews/1418807 | seller "YOSMO" (NL) | Faire account closed, rude support | Yes · "Avoid at all costs" |
| 2023-07-14 | indiesellersguild.org/etsy-payment-account-reserves | ISG president + "dozens" | Reserves destroying businesses | Yes · explicit alt-platform list |
| 2023 | qz.com/.../etsy-scrambling-avert-seller-strike | UK boycott organisers | Reserves | Yes · "leaving for rival sites like Shopify" |
| 2024 | community.etsy.com/.../147773681 | seller | $5000 held 5 months | Unclear |
| 2025-11-16 | ecommercebytes.com/.../search-invisibility | thousands of sellers | Nov 2025 visibility collapse | Unclear |
| 2025-07-14 | restofworld.org/.../tiktok-indonesia-tokopedia-merger-problems | Dedy, Helmin | 50%+ revenue drop post-merger | Yes · to Toco |
| 2024 | ANTARA via news/436453 | gov source | $58M of $275M identified export opps converted | n/a |
| 2024-11 | retaildive.com/.../artisan-cooperative-marketplace | Artisans Coop members | Seller-owned alternative | Yes · $100 buy-in + 3% |

**Reddit note**: Direct r/EtsySellers / r/Etsy / r/handmade threads could not be fetched by the research tooling (blocked). Evidence is routed through outlets that already summarised these threads (EcommerceBytes, Value Added Resource, Ideafast's 151-post aggregation 2026-07-15). Treat the Reddit-sourced percentages as directionally correct but not independently audited for this report.

---

## 6 · Buyer-side problems · kept separate from seller-side

**Group A · Complaints about current channels (friction, not exit)**:
- **A1 Verified ≠ vetted** · "Gold Supplier means they paid for membership — not that they've been vetted. The blue Verified badge means they paid for a third-party check, but doesn't mean they actually make the products they claim to sell." (jingsourcing.com, chinacompanylookup.com, verisupplier.com · 2024-2026).
- **A2 Payment-rerouting / offshore-wire fraud** · Documented including on "Verified Gold Supplier" accounts (jingsourcing.com, supplyia.com · 2024).
- **A3 Supplier-identity fraud is systemic** · 2023 China Consumer Association data: 42% of cross-border trade disputes = supplier identity fraud (secondary cite via chinacompanylookup.com; original CCA report not independently retrieved — **FLAG**).
- **A4 MOQ mismatch for boutique buyers** · "Retailers expecting to test with 20-30 pieces discover manufacturers require 100+ units per SKU" (mppfurniture.com, yellowbees.com.my · 2024-2026).
- **A5 English/communication gaps** · Indonesia #80/116 on EF English Proficiency Index 2024. "22% of manufacturing companies report lost business due to language barriers" (cosmosourcing.com, 889globalsolutions.com, EF EPI 2024).
- **A6 Lead-time surprises** · Tanjung Priok / Surabaya port congestion adding 2-4 weeks (woodexport.id · 2025).
- **A7 Quality consistency / ESG non-compliance** · <20% of Indonesian manufacturers certified by ISO 14001 or GRI (the-shiv.com, amrepinspect.com · 2025).

**Group B · Buyers actively using a new channel (exit signal)**:
- **B1 Faire's trajectory** · ARR ~US$117.1M 2024 (up from US$69M 2023), 700K retailers across 100+ countries, 100K brands. UK alone: 50K retailers, 400K orders by March 2024. **Proves international retailers will pay a platform premium to escape the Alibaba trust problem.** (getlatka.com, retailtechinnovationhub.com, faire.com newsroom).
- **B2 Trade fairs persist** · Ambiente Frankfurt 2024: 4,500+ exhibitors from 92 countries. Boutique buyers still rely on physical events because online channels haven't solved trust.
- **B3 Trade Expo Indonesia 2024** · 8,042 buyers from 140 countries, 41,488 visitors, 1,460 exhibitors, US$22.73B potential-transaction volume (MoU-level, not confirmed shipments) · jakartaglobe.id, prnewswire.com · Oct 2024.

**Inference (clearly flagged)**: Faire's trajectory proves retailers will pay a platform premium to escape the Alibaba trust problem. NEX plausibly sits in that gap for Indonesia specifically, but no public dataset proves buyers are explicitly "looking for an Indonesian Faire." Trade Expo Indonesia's 8K cross-border buyers is the strongest Indonesian-specific signal that cross-border demand exists.

---

## 7 · The Indonesian export opportunity

**Category readiness matrix** (year labels on each demand figure):

| Category | Demand evidence (year) | Export readiness | Existing competition | NEX fit |
|---|---|---|---|---|
| **Furniture (Jepara / Bali teak, rattan)** | US$2.02B 2024 (BPS, via seller.alibaba.com furniture report); US = 53-60% of destinations | High · mature exporters | Very high (1stdibs, direct importers, Ambiente) | MEDIUM · crowded but trust gap persists |
| **Handicrafts (wood, rattan, home décor)** | US$2.22B furniture+handicraft Jan-Nov 2024 (Xinhua citing MinTrade); Jan-Jul 2025 handicraft = US$253.7M | Mixed · strong supply, weak documentation | Medium · Qlapa failed domestically; international fragmented | **HIGHEST FIT** · strongest cultural moat, lowest competition online |
| **Coffee (specialty, GI-certified)** | US$1.64B 2024 (+76.3% YoY); 54 GI-certified types; specialty global market US$101.6B 2024 | High · often English-fluent | High · specialty coffee channels dense (Sucafina, Royal, Café Imports) | LOW · existing dense channels, likely out of NEX scope |
| **Jewellery / precious metals** | US$5.5B 2024 (+48.1%). Switzerland 41%, Singapore 12%, UAE 10% destinations | Bullion = large-scale refineries; artisan silver = smaller (silver = 1.89% / US$104M 2023) | High for bullion; low for artisan silver (Bali, Yogya) | MEDIUM · artisan silver only |
| **Batik / traditional textiles** | Q2 2024 batik = US$8.33M (-8.29% YoY); full textile/apparel Jan-Nov 2024 = US$10.83B | Mid · 5,946 batik SMIs across 11 provinces (MinIndustry 2024) | Low internationally for authentic batik | **HIGH** · cultural authenticity moat |
| **Leather goods** | No clean 2024 export figure retrieved | Mid | Mid (Vietnam & India dominate SE Asia leather) | LOW-MED |
| **Fashion / Muslim fashion** | Named in UMKM BISA Ekspor 2024-2025 top categories | Mid | Growing but fragmented | MEDIUM |
| **Food / spices / coconut** | Named top; coconut flagged "crisis 2024-2025" | Varied; heavy regulatory load | High | LOW · outside NEX scope |

**Qlapa failure mode is instructive but not deterministic**: Qlapa died competing *domestically* against burn-money players. NEX's hypothesis is *cross-border* — a different competitive landscape. But there is no public precedent of an Indonesia-only cross-border marketplace succeeding at scale, so confidence should remain LOW.

**Headline Indonesian trade statistics** (year + source for every figure):

| Statistic | Value | Year | Source | Flag |
|---|---|---|---|---|
| Indonesia total non-oil & gas exports | US$266.51B | 2025 | antaranews.com/news/436161 | — |
| MSME contribution to GDP | 61% (also 59.64%) | 2024 | antaranews.com/news/307899; databoks | **CONTESTED** both appear |
| MSME contribution to Indonesian exports | 15.7–15.8% | 2024 | jakartaglobe.id, katadata | — |
| Total MSMEs | 56.1M (Sakernas), 65.5M (ANTARA cite), 64.2M (2018) | 2024 | katadata, ANTARA, Jokowi-era | **DISCREPANT** across sources |
| Non-agricultural UMKM | 30.21M | 31 Dec 2025 | ANTARA news/436161 | — |
| TEI 2024 potential transactions | US$22.73B | 2024 | jakartaglobe.id | **WEAK** · MoU-level, not realised |
| TEI 2024 international buyers | 8,042 from 140 countries | 2024 | prnewswire | — |
| EF English Proficiency Index (Indonesia) | Rank 80/116 · 468/700 | 2024 | EF EPI | — |
| ESG certification among IDN manufacturers | <20% ISO 14001 / GRI | 2025 | the-shiv.com | **SINGLE-SOURCE** |

**Known Indonesian-platform history**: Qlapa (closed Mar 2019 · dealstreetasia, kr-asia), Tokopedia / Bukalapak (operating domestic, not export), Indotrading (low-verification B2B directory), TEI (annual event, not persistent marketplace), Alibaba (Indonesian sellers exist but outnumbered by China/Vietnam).

---

## 8 · Business model and willingness-to-pay evidence

**How competitors monetise**:
- **Alibaba** · subscription (Gold Supplier membership) + lead-gen credits + inspection services + advertising. Supplier side pays; buyer side free.
- **Faire** · 25% commission on first orders, 15% on reorders (Shopify-integrated brands drop to 0% reorders in 2026). Retailer side free; brand side pays commission.
- **Ankorstore** · 0% reorder commission (Jan 2026) + "Ankorstore Plus" subscription + Aria fintech (BNPL). Pivoted away from transaction fees.
- **Etsy** · listing fee + 6.5% transaction + 3% payment processing + 15% mandatory Offsite Ads (shops ≥US$10k/yr) + optional advertising + Etsy Plus subscription. Blended effective take 10-25%.
- **TikTok Shop US** · platform commission + mandatory TikTok Fulfilment fees (2026 change).

**Willingness-to-pay evidence specific to NEX's hypothesis**:
- **Shopify** at US$29/month (Basic) · widely adopted by migrating Etsy sellers · demonstrates ~US$350/year/seller tolerance for a non-marketplace tool.
- **Artisans Cooperative** · US$100 buy-in + 3% commission · member-owned alternative launched Nov 2024 (retaildive.com). Small adoption so far but a direct precedent for "sellers will pay a flat annual fee + low commission."
- **Alibaba Gold Supplier** · ~US$2,000-5,000/year subscription for premium verification + lead access. Indonesian presence exists but is small compared to Chinese counterpart.
- **Trade-fair stand costs** · Trade Expo Indonesia booth fees US$2,000-5,000 for a single event. Many Indonesian SMEs already pay this annually.
- **No public primary survey** of "Indonesian makers' willingness to pay US$X/month for a cross-border marketplace with video." This is the most important data gap in the entire research pass and should be filled by direct supplier interviews in Section 12.

**Note on NEX doctrine**: this report explicitly does NOT propose transaction commissions, payment handling, escrow, or changes to locked Vault / entitlement policies. The commercial model that fits NEX's existing doctrine ("NEX never handles payments" · sealed) is **supplier subscription + optional value-added features (enhanced listings, verified-production video badge, priority buyer-match notifications, boost in search)** — mirroring Alibaba's subscription-first B2B model and Ankorstore's 2026 pivot away from transaction take.

---

## 9 · Six-hypothesis assessment

For each hypothesis: supporting evidence · contradictory evidence · quality · confidence · cheapest experiment.

### H1 · Buyers value seeing how products are made and who makes them
- **Supporting**: Alibaba added mandatory factory video audits + live factory feeds 2026 (81% buyer adoption claim, self-reported). TikTok Shop + Shopee Live conversion rates (~3× regular) correlate with video presence. Marketplace Profile launched 2026 as "video-first B2B directory." Pinterest/Instagram "behind-the-scenes" content documented as high-engagement in retail commerce.
- **Contradictory**: Faire and Ankorstore built their businesses WITHOUT live or production video. Written brand stories + photos sufficed. Shopify / brand websites generally don't carry production video. Alibaba's video live is still bolt-on, not primary discovery.
- **Evidence quality**: Medium. Platform behaviour is observable; buyer purchase-decision weight attributable to video specifically is not isolable from public data.
- **Confidence**: Medium-high that video adds value; LOW that it is independently decisive.
- **Cheapest experiment**: A/B landing page with vs. without maker-video embedded; measure sign-up conversion among target international buyers.

### H2 · Integrated journey (discovery → production evidence → chat → enquiry) in one platform is valuable
- **Supporting**: Faire's trajectory demonstrates integrated discovery → wholesale enquiry wins over fragmented buyer workflows. Alibaba's TradeRoom bundles live haggling + chat + order in one surface. Buyers currently cite "discover on TikTok, vet on LinkedIn, close on WhatsApp" as fragmented workflow (looperbuy.com 2026).
- **Contradictory**: Boutique buyers still attend trade fairs (Ambiente 4,500 exhibitors 2024, TEI 8,042 buyers 2024) despite online alternatives — suggesting integration gaps are known but trade fairs retain unique value.
- **Evidence quality**: Medium-high.
- **Confidence**: Medium-high.
- **Cheapest experiment**: 10 supplier + 10 buyer semi-structured interviews. Ask: "If you could do X, Y, Z in one place, would it change which channel you use?" Confirm pain, not solution.

### H3 · Indonesian producers struggle to reach appropriate international buyers through existing channels
- **Supporting**: ANTARA 2024 reports only US$58M of US$275M identified export opportunities converted to actual POs (~21% conversion). <20% ESG certification. English Proficiency Index #80/116. Qlapa failure as evidence that domestic marketplace alone is insufficient. Rest of World 2025-07-14 documented Indonesian seller churn.
- **Contradictory**: Trade Expo Indonesia drew US$22.73B MoU volume in 2024 (even if MoU-level is weak). Alibaba IS available to Indonesian suppliers. Faire has Indonesian brands though small. Government "We Buy From Indonesia" launched Aug 2026 claiming to serve this exact need.
- **Evidence quality**: High for the pain; medium for the attribution of channel inadequacy.
- **Confidence**: HIGH that pain exists; MEDIUM that pain is channel-specific vs. structural (SME capacity).
- **Cheapest experiment**: supplier interviews filtered by export experience; segment "tried → gave up" from "trying now" from "unknown."

### H4 · Suppliers would pay NEX if it generates credible opportunities at acceptable cost
- **Supporting**: Many Indonesian SMEs already pay TEI booth fees (US$2-5K/event). Alibaba Gold Supplier membership (US$2-5K/year) has Indonesian adoption. Artisans Cooperative's US$100+3% model shows pay-for-marketplace exists in indie segment.
- **Contradictory**: Qlapa failed to monetise domestic maker segment. No public survey evidence of specific willingness-to-pay for Indonesian cross-border marketplace. "Would you pay X" responses to prototypes historically overstate real paying behaviour by ~50-70%.
- **Evidence quality**: Low.
- **Confidence**: LOW. This is NEX's biggest validation risk.
- **Cheapest experiment**: landing page offering paid pre-registration at US$50-100 (fully refundable) to measure actual conversion-to-pay. If <2%, concept is at risk.

### H5 · International buyers have a compelling reason to use NEX instead of existing channels
- **Supporting**: Faire's trajectory. Trade Expo Indonesia 8K cross-border buyers. Documented pain with Alibaba trust (A1-A3). Buyer discovery journey already fragmented (looperbuy.com 2026).
- **Contradictory**: Buyers who currently rely on Alibaba+WhatsApp+LinkedIn have learned those tools' limitations and worked around them. Switching costs are high. Faire's example suggests years of effort for traction. Many boutique buyers prefer trade fairs for the IRL trust layer specifically.
- **Evidence quality**: Medium.
- **Confidence**: LOW-MEDIUM.
- **Cheapest experiment**: 10 target-buyer interviews (independent retailers, interior designers, hospitality procurement). Specifically test the "I would use a Indonesia-focused platform with video + chat + verified MOQ" value prop. Must be qualified, not surveyed.

### H6 · NEX could build a defensible advantage that competitors can't easily replicate
- **Supporting**: Country-vertical + indie-maker-identity + production-video + export-trust is structurally unoccupied. Faire would have to add live video + Indonesia; Alibaba would have to add indie-maker identity + Indonesian focus. Both are plausibly years out. Qlapa's death shows the local-domestic version is NOT defensible; cross-border is a different competitive game.
- **Contradictory**: Each individual capability is widely available. Larger platforms (Alibaba, Tokopedia, Kadin's We Buy From Indonesia) could realistically add missing pieces in 12-18 months. First-mover advantage in two-sided marketplaces is historically weak unless network effects accrete fast enough to raise switching costs.
- **Evidence quality**: Medium (based on platform behaviour patterns + current competitor roadmaps).
- **Confidence**: LOW. The gap exists today; the moat is unproven.
- **Cheapest experiment**: not a 30-day experiment · this hypothesis can only be truly tested over 18-24 months of actual market behaviour. In the short term, test whether suppliers' production-video + maker-story content on NEX gets differentially better buyer response than on Alibaba (requires live platform first — chicken-and-egg).

---

## 10 · Market sizing · tiered · transparent

Arithmetic only. All assumptions explicit. All multiplication steps shown.

| Tier | Figure | Filter rationale | Confidence |
|---|---|---|---|
| **T0 Total MSMEs** | 56.1M (Sakernas 2024) · OR 65.5M (ANTARA 2024) | Universe including micro + small + medium, agri + non-agri | HIGH |
| **T1 Non-agricultural UMKM** | 30.21M (31 Dec 2025, ANTARA) | NEX scope is not farming | HIGH |
| **T2 Formal-sector UMKM** | ~9.97M (33% of T1 · ANTARA: 67% operate informally) | Export documentation requires formal registration (NPWP, NIB) | MEDIUM |
| **T3 Export-capable (upper bound)** | ~1.57M (15.8% of T2 · using MSME export-value share as proxy) | **FLAG**: 15.8% is value share, not count share. True count % is almost certainly lower. Use as upper bound only | LOW |
| **T3-alt Export-active (defensible)** | ~500K-1M | Inference anchor: UMKM BISA Ekspor engaged 1,013 SMEs across 501 events Jan-Sep 2025 → curated subset. Batik SMI = 5,946. Jepara furniture estimated 3K-15K. Summed across categories plausibly <1M | LOW · not reliably knowable |
| **T4 Addressable for NEX (export-ready + category-relevant + smartphone-native)** | ~100K-300K | Narrow to furniture + handicraft + batik + artisan silver + fashion. Filter for mobile-first + willing to sell internationally | LOW |
| **T5 Realistic Year-1 paying suppliers** | 1,000-5,000 | Benchmarks: Qlapa reached low-single-digit-thousand sellers at death; Faire added tens of thousands only after US$-tens-of-millions ARR; indie-marketplace cold-starts rarely exceed 5K Y1 | LOW · judgment, not stat |

**Illustrative revenue arithmetic** (DO NOT quote as forecast):
- 100K addressable × 5% adoption × US$100/year subscription = **US$500k/year revenue ceiling** at 5% penetration.
- 100K × 10% × US$100 = **US$1M/year** at 10%.
- 300K × 10% × US$100 = **US$3M/year** at upper-bound adoption.
- Anything beyond requires assumptions this research pass cannot defend from public data.

**Buyer-side TAM is NOT reliably knowable from public sources.** Faire has 700K retailers globally; TEI drew 8K cross-border buyers in 2024. A single-country sell-side marketplace can realistically target thousands, not millions, of recurring international buyers in Year 1.

---

## 11 · Focused launch recommendation

### Most promising initial supplier segment
**Jepara / Bali / Yogya artisans + small manufacturers in Handicraft, Batik, Artisan Silver, and Wood-furniture-for-export categories.** Rationale:
- Cultural authenticity moat (hard for China manufacturers to compete on genuine batik).
- Smaller than furniture-mass-market (less direct Alibaba competition).
- Known demand signal from TEI buyer-interest data.
- Qlapa's failure mode (domestic burn-money war) does not apply to cross-border positioning.
- Existing supplier concentration (Jepara, Bali, Yogya) enables field validation.

### Most promising initial buyer segment
**Independent boutique retailers + interior designers + small hospitality procurement in EU + Australia + Singapore markets.** Rationale:
- Faire's trajectory validates demand for curated indie wholesale among Western boutique retailers (B1 evidence).
- Hospitality procurement in Bali/Southeast Asia is a documented buyer type with Indonesian supply chains.
- EU retailer density (Ankorstore) + buyer sophistication supports MOQ + trust-first positioning.
- Smaller lot sizes acceptable (vs. containers for US large-format retail).
- Avoids head-on competition with Alibaba's US-industrial buyers.

### One or two categories to test first
**(1) Handicraft / home décor** (highest cultural fit + lowest competition) and **(2) Batik / traditional textiles** (highest authentic-provenance moat).

### Minimum NEX experience needed to test
- Supplier profile with 3-5 photos + 1 production video (recorded, not live) + MOQ + lead-time + sample policy.
- Buyer search by category + country + MOQ.
- Direct chat (uses existing NEX chat).
- Enquiry form (sample request / wholesale enquiry / custom order).
- One verified-production-video badge (video shows the supplier making the product).
- Buyer-facing supplier shortlist / saved-list.
- No payments (respects NEX doctrine).
- No live-commerce in V0 (ship later if buyer demand validates).

### Supplier acquisition strategy
- Partner with Dekranas / Dekranasda (crafts councils) + Jepara/Bali furniture associations for a vetted 50-100 supplier seed.
- Trade Expo Indonesia 2027 booth presence (co-brand with Kadin's "We Buy From Indonesia" rather than compete head-on).
- WhatsApp onboarding (highest Indonesian SME channel density).

### Buyer acquisition strategy
- Direct outreach to 500-1000 EU/AU/SG boutique retailers via LinkedIn + email.
- Partnerships with trade fair organisers (TEI, Ambiente) for post-event buyer discovery.
- Content: "How to source from Indonesia · what buyers wish they'd known" guides.
- Pinterest + Instagram organic for cultural-authenticity story.

### Key success metrics (90-day pilot)
- Supplier side: 50-100 verified profiles; ≥60% completing production video within 30 days.
- Buyer side: 200-500 registered buyers; ≥10% initiating at least one enquiry.
- Journey: ≥20 completed enquiries → chat → sample order (even if small).
- Economics: ≥10% of participating suppliers accept a paid listing offer at US$30-100/month.

---

## 12 · 30-day validation plan

**Days 1-7**:
- 10 supplier interviews (semi-structured): current channels, export experience, English level, specific pain, willingness to pay US$X.
- 10 buyer interviews (semi-structured): current Indonesian sourcing experience, specific friction, trust decisions, willingness to use new platform.
- Build landing page with concept + supplier-side + buyer-side CTA.

**Days 8-21**:
- Supplier-side paid pre-registration campaign (US$50 refundable deposit for first-50 "Founding Supplier" slots). Target: 25% conversion among 100 target suppliers.
- Buyer-side waitlist with qualified-buyer form (name, business type, product interest, source countries). Target: 300 qualified buyer signups.
- Deploy 10 "mock" supplier profiles (with real willing suppliers; produce 1 production video each) · measure buyer interest.
- Pinterest/Instagram organic content: "How X is made in Indonesia · supplier story" videos. Measure engagement.

**Days 22-30**:
- Review all evidence against pass/revise/stop criteria below.
- Synthesise findings; present to decision owner.

### Pass/revise/stop criteria
- **PASS and proceed to MVP**: ≥25% paid pre-reg conversion AND ≥50 buyer signups active (chat/email engagement) AND ≥5 completed enquiries from mock supplier profiles.
- **REVISE**: 10-25% conversion, buyer engagement under 50 but non-zero, OR insufficient buyer-side evidence. Revise concept framing or category focus.
- **STOP**: <10% supplier pre-reg conversion OR <20 buyer signups OR zero completed enquiries. Reconsider: alternative framings tested in parallel (hospitality procurement; Faire-for-Indonesia; export-ready supplier directory with no transaction layer).

### Sample size and representativeness
- 10 + 10 interviews is NOT statistically representative. Treat findings as directional only.
- The real sample for commercial validation is **paid pre-reg conversions**, which carry self-selection bias (early adopters) but at least measure cash-level behaviour.
- Do not extrapolate 30-day signals to multi-year market viability. Confirm with a 90-day pilot in the identified seed geography before committing further capital.

---

## 13 · Risks, contradictory findings, and reasons not to proceed

**Reasons to proceed**:
- Verified gap in competitor stacks (Section 2).
- Documented buyer-side pain (Section 6).
- Faire's success proves trust-first wholesale marketplaces work (B1).
- Indonesian trade statistics show real export demand (Section 7).
- NEX already owns the Indonesian consumer/directory + chat/live infra · incremental build cost is lower than greenfield.

**Reasons to reconsider**:
- **Qlapa failed in 2019** on a similar hypothesis (even though competitive context differs).
- **Willingness-to-pay evidence is weak**. The strongest "pay" signal is Shopify (not a marketplace) and Alibaba Gold Supplier (which already exists in Indonesia).
- **Competitors can plausibly add missing features** in 12-18 months. First-mover advantage in two-sided marketplaces is weak unless network effects compound.
- **Kadin's "We Buy From Indonesia"** (Aug 2026 launch) is a government-backed adjacent entrant that may own the official narrative. NEX would need to differentiate on quality + user experience + indie-maker identity.
- **Realistic Year-1 revenue ceiling** (US$100K-500K) is small relative to typical VC-scale ambition. If NEX pursues this, it should be as a bootstrap-friendly specialty vertical, not a billion-dollar bet.
- **Mandate alignment risk** · NEX's existing doctrine (sealed) says "NEX never handles payments" and the existing architecture is designed around chat + directory + themes + Vault. A B2B export marketplace adds supplier verification, enquiry primitives, and buyer-side tooling that are substantial new domains. Preserving existing functionality while adding these is possible but non-trivial.
- **Buyer-side is harder than supplier-side.** Suppliers can be acquired through associations + trade events. Buyers require sophisticated discovery + marketing + account management that NEX has not demonstrated. If buyer acquisition fails, suppliers churn.

**Honest TikTok distinction** (addressing founder's "not feeling another TikTok" concern):
- TikTok Shop and Shopee Live are **consumer-facing live commerce** — algorithmic feed, impulse purchase, no MOQ, no custom orders, no supplier verification.
- The proposed NEX direction is **vertical B2B** — qualified buyer discovery, custom production, MOQ-aware, verified suppliers, long sales cycles. Different product category entirely.
- Live commerce can be a *feature* for live factory tours or product reveals but should NOT be the primary discovery surface. Primary surface should be **persistent supplier profiles with evidence**, closer to Faire + Alibaba than to TikTok.
- "World-wide volume" for this concept comes from **high per-transaction value** (US$500-50K wholesale orders) rather than TikTok-scale consumer volume. 10,000 active cross-border buyers × 2 orders/year × US$5,000 avg = US$100M in gross merchandise facilitated (even without taking commission). The business model is subscription + value-added, not GMV take.

---

## 14 · Evidence quality and limitations

**Strengths**:
- Three independent live-research passes, each covering a distinct question.
- All material statistics year-tagged + source-URL-cited.
- Separation of fact / inference / hypothesis maintained throughout.
- Flagged every single-source claim and every contested figure.

**Limitations**:
- **Reddit was not directly fetchable** by the research tooling (blocked). All r/Etsy / r/EtsySellers / r/handmade evidence is routed through outlets that already summarised threads (EcommerceBytes, Value Added Resource, Modern Retail, Ideafast). Direct quote fidelity cannot be fully verified. Treat the 45-item evidence table as directionally correct, not independently audited.
- **Sampling bias toward Western (US / UK / EU) sellers.** Modern Retail, Quartz, Belleflamme, Indie Sellers Guild all US/UK-focused. Indonesian seller voice is routed through observer sources (Rest of World, ANTARA, Veridion), not direct public forums.
- **No pricing-elasticity primary research available.** No public survey of "Indonesian makers' willingness to pay US$X for a cross-border marketplace with video." This is NEX's single biggest research gap and must be filled by direct supplier interviews.
- **Industry-blogger bias.** Unanswered.io, Craftybase, Nexentio, Sellfy, Trendlytic are affiliate-incentivised. Numbers aggregated through them trace back to real public events but are filtered.
- **MSME count discrepancy** (56M / 65.5M / 64M across sources) is methodological, not fraudulent — different instruments (Sakernas labour survey vs MinKUKM admin data vs older Jokowi-era aggregation).
- **"42% of cross-border trade disputes = supplier identity fraud"** is cited from 2023 China Consumer Association via secondary outlets; original CCA report not independently retrieved.
- **Faire ARR estimates** are third-party (getlatka.com); not audited.
- **Trade Expo Indonesia US$22.73B** is MoU-level, not realised shipments.
- **No evidence of a successful Indonesia→West maker marketplace at scale.** MadeInIndonesia.com, Indonesia SME Hub, IndoTrading exist but produce no public testimonials of comparable volume to Etsy. This is itself a datapoint: the gap is real but unproven as a solved problem.
- **This report cannot predict whether NEX will succeed.** It identifies that the gap is real, that it has not been filled by any single competitor, and that the strongest validation signals are buyer-side (Faire, TEI). All six hypotheses have confidence ratings and need live validation.

---

## 15 · Primary-source register

Full list of citations referenced in sections 2-11:

### Competitive landscape
- seller.alibaba.com/blogs/2026/global/b2b-ecommerce/alibaba-com-global-influence-guide-2026
- smartbuy.alibaba.com/buyingguides/alibaba-video-live
- easyimex.com/blog/alibaba-supplier-verification-guide/
- alibaba.com/live/online-factory-tour-from-assembly-to_c449635f-ae8c-459b-8dc2-ace0392f1ab0.html
- merchtitans.com/blog/faire-wholesale-marketplace-guide
- ecommerce-times.com/faire-in-2026-the-wholesale-marketplace-betting-big-on-global-expansion/
- blog.ankorstore.com/ankorstore-product-news-april-2026/
- lubiwood.com/us/ankorstore-com-alternatives-8/
- vinasources.com/blog/alibaba-vs-global-sources-vs-indiamart-vs-made-in-china/
- globalsources.com/knowledge/9-leading-sourcing-platforms-hks/
- gineehub.com/insights/shopee-live-commerce-peluang-2026/
- investortrust.id/business/118645/shopee-luncurkan-dua-fitur-baru-untuk-bantu-umkm-tentukan-harga-dan-genjot-promosi-digital
- kr-asia.com/indonesian-online-marketplace-qlapa-shuts-down
- compasslist.com/insights/indonesian-local-crafts-marketplace-qlapa-shuts-down
- en.antaranews.com/amp/news/424989/kadin-launches-export-tech-platform-we-buy-from-indonesia
- indiplomacy.com/2026/08/03/indonesias-kadin-launches-we-buy-from-indonesia-platform-to-boost-global-exports/
- tradexpoindonesia.com/about/general-information/
- within.co/blog/whatnot-livestream-shopping-guide/
- stackinfluence.com/blog/top-live-shopping-platforms-2026-tiktok-amazon
- amzbase.com/guides/amazon-handmade-guide/
- sellerapp.com/blog/amazon-handmade/
- nifty.ai/post/etsy-seller-account-requirements
- cedcommerce.com/blog/etsy-policy-changes-2026-what-shopify-etsy-sellers-must-fix-to-stay-compliant-visible-and-profitable/
- garnetmarketplace.com/marketplaces/notonthehighstreet.html
- en.wikipedia.org/wiki/The_Grommet
- morningstar.com/news/business-wire/20260402787701/minted-celebrates-fifth-annual-independent-artist-day
- coruzant.com/digital-strategy/instagram-commerce-report/
- looperbuy.com/the-future-of-wholesale-social-media-how-b2b-sourcing-is-being-transformed-in-2026
- prlog.org/13138923-marketplace-profile-launches-the-worlds-first-video-based-b2b-supplier-directory.html
- newbuyingagent.com/resources/live-stream-factory-tours-a-hassle-free-buyer-s-verification-strategy
- tiktokstats.com/articles/rise-commerce-how-launch-your-first-tiktok-shop-live
- wholesalefashiontrends.com/blogs/news/how-to-source-products-for-tiktok-live-selling-from-usa-based-wholesale-vendors

### Seller dissatisfaction / willingness-to-pay
- techcrunch.com/2022/04/11/etsy-strike-sellers-transaction-fees/
- modernretail.co/technology/sellers-are-worried-about-the-amazon-ification-of-etsy-and-are-considering-other-platforms/
- paulbelleflamme.substack.com/p/opportunity-knocks-how-new-platforms
- unanswered.io/guide/why-are-sellers-leaving-etsy
- ideafast.pro/blog/etsy-problems-2026
- valueaddedresource.net/etsy-dropshipping-crackdown/
- valueaddedresource.net/etsy-survey-listing-fee-increase-subscription/
- valueaddedresource.net/etsy-holding-payments-in-error/
- ecommercebytes.com/2025/11/16/etsy-sellers-say-total-search-invisibility-is-causing-sales-to-tank/
- ecommercebytes.com/2024/02/25/monthly-fees-may-be-coming-to-etsy/
- axios.com/2024/11/15/etsy-ceo-gen-ai-drop-shipping
- aol.com/news/etsy-ceo-says-company-escaping-181609235.html
- malaymail.com/news/world/2024/11/14/even-handicraft-marketplace-etsy-needs-ai-to-compete-says-ceo-amid-sellers-concerns/156731
- qz.com/etsy-scrambling-avert-seller-strike-over-payment-reserv-1850702861
- indiesellersguild.org/etsy-payment-account-reserves-what-weve-learned/
- community.etsy.com (threads 147773681, 148741236, 148290953, 147505836, 145590880, 147854280)
- consumeraffairs.com/online/etsy.html
- trustpilot.com/review/www.etsy.com
- trustpilot.com/review/faire.com
- apps.shopify.com/reviews/1418807, 1569752, 1479105, 1644203 (Faire)
- resetera.com/threads/etsy-has-really-gone-to-shit-huh-another-ai-rant.1365127/
- restofworld.org/2025/tiktok-indonesia-tokopedia-merger-problems/
- retaildive.com/news/artisan-cooperative-marketplace-launches-etsy/695707
- blog.artisans.coop/blog/etsy-alternatives-you-can-try-right-now-2024/
- craftybase.com/blog/alternatives-to-selling-on-etsy
- nexentio.com/en/blog/etsy-fees-explained-how-to-migrate-to-own-shopify-store

### Buyer-side + Indonesia + sizing
- en.antaranews.com/news/436161/from-rural-roots-to-international-markets-indonesian-msmes-go-global
- en.antaranews.com/news/387753/indonesias-umkm-export-program-hits-usd1088-million-in-deals
- en.antaranews.com/news/424467/indonesia-sees-us25134-mln-export-potential-in-traditional-textiles
- en.antaranews.com/news/366657/indonesias-655-mln-msmes-absorb-119-mln-workers-govt
- en.antaranews.com/news/307899/msmes-contribute-61-percent-to-indonesias-gdp-president-jokowi
- en.antaranews.com/news/369965/batik-exports-grow-76-to-us763-mln-in-q1-minister
- en.antaranews.com/amp/news/432933/airlangga-urges-furniture-industry-to-reduce-us-export-dependence
- bps.go.id/en/publication/2025/07/07/6de51ef555c018f6ba7168d1/indonesia-foreign-trade-statistics-exports-2024--book-i.html
- jakartaglobe.id/business/indonesias-trade-expo-books-record-228-billion-deals-exceeding-target-by-nearly-40-percent
- jakartaglobe.id/business/msmes-only-account-for-15-pct-of-indonesian-exports
- prnewswire.com/apac/news-releases/the-40th-trade-expo-indonesia-officially-closes-with-record-breaking-results-302592964.html
- english.news.cn/20250123/290d8b7bbe7e4d4b999ff530afe2a267/c.html
- databoks.katadata.co.id/en/economics-macro/statistics/6a336ca85b5a5/number-of-msmes-in-indonesia-for-the-period-2020-2024
- databoks.katadata.co.id/en/trade/statistics/68834adfa69b4/indonesias-jewelry-export-volume-sets-new-record-in-2024
- databoks.katadata.co.id/en/agroindustry/statistics/68c7ccc589827/indonesias-coffee-export-value-surge-in-2024-reaching-a-decade-high
- observerid.com/jewelry-exports-reach-usd-5-5-bn-in-2024/
- voi.id/en/economy/421582, 460498
- dealstreetasia.com/stories/indonesia-qlapa-shutdown-124018
- insights.top4.com.au/2019/03/04/indonesian-handicraft-marketplace-qlapa-shuts-down-top4-insight
- globalventuring.com/blog/2019/03/06/corporate-backed-qlapa-closes-shop
- cnbcindonesia.com/tech/20190304154212-37-58772/gegara-perang-bakar-duit-marketplace-lokal-ini-berguguran
- jingsourcing.com/alibaba-scams-fraud-expose/
- chinacompanylookup.com/china-supply-chain/how-to-spot-fake-alibaba-suppliers/
- verisupplier.com/alibaba-supplier-scam
- supplyia.com/how-to-avoid-alibaba-scams/
- amrepinspect.com/blog/qualifying-suppliers-in-indonesia-what-global-buyers-need-to-know
- the-shiv.com/manufacturing-in-indonesia-industry/
- tariffhelp.org/country-guides/indonesia-sourcing-guide-key-facts-2025-edition
- cosmosourcing.com/blog/sourcing-from-indonesia-guide
- mppfurniture.com/moq-for-furniture-retailers/
- mppfurniture.com/indonesian-furniture-manufacturers-3-key-factors/
- woodexport.id/wood-furniture-indonesia-supply-chain-2025/
- 889globalsolutions.com/blog/your-specs-were-clear-so-why-did-15-of-your-parts-arrive-out-of-tolerance
- getlatka.com/companies/faire
- faire.com/news/faire-independent-retail-pulse-september-1-2026
- retailtechinnovationhub.com/home/2024/3/7/wholesale-marketplace-faire-racks-up-400000-product-orders-from-british-independent-retailers
- seller.alibaba.com/id/furniture-industry-report
- aeki-aice.org/en/statistik-kopi/
- tradexpoindonesia.com/
- oecd.org/en/publications/financing-smes-and-entrepreneurs-2026_075d8058-en/full-report/indonesia_6fd1f81b.html

---

## Final answer to the mandate's closing question

**Is there a demonstrable gap for NEX in the market for export-oriented makers and suppliers, and is that gap sufficiently painful, underserved, and commercially valuable to justify building around it?**

**Short answer**: There is a real, structurally unoccupied gap. Whether it is **sufficiently painful + commercially valuable** is NOT yet proven. The research recommends a 30-day validation (§12) before committing further.

**The research is NOT a go-signal.** It is a map of:
- Where no competitor currently plays (opportunity).
- Where every adjacent competitor's weakness lies (potential wedge).
- Where paying willingness has not been demonstrated (risk).
- What experiment would convert the hypothesis into evidence (next step).

**If the 30-day validation succeeds**: proceed with the Handicraft + Batik vertical in the Jepara / Bali / Yogya + EU/AU/SG seed geography, with subscription + enhanced-listings monetisation (respecting the sealed "NEX never handles payments" doctrine).

**If it fails**: three alternative framings worth testing (in order of research-supported viability):
1. **"Faire-for-Indonesia"** · pure B2B wholesale with Indonesian indie brands, no live/video emphasis, Western-retailer-buyer focus.
2. **"Verified-provenance supplier directory"** · no transactions, just supplier evidence + buyer-match + chat; monetise with directory subscriptions + inspection services. Lower upside, lower risk.
3. **"Hospitality procurement + interior-design-trade"** · B2B specialty vertical with higher order values, smaller buyer universe, lower network-effect needs; narrower but more defensible.

**What NEX is NOT**: Another TikTok. Another Etsy. Another Alibaba. The research shows that competing head-on with any of these three on their primary surface is unwinnable. The viable NEX positioning is a **fourth category**: country-vertical + supplier-identity + production-video + export-trust in one coherent surface, with subscription-first monetisation and chat/live as supporting features — not the hero.

**The strongest reason to be cautious**: no one has succeeded here before. Qlapa failed. Marketplace Profile is new and tiny. Kadin's We Buy From Indonesia is a government-backed adjacent entrant. The gap is real but the moat is unproven.

**The strongest reason to proceed**: NEX already has the infrastructure (chat, directory, live, themes, business accounts). The incremental cost to test this hypothesis is far lower than greenfield. A disciplined 30-day validation can cheaply determine whether to continue.
