// src/app/nex-generated/buying-guides/rolex/page.tsx
//
// Rolex Buying Guide · substantial single-scroll editorial article.
// Independent Next content · not affiliated with Rolex SA.
// Sandbox-only preview surface · noindex at page scope.
//
// 2026-11-17 redesign:
//   - Shared nexapp header (right-side "+" drawer button) mounted at top
//   - Restrained lucide-react icon set (Clock / Settings / ShieldCheck /
//     TrendingUp / HelpCircle / Store) marked aria-hidden
//   - Cream + orange + gray + white + black palette (no emerald / gold)
//   - Hero with eyebrow + lede; TOC as underlined list with arrow glyph
//   - Timeline grid (year chip + body) — no left-border document look
//   - Scannable buying-check / value-factor / cost material as bullet lists,
//     narrative passages kept as prose
//
// 2026-11-17 Phase 2 refactor:
//   - Chrome (stage/frame/header/hero/TOC/trailing-image/seller/footer)
//     lifted into shared <GuideLayout> alongside mobile-phones + handbags.
//   - Editorial body sections remain inline as `children`; local helpers
//     (ImageSlot, Milestone, Faq) replaced with imports from the shared
//     layout so there is a single source of truth per helper.
//
// Content integration · 2026-11-17 (lead):
//   Placeholder tokens replaced with researcher-ledgered prose per
//   evidence/rolex-buying-guide/{research-ledger.md, questions-30.md,
//   content-notes.md, image-checklist.md}. Where the ledger flagged
//   an item as unverified in this research session, a visible
//   limitation note replaces the figure. No fabricated prices.
//
// Claim-type tags follow the ledger's "manufacturer · independent ·
// mixed" convention so the reader can see at a glance whether a
// paragraph rests on Rolex's own material or on third-party sources.

import type * as React from "react";
import {
  Clock,
  Settings,
  ShieldCheck,
  TrendingUp,
  HelpCircle,
} from "lucide-react";
import { GuideLayout, ImageSlot, Milestone, Faq } from "../_guide-layout";
import styles from "../_phone-frame.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rolex Buying Guide — Next",
  description:
    "An independent guide covering Rolex history, how the watches are made, buying considerations, and market value. Not affiliated with Rolex SA.",
};

export default async function RolexBuyingGuidePage(): Promise<React.JSX.Element> {
  return (
    <GuideLayout
      dataScope="buying-guides-rolex"
      title="Rolex"
      lede={
        <>
          An independent Next guide to the brand&apos;s history, how the
          watches are made, buying considerations, and how the market
          around them actually behaves.
        </>
      }
      disclaimer={[
        "Editorial reference content.",
        "Next does not sell Rolex watches.",
        "No commercial relationship with Rolex SA.",
      ]}
      heroImage={{
        n: 1,
        instruction:
          "Hero. Square 1:1. Owner's own Rolex laid flat against a matte, non-reflective surface (matte grey, oak, or dark linen). Crown visible at 3 o'clock, bracelet laid flat, natural daylight preferred. No lifestyle framing.",
      }}
      toc={[
        { href: "#history", label: "History & milestones" },
        { href: "#manufacture", label: "Manufacture & movements" },
        { href: "#buying-ownership", label: "Buying & ownership" },
        { href: "#market-value", label: "Market value realities" },
        { href: "#faq", label: "Frequently asked questions" },
        { href: "#for-sellers", label: "For watch sellers" },
      ]}
      trailingImage={{
        n: 6,
        instruction:
          "Square 1:1. A watchmaker's hands removing a Rolex caseback on a bench — loupe, case-holder and movement tray visible. Taken in an independent watchmaker's workshop with permission to publish, or in the owner's own workspace. Should not be staged to look like a Rolex Service Centre.",
      }}
      sellerBlock={{
        title: "Are you a watch seller?",
        body: (
          <>
            Become part of the evolution of selling online. Create your
            shop on Nex, showcase your watches, and let customers contact
            you directly through chat about the products they&apos;re
            interested in.
          </>
        ),
      }}
      footerText="Next · Independent buying guide · preview build · not affiliated with Rolex SA."
    >
      {/* ─────────── Section A: History ─────────── */}
      <section id="history" aria-labelledby="history-heading">
        <h2 id="history-heading">
          <Clock aria-hidden="true" className={styles.sectionIcon} />
          History &amp; milestones
        </h2>
        <p>
          Rolex began in London in 1905 as a partnership between Hans
          Wilsdorf (a German national) and the British watch dealer Alfred
          Davis — Wilsdorf&apos;s brother-in-law. The &ldquo;Rolex&rdquo;
          name was registered as a trademark in 1908, the company moved to
          Geneva in 1919 under the weight of post-war British import tax
          on luxury goods, and Montres Rolex SA was formally registered in
          Geneva in 1920. The Acacias-district headquarters has been
          Rolex&apos;s home since 1965, with its most recent expansion in
          2022.
        </p>

        <ol className={styles.timeline}>
          <Milestone year="1905">
            Founded in London as <strong>Wilsdorf and Davis</strong>, a
            partnership between German-born Hans Wilsdorf and British watch
            dealer Alfred Davis. The firm imported Swiss movements and
            cased them for sale in the United Kingdom.
          </Milestone>
          <Milestone year="1908">
            Hans Wilsdorf registered the{" "}
            <strong>&ldquo;Rolex&rdquo; trademark</strong>. The short,
            pronounceable brand name was deliberately chosen to be legible
            in multiple European languages and to fit on a dial.
          </Milestone>
          <Milestone year="1914">
            On <strong>15 July 1914</strong>, a Rolex wristwatch was
            awarded a <strong>Class &ldquo;A&rdquo; precision certificate</strong>{" "}
            by <strong>Kew Observatory</strong> in Great Britain — a
            rating previously reserved for marine chronometers. The watch
            passed 45 days of testing in five positions and three
            temperatures with an average daily rate on the order of one
            second.
          </Milestone>
          <Milestone year="1919">
            The company <strong>moved from London to Geneva</strong> as
            post-war British taxation on luxury imports made the
            cross-border trade uneconomic. Montres Rolex SA was then
            registered in Geneva in 1920.
          </Milestone>
          <Milestone year="1926">
            The <strong>Oyster case</strong> was patented and launched
            (1926–27) — a system that sealed the movement by screwing the
            bezel, case back and winding crown against the middle case.
            The underlying Perregaux–Perret patent (Swiss patent CH 114948,
            granted 17 May 1926) was transferred to Wilsdorf on 24 July
            1926. The Oyster is correctly described as the{" "}
            <em>first commercially successful</em> waterproof wristwatch
            case; earlier experimental waterproof designs existed.
          </Milestone>
          <Milestone year="1931">
            Rolex patented the <strong>Perpetual rotor</strong> — a
            semicircular self-winding weight that rotated a full 360° in
            either direction. It replaced the earlier &ldquo;bumper&rdquo;
            automatic mechanisms and became the template for the modern
            automatic wristwatch.
          </Milestone>
          <Milestone year="1945">
            The <strong>Datejust</strong> was introduced to mark
            Rolex&apos;s 40th anniversary — widely credited as the first
            wristwatch with an automatically changing date in a dial
            window. In the same year, Hans Wilsdorf established the{" "}
            <strong>Hans Wilsdorf Foundation</strong> after the death of
            his wife.
          </Milestone>
          <Milestone year="1953">
            Three landmark releases in a single year:{" "}
            <strong>Submariner</strong> (first production reference 6204
            presented at Basel 1954), a professional dive watch that
            defined the genre; <strong>Explorer</strong>, introduced to
            commemorate the first ascent of Everest; Rolex equipped the
            British Mount Everest expedition, during which Edmund Hillary
            and Tenzing Norgay summited on 29 May 1953 (historians note
            that Norgay was photographed wearing a Rolex at the climb;
            which watch Hillary personally wore at the summit remains
            historically disputed, with a Smith&apos;s often cited).
          </Milestone>
          <Milestone year="1955">
            The <strong>GMT-Master</strong> was introduced for{" "}
            <strong>Pan American World Airways</strong> pilots flying the
            new long-haul transatlantic routes. A rotating 24-hour bezel
            and a fourth hand allowed two time zones to be read at once.
          </Milestone>
          <Milestone year="1960">
            Hans Wilsdorf <strong>transferred 100% of Rolex</strong> to
            the Hans Wilsdorf Foundation. Rolex SA remains a for-profit
            manufacturer, but its sole shareholder is a Swiss private
            foundation — so the company is not publicly traded and does
            not disclose financial results.
          </Milestone>
          <Milestone year="1963">
            The <strong>Cosmograph Daytona</strong> was introduced, named
            for the Daytona International Speedway. Built as a motorsport
            chronograph with a tachymeter bezel for computing average
            speeds over a fixed distance; it sold slowly at first and
            became a cultural phenomenon decades later.
          </Milestone>
          <Milestone year="1967">
            The <strong>Sea-Dweller</strong> was introduced with a{" "}
            <strong>helium escape valve</strong> (Swiss patent CH492246)
            that allowed professional saturation divers to wear the watch
            through decompression without the crystal popping off. Initial
            rating 2,000 ft (610 m); extended to 4,000 ft (1,220 m) in
            1978.
          </Milestone>
        </ol>
      </section>

      <ImageSlot
        n={2}
        instruction="Square 1:1. A clean photograph of a vintage Rolex (any era pre-1990) — Oyster-style case profile, older-style dial. Owner's piece or a borrowed piece with written permission to publish. If no vintage piece is available, this slot should be omitted rather than substituted."
      />

      {/* ─────────── Section B: Manufacture ─────────── */}
      <section id="manufacture" aria-labelledby="manufacture-heading">
        <h2 id="manufacture-heading">
          <Settings aria-hidden="true" className={styles.sectionIcon} />
          Manufacture &amp; movements
        </h2>
        <p>
          Rolex operates as a vertically integrated producer: the company
          publishes that it designs and produces the overwhelming majority
          of its own components. Everything below distinguishes claims
          that trace only to Rolex&apos;s own material from claims
          corroborated across independent coverage.
        </p>

        <h3>Materials</h3>
        <p>
          Rolex has used <strong>904L stainless steel</strong> across its
          entire steel line since 2003, and in 2018 branded the alloy{" "}
          <strong>&ldquo;Oystersteel&rdquo;</strong>. Compared with the
          316L stainless used by much of the industry, 904L contains more
          chromium, nickel and molybdenum, with a small copper fraction —
          editorial sources cite approximately 20–21% chromium, 8–10%
          nickel, 3–4% molybdenum and around 0.5–1% copper, with iron as
          the balance. The practical consequence is better corrosion
          resistance, particularly against chloride environments like
          seawater and perspiration. The trade-off is that 904L is harder
          to machine, which is why Rolex produces it in-house at its
          Plan-les-Ouates foundry (an in-house-foundry claim reported
          from Rolex press material by independent writers and not
          independently audited in this research session).
        </p>
        <p>
          Rolex also casts its own precious-metal alloys — including its
          proprietary <strong>Everose</strong> rose-gold variant —
          in-house. The exact per-alloy composition is not published in
          detail; Rolex describes Everose as resistant to the colour
          fading that can occur in some rose-gold mixes.
        </p>

        <h3>Movements</h3>
        <p>
          The current generation of Rolex calibres pairs three now-standard
          technical choices. The <strong>Parachrom hairspring</strong>{" "}
          (introduced 2000, updated with the characteristic blue oxide
          finish in 2005) is a niobium–zirconium–oxygen alloy that is
          paramagnetic — largely unaffected by ordinary magnetic fields —
          and reported by Rolex as up to ten times more shock-resistant
          than a traditional hairspring. The{" "}
          <strong>Syloxi silicon hairspring</strong>, introduced in 2014,
          is used on small- and medium-diameter calibres. The{" "}
          <strong>Chronergy escapement</strong>, introduced in 2015 in the
          3235 and 3255 and added to the 3285 in 2018, is a Rolex redesign
          of the Swiss lever escapement using a non-ferromagnetic
          nickel-phosphorous alloy; Rolex reports it as roughly 15% more
          energy-efficient, which contributes to the ~70-hour power
          reserve of modern calibres.
        </p>
        <p>
          Chronometer certification is carried out before casing by the{" "}
          <strong>Contrôle Officiel Suisse des Chronomètres (COSC)</strong>,
          which guarantees −4/+6 seconds per day on the uncased movement
          against a standardised protocol. This is a third-party test,
          not an in-house Rolex process.
        </p>

        <h3>Manufacturing &amp; assembly</h3>
        <p>
          Rolex describes a production chain covering casting, machining,
          stamping, hand-assembly and in-house testing, across sites in
          and around Geneva and in Bienne (where movements are produced).
          The specific per-site function split comes from Rolex press
          material summarised by third-party writers; a primary Rolex.com
          source was not independently fetched in this research session.
        </p>

        <ImageSlot
          n={3}
          instruction="Square 1:1. Close-up of a screw-down crown (Twinlock or Triplock with the Rolex crown logo visible) and the edge of the case back. Side-angled / raking light to show the threading."
        />

        <h3>Testing</h3>
        <p>
          After casing, Rolex applies its own{" "}
          <strong>Superlative Chronometer</strong> specification,
          tightening the standard to an average{" "}
          <strong>−2/+2 seconds per day</strong> on the fully cased, fully
          wound watch. The five-year international warranty is tied to
          this certification. The spec is published by Rolex in its 2024
          Superlative Chronometer brochure; it is not independently
          audited by a non-Rolex body.
        </p>
        <p>
          Water-resistance testing: the current Submariner carries a{" "}
          <strong>300 m / 1,000 ft</strong> water-resistance rating, and
          Rolex reports pressure-testing each case to <strong>+10%</strong>{" "}
          of rated depth. The caveat every buyer should carry with them is
          that depth ratings come from static laboratory tests —
          real-world wrist motion, pressure surges from diving into water,
          temperature shock from hot showers and sauna heat, and aged
          rubber gaskets all reduce the effective margin. This is why
          Rolex recommends periodic pressure-testing at service and why
          the rated figure is not a safety floor.
        </p>
      </section>

      {/* ─────────── Section C: Buying & ownership ─────────── */}
      <section
        id="buying-ownership"
        aria-labelledby="buying-ownership-heading"
      >
        <h2 id="buying-ownership-heading">
          <ShieldCheck aria-hidden="true" className={styles.sectionIcon} />
          Buying &amp; ownership
        </h2>

        <h3>Choosing between models</h3>
        <p>
          Rolex sells a relatively narrow catalogue compared with many of
          its peers. The current line-up groups broadly into{" "}
          <strong>sports references</strong> (Submariner, GMT-Master II,
          Daytona, Sea-Dweller, Explorer, Explorer II, Yacht-Master,
          Yacht-Master II) built around a specific professional context —
          diving, aviation, racing, mountaineering, regatta timing — and{" "}
          <strong>dress or everyday references</strong> (Datejust,
          Day-Date, Oyster Perpetual, Sky-Dweller, the 1908 collection,
          and discontinued but still-circulating lines like Air-King and
          Milgauss) that sit lower on the wrist with less-protruding
          bezels and are generally easier to wear under a cuff. A
          Submariner is not a &ldquo;better Datejust&rdquo; — they are
          different categories solving different problems.
        </p>

        <h3>Case sizes</h3>
        <p>
          Case diameter alone is a weak proxy for fit; lug-to-lug (L2L)
          length matters more, because the lugs are what overhang the
          wrist bone. Confirmed figures on three widely-cited sports
          references:
        </p>
        <ul>
          <li>
            <strong>Submariner Date 41 mm</strong> · lug-to-lug ≈ 47 mm.
          </li>
          <li>
            <strong>Cosmograph Daytona 40 mm</strong> · lug-to-lug ≈ 48
            mm.
          </li>
          <li>
            <strong>GMT-Master II 40 mm</strong> · lug-to-lug ≈ 47 mm.
          </li>
        </ul>
        <p>
          Rough starting advice: wrists under 16.5 cm (about 6.5 in)
          usually sit better with 36 mm (≈ 44 mm L2L); 7–7.5 in /
          17.8–19 cm wrists comfortably take either 36 mm or 40–41 mm;
          above 7.5 in / 19 cm, 40–41 mm tends to look balanced. These
          are guidelines, not rules — try before you buy where you can.
        </p>

        <h3>Maintenance &amp; servicing</h3>
        <p>
          Since 2016 Rolex&apos;s published guidance has been that modern
          watches need service <strong>approximately every ten years</strong>{" "}
          under normal wear. That figure is an average: a daily-wear
          sports watch — especially a diver that sees salt water —
          benefits from service every 5–7 years, and vintage references
          from before 1990 typically want 3–5 year intervals. Any sign of
          moisture under the crystal is a reason to stop wearing the watch
          and send it in. Service turnaround and country-level published
          price lists vary; the United States and United Kingdom figures
          below are representative for 2026 and should be reconfirmed
          with a local Rolex Service Centre at the moment of purchase.
        </p>
        <p>
          Representative <strong>Rolex Service Centre pricing (2026)</strong>:
        </p>
        <ul>
          <li>
            <strong>United States, USD, 2026:</strong> modern three-hand
            models (Datejust / Explorer / Air-King) ≈ $660; sports models
            (Submariner / GMT-Master II / Sea-Dweller) ≈ $770; modern
            Daytona ≈ $940. Classic five-digit from ~$990; vintage
            four-digit from ~$1,650.
          </li>
          <li>
            <strong>United Kingdom, GBP, 2026 (incl. VAT):</strong>{" "}
            time-only / date from £550; Submariner / GMT-Master II /
            Yacht-Master from £640; Daytona / Sky-Dweller / Yacht-Master
            II from £780; rare vintage chronographs up to £7,350.
          </li>
          <li>
            <em>Limitation.</em> Country-specific MSRPs and service
            prices outside the US and UK were not individually verified
            in the research ledger. Reconfirm locally before publishing
            the guide in a new market.
          </li>
        </ul>
        <p>
          Independent watchmakers can be less expensive but do not carry
          Rolex&apos;s own two-year post-service guarantee, and
          independent servicing can affect resale valuation depending on
          the parts used.
        </p>

        <h3>Water-resistance realities</h3>
        <p>
          A water-resistance rating printed on a dial reflects a
          laboratory specification, not a lifetime guarantee. A 300 m
          Submariner is dramatically over-specified for recreational
          swimming or scuba diving, but gaskets age, crowns can be left
          unscrewed, and hot-water temperature shock is harder on seals
          than cold-water pressure. Many watchmakers advise against
          showering with a Rolex, especially a hot shower or sauna, even
          though the rating comfortably covers the pressure involved. A
          pressure test at each service interval is the honest answer to
          &ldquo;is my watch still waterproof?&rdquo; — the number on the
          dial is not.
        </p>

        <h3>Pre-owned authentication checklist</h3>
        <p>
          Rolex does not operate a public serial-number lookup, and
          modern counterfeits routinely re-use serials copied from
          genuine watches. No online check gives certainty. Reliable
          authentication means a trained watchmaker physically opening
          the case back to inspect the movement. For a serious pre-owned
          purchase, confirm the following before money changes hands:
        </p>
        <ul>
          <li>Original papers and card, if claimed by the seller.</li>
          <li>
            Documented service history, or a recent independent
            watchmaker inspection.
          </li>
          <li>
            A movement inspection — case opened by a qualified
            watchmaker — before sale completion, where the price
            justifies it.
          </li>
          <li>
            Serial-number cross-checks against the seller&apos;s stated
            provenance (one data point among many, not proof).
          </li>
          <li>
            Preference for <strong>Rolex Certified Pre-Owned</strong>{" "}
            (launched December 2022 at Bucherer in Switzerland, Austria,
            Germany, France, Denmark and the UK; expanded to the US via
            Tourneau in May 2023), which comes with a new two-year
            international manufacturer guarantee and authentication at
            an authorised retailer.
          </li>
        </ul>

        <ImageSlot
          n={4}
          instruction="Square 1:1. A Rolex automatic movement visible via an off-case watchmaker photograph — the rotor should be clearly in frame. Legitimate service photograph, not a mock-up. If no legitimate movement photo is available, omit."
        />
      </section>

      {/* ─────────── Section D: Market value ─────────── */}
      <section id="market-value" aria-labelledby="market-value-heading">
        <h2 id="market-value-heading">
          <TrendingUp aria-hidden="true" className={styles.sectionIcon} />
          Market value realities
        </h2>

        <div className={styles.banner}>
          Every figure in this section carries a currency, a region and a
          period. Numbers from third-party indices are dealer-listed
          asking prices plus reported sales, not independently audited
          completed-transaction data. There is no guarantee of future
          appreciation.
        </div>

        <p>
          Discussions of Rolex &ldquo;value&rdquo; routinely confuse four
          different numbers. A single model can appear at four very
          different prices simultaneously, and each number means
          something different:
        </p>
        <ul>
          <li>
            <strong>Manufacturer retail price.</strong> The price
            published by the brand for an authorised-dealer sale. May or
            may not be available in practice depending on allocation.
          </li>
          <li>
            <strong>Dealer asking price.</strong> The price a pre-owned
            dealer lists a watch at. Reflects margin, inventory age and
            marketing. Not the price the dealer actually sells at.
          </li>
          <li>
            <strong>Completed-sale price.</strong> The hammer or
            accepted-offer price for a specific watch, on a specific
            date, in a specific condition. The only honest &ldquo;this is
            what one sold for&rdquo; figure.
          </li>
          <li>
            <strong>Market-index estimate.</strong> An aggregated number
            produced by a third-party index. Useful for direction but is
            model-, condition- and time-weighted in ways that may not
            match the watch in front of you.
          </li>
        </ul>

        <h3>
          Example: Submariner Date (ref. 126610) and no-date (ref.
          124060)
        </h3>
        <p>
          Figures as cited by <strong>WatchCharts</strong> in{" "}
          <strong>November 2026</strong>, United States, USD:
        </p>
        <ul>
          <li>
            <strong>Submariner Date 126610.</strong> Manufacturer retail
            ≈ <strong>$11,350</strong>. Market index (dealer asking +
            reported sales) ≈ <strong>$13,668</strong>, a premium of
            roughly +20.4% to retail.
          </li>
          <li>
            <strong>Submariner (no-date) 124060.</strong> Manufacturer
            retail ≈ <strong>$10,050</strong>. Market index ≈{" "}
            <strong>$12,094</strong>, a premium of roughly +20.3% to
            retail.
          </li>
          <li>
            <em>Methodology note.</em> WatchCharts indices combine
            dealer-listed asking prices with reported sales; they are
            not audited completed-sale data. Chrono24 and WatchCharts
            both publish methodology pages that describe the limitations
            further; the 2026 primary pages were not fetched in this
            research session.
          </li>
        </ul>

        <h3>Example: Cosmograph Daytona (steel)</h3>
        <p>
          The Daytona remains the longest-wait reference at authorised
          dealers (commonly reported at 5–8 years in 2026) and the
          highest grey-market premium — widely reported at roughly{" "}
          <strong>2× authorised retail</strong> on the secondary market
          in 2026. A specific 2026 United States MSRP by variant and a
          specific completed-auction range by date were{" "}
          <em>not individually verified</em> in this research session;
          reconfirm against WatchCharts, Chrono24 and a current
          authorised-dealer list before quoting a specific number.
        </p>

        <h3>Example: Datejust 36 (steel)</h3>
        <p>
          The Datejust 36 is commonly cited as an entry-level reference
          that trades <em>modestly below retail</em> on the pre-owned
          market — i.e. authorised-dealer new purchase typically means
          absorbing first-year depreciation that a careful pre-owned
          buyer avoids. A specific 2026 USD / GBP / EUR retail figure
          and a specific completed-sale range were{" "}
          <em>not individually verified</em> in this research session;
          reconfirm locally before publication.
        </p>

        <h3>What drives the gap</h3>
        <p>
          After the <strong>2021–2022 speculative peak</strong>, the
          WatchCharts Rolex index declined through 2023 and into early
          2024 as grey-market supply caught up with demand and
          post-pandemic discretionary spending cooled. The market
          stabilised in 2024 and ticked up through 2025–2026. Rolex
          itself raised authorised-dealer retail prices by{" "}
          <strong>roughly 7% in January 2026</strong>, which compressed
          the gap between grey-market and authorised-dealer pricing on
          most references (Daytona excepted). Reported waitlists in late
          2026: median 1–3 months across most references, 1–3 years for
          the Submariner, and 5–8 years for the Daytona — figures that
          are self-reported by dealers and buyers and not audited.
        </p>
        <p>
          Depreciation in year one on a broad-basket basis is widely
          cited at around <strong>−11.3%</strong> (per aggregated
          editorial reporting of WatchCharts data); the aggregate masks
          enormous variance. Entry-level references typically trade
          below retail on the pre-owned market; steel sports references
          often trade at or above retail; precious-metal references
          usually retain around 70–80% of retail. These are historical
          patterns from recent periods, not a prediction of future
          behaviour.
        </p>

        <h3>Factors that drive variance within a single reference</h3>
        <p>
          Roughly ordered from biggest to smallest impact:
        </p>
        <ul>
          <li>
            <strong>Physical condition</strong> — unpolished case with
            sharp lugs and a clean dial.
          </li>
          <li>
            <strong>Completeness</strong> — box, warranty card, booklets,
            tags, service records. A &ldquo;full set&rdquo; is commonly
            reported as worth 10–25% more than a comparable loose watch.
          </li>
          <li>
            <strong>Documented provenance</strong> — original purchase
            paperwork, prior service records.
          </li>
          <li>
            <strong>Channel</strong> — dealer versus private sale.
            Dealers typically take a spread for warranty and
            authentication.
          </li>
          <li>
            <strong>Service history</strong> — documented service history
            can support a 10–20% uplift versus an undocumented watch, but
            that uplift rarely exceeds the service&apos;s own cost.
            Honest framing: servicing <em>protects</em> value, it does
            not add value.
          </li>
        </ul>
        <p>
          In August 2023, Rolex acquired the retailer{" "}
          <strong>Bucherer</strong> (terms undisclosed), bringing direct
          retail distribution under the Rolex corporate umbrella for the
          first time in the company&apos;s modern history. Bucherer
          continues to operate under its own brand and its own
          management.
        </p>

        <ImageSlot
          n={5}
          instruction="Square 1:1. Close-up of an Oystersteel bracelet link showing the brushed-and-polished finishing and the lug end-link transition. Owner's own watch. Macro lens if available."
        />
      </section>

      {/* ─────────── Section E: FAQ ─────────── */}
      <section id="faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading">
          <HelpCircle aria-hidden="true" className={styles.sectionIcon} />
          Frequently asked questions
        </h2>
        <p>
          Short, neutral answers to the questions readers most often ask
          when first researching the brand. Longer answers with sources
          live in the article sections above.
        </p>

        <div className={styles.faq}>
          <Faq q="Do Rolex watches lose value?">
            Most Rolex watches lose some value the moment they leave an
            authorised dealer — the drop in year one is typically in the
            low double digits of percent on a broad-basket basis. But the
            bigger picture is more mixed: aggregated secondary-market
            data shows popular steel sports references (Submariner,
            GMT-Master II, Daytona) trading at or above retail, while
            entry-level dress models and precious-metal pieces are the
            most likely to sit below retail on the pre-owned market. The
            direction of travel depends on model, market period and
            condition, not on the badge alone.
          </Faq>

          <Faq q="Which factors affect resale value?">
            In roughly descending order of impact: model and reference
            (sports steel outperforms dress and precious metal on
            secondary demand), physical condition (unpolished case,
            sharp lugs, clean dial), completeness (a &ldquo;full
            set&rdquo; — box, warranty card, booklets, tags, service
            records), documented provenance (purchase receipt and prior
            service history), age/rarity and market period, and finally
            dealer vs private-sale channel (dealers take a spread for
            warranty and authentication).
          </Faq>

          <Faq q="Does buying at retail versus resale change the outcome?">
            Yes, and the change is model-specific. For in-demand steel
            sports references, an authorised-dealer allocation at retail
            has historically meant immediate paper value above what you
            paid — but there is a real opportunity cost in the wait and
            the dealer-relationship work involved. For entry-level and
            precious-metal references, the pre-owned market typically
            sits below retail, so buying new means absorbing first-year
            depreciation that a careful pre-owned buyer can avoid. New
            purchases come with five years of international warranty;
            Rolex Certified Pre-Owned comes with two.
          </Faq>

          <Faq q="What does servicing cost mean for returns?">
            Servicing is a holding cost that reduces any gross price
            appreciation into a lower net return. At Rolex Service
            Centre pricing a modern three-hand service runs in the
            roughly $660–$940 USD or £550–£780 GBP band in 2026,
            recommended approximately every ten years. Documented
            service history can support a 10–20% uplift over a
            comparable undocumented watch when selling — but that uplift
            rarely exceeds the service&apos;s own cost, so the honest
            framing is that servicing protects value rather than adding
            it. On vintage pieces, standard refinishing during service
            can actually reduce value; owners typically request
            &ldquo;service without polishing.&rdquo;
          </Faq>

          <Faq q="When was Rolex founded, and by whom?">
            The firm was founded as Wilsdorf and Davis in London in 1905
            by Hans Wilsdorf (German national) and Alfred Davis (British
            watch dealer, later Wilsdorf&apos;s brother-in-law). The
            &ldquo;Rolex&rdquo; trademark was registered in 1908, and
            the company relocated to Geneva in 1919 largely in response
            to post-war British taxation on luxury imports.
          </Faq>

          <Faq q="What was the Kew Observatory certificate of 1914?">
            On 15 July 1914, a Rolex wristwatch was awarded a Class
            &ldquo;A&rdquo; precision certificate by Kew Observatory in
            Great Britain — a rating previously reserved for marine
            chronometers. The watch passed 45 days of testing in five
            positions and three temperature conditions with an average
            daily rate on the order of one second. It was a watershed
            moment because it demonstrated that a wristwatch could
            match or exceed the precision of pocket watches and marine
            chronometers of the era.
          </Faq>

          <Faq q="When did Rolex introduce the Oyster (waterproof) case?">
            The Oyster case was patented and launched in 1926–1927. The
            core innovation was sealing the movement by screwing the
            bezel, case back and winding crown against the middle case.
            It is correctly described as the first <em>commercially
            successful</em> waterproof wristwatch case — there were
            earlier experimental waterproof designs, but the Oyster was
            the one that moved production at scale.
          </Faq>

          <Faq q="When did Rolex introduce the Perpetual self-winding rotor?">
            The free-rotating Perpetual rotor was patented by Rolex in
            1931 — a semicircular weight that rotated a full 360° in
            either direction and wound the mainspring continuously as
            the wrist moved, replacing earlier &ldquo;bumper&rdquo;-style
            automatic mechanisms that only wound in limited arcs.
          </Faq>

          <Faq q="When was the Datejust introduced?">
            In 1945, to mark Rolex&apos;s 40th anniversary. It is widely
            credited as the first wristwatch with an automatically
            changing date in a dial window.
          </Faq>

          <Faq q="When was the Submariner introduced?">
            The Submariner debuted in 1953, with the first production
            reference (6204) presented at Basel in 1954. It was
            conceived as a professional dive watch and quickly became
            the reference point for the modern dive-watch genre.
          </Faq>

          <Faq q="When was the GMT-Master introduced, and why?">
            In 1955, designed for Pan Am pilots who needed to track two
            time zones simultaneously on long-haul transatlantic routes.
            The rotating 24-hour bezel plus a second time-zone hand
            allowed a quick read of home and destination time.
          </Faq>

          <Faq q="When was the Cosmograph Daytona introduced?">
            In 1963, named for the Daytona International Speedway. It
            was built as a motorsport chronograph with a tachymeter
            bezel for calculating average speeds over a fixed distance.
            It sold slowly at first and only became a cultural
            phenomenon decades later.
          </Faq>

          <Faq q="What is the Explorer's connection to Mount Everest?">
            Rolex equipped the 1953 British Mount Everest expedition,
            during which Edmund Hillary and Tenzing Norgay reached the
            summit on 29 May 1953. The Explorer model was introduced
            the same year to commemorate the climb. Norgay was
            definitely wearing a Rolex Oyster Perpetual on the climb;
            which watch Hillary personally wore at the summit is
            historically disputed — a Smith&apos;s is also commonly
            cited for Hillary.
          </Faq>

          <Faq q="When was the Sea-Dweller introduced, and what makes it different?">
            In 1967. Its distinguishing feature is a helium escape
            valve (Rolex patent CH492246), which lets helium that has
            permeated the case during saturation diving vent safely
            during decompression, preventing the crystal from popping
            off on ascent. Initial rating was 2,000 ft (610 m),
            extended to 4,000 ft (1,220 m) in 1978.
          </Faq>

          <Faq q="Who owns Rolex?">
            Rolex SA is 100% owned by the Hans Wilsdorf Foundation, a
            Swiss private foundation established by the founder in
            1945 after his wife&apos;s death, with full company
            ownership transferred to it in 1960. Rolex SA itself is a
            for-profit manufacturer; its sole shareholder being a
            charitable foundation means the company is not stock-market
            traded and does not report profits publicly.
          </Faq>

          <Faq q="What is Oystersteel, and how is it different from ordinary stainless steel?">
            Oystersteel is Rolex&apos;s trade name (from 2018) for 904L
            stainless steel, used across all Rolex steel watches since
            Rolex completed the transition in 2003. Compared with the
            316L steel used by much of the industry, 904L contains more
            chromium, nickel and molybdenum, which materially improves
            corrosion resistance — particularly to chloride environments
            like seawater and perspiration. It is harder to machine,
            which is why most of the industry sticks with 316L.
          </Faq>

          <Faq q="What does 'Superlative Chronometer' mean on a Rolex dial?">
            Every modern Rolex is first certified as a chronometer by
            the Contrôle Officiel Suisse des Chronomètres (COSC), which
            guarantees −4/+6 seconds per day movement-only. Rolex then
            cases the movement and runs its own &ldquo;Superlative
            Chronometer&rdquo; test, which tightens the specification
            to an average −2/+2 seconds per day on the fully cased,
            fully wound watch. The five-year international warranty is
            tied to this certification.
          </Faq>

          <Faq q="What is the Parachrom hairspring?">
            Parachrom is Rolex&apos;s paramagnetic hairspring alloy —
            niobium, zirconium and oxygen — introduced in 2000 and
            updated in 2005 to add the characteristic blue oxide
            finish. Compared with traditional ferromagnetic
            hairsprings, it is largely immune to magnetic-field
            disturbance, more stable across temperature swings, and
            reported by Rolex as up to ten times more shock-resistant.
          </Faq>

          <Faq q="What is the Chronergy escapement?">
            A Rolex-designed variant of the Swiss lever escapement,
            introduced in 2015 in the 3235/3255 calibre family and
            later in the 3285 (GMT-Master II). Rolex changes the
            geometry of the pallet and uses a ferromagnetically-neutral
            nickel-phosphorous alloy, yielding approximately 15% higher
            energy efficiency — which contributes to the ~70-hour power
            reserve of modern calibres.
          </Faq>

          <Faq q="How often should a Rolex be serviced?">
            Rolex&apos;s published guidance since 2016 is
            &ldquo;approximately every ten years&rdquo; for modern
            watches under normal use. That is an average. A daily-wear
            watch, especially a diver that sees salt water, benefits
            from earlier attention — many watchmakers suggest every
            5–7 years. Vintage references from before 1990 typically
            want service every 3–5 years. Any sign of moisture under
            the crystal is a reason to stop wearing it and send it in
            immediately.
          </Faq>

          <Faq q="How much does a Rolex service cost in 2026?">
            At Rolex Service Centres in 2026, modern three-hand models
            (Datejust, Explorer, Air-King) run around $660 USD / £550
            GBP; sports models (Submariner, GMT-Master II, Sea-Dweller)
            around $770 USD / £640 GBP; the modern Daytona around $940
            USD / £780 GBP. Classic five-digit and vintage four-digit
            references cost significantly more. Independent watchmakers
            may charge less but do not carry Rolex&apos;s own two-year
            post-service guarantee.
          </Faq>

          <Faq q="Is a Rolex Submariner really safe to dive with?">
            A current Submariner is rated to 300 m (1,000 ft) under
            static lab testing, and Rolex tests each case to +10% of
            that. For recreational scuba diving, that rating has huge
            headroom. The honest caveats: (a) the lab rating is
            static — real-world wrist motion, pressure surges and
            gasket age all reduce the effective margin; (b) the watch
            needs to be pressure-tested at service intervals to keep
            the rating valid; and (c) hot showers and sauna heat
            stress gaskets more than diving does.
          </Faq>

          <Faq q="What size Rolex fits my wrist?">
            Case diameter alone is a weak proxy — lug-to-lug matters
            more. Rough sizing: wrists under 16.5 cm / 6.5 in sit best
            with 36 mm (≈ 44 mm L2L); 7–7.5 in / 17.8–19 cm wrists
            comfortably take either 36 mm or 40–41 mm; above 7.5 in /
            19 cm, 40–41 mm tends to look balanced. Submariner Date is
            41 mm / 47 mm L2L; Daytona is 40 mm / 48 mm L2L; GMT-Master
            II is 40 mm / 47 mm L2L. Try before you buy — proportions
            on paper can mislead.
          </Faq>

          <Faq q="How do I avoid a counterfeit when buying online?">
            The hard truth is that no online check gives certainty.
            Rolex does not operate a public serial-number lookup, and
            modern fakes routinely carry a copied serial from a real
            watch. The reliable test is physical movement inspection
            by a trained watchmaker, which no listing photo can
            replace. Practical risk-reducers: buy from a dealer who
            provides a written authenticity guarantee and a money-back
            return policy; favour Rolex Certified Pre-Owned (two-year
            manufacturer guarantee, authenticated at an authorised
            retailer); request high-resolution photos of the movement,
            case back, rehaut engraving and lugs; and treat
            peer-to-peer platforms (eBay, Craigslist, Facebook
            Marketplace) as high-risk by default.
          </Faq>

          <Faq q="What is the Rolex Certified Pre-Owned programme?">
            Rolex&apos;s Certified Pre-Owned (CPO) programme launched
            in December 2022 — initially at Bucherer boutiques in six
            European countries, expanding to the US with Tourneau in
            May 2023. It authenticates second-hand Rolex watches at
            least three years old, backs them with a new two-year
            international manufacturer guarantee, and presents them
            with CPO-specific packaging and seal. The trade-off versus
            a non-CPO pre-owned purchase is that CPO prices are
            higher, but authentication risk is effectively eliminated.
          </Faq>

          <Faq q="Did Rolex buy Bucherer?">
            Yes. In August 2023, Rolex announced the acquisition of
            Bucherer — one of its largest retail partners — with terms
            undisclosed. Bucherer continues to operate under its own
            brand with its existing management, and Rolex stated that
            the rest of its authorised-retailer network is unaffected.
            The practical consequence is that Rolex now has direct
            retail distribution for the first time in its modern
            history.
          </Faq>

          <Faq q="What is the Rolex waitlist like in 2026?">
            Waitlists remain real in late 2026 but have compressed
            sharply from the 2021–2022 peak. Across most references
            the median authorised-dealer wait is reported at 1–3
            months. The exceptions sit in the sports-steel tier:
            Submariner is reported at 1–3 years, and the Daytona
            remains the longest wait at 5–8 years. Waitlist data is
            self-reported by dealers and buyers, not audited, and
            varies by boutique and by purchase-history relationship
            with the dealer.
          </Faq>

          <Faq q="Are Rolex prices going down?">
            They have moved in both directions. After the 2022 peak,
            the WatchCharts Rolex index declined through 2023 and into
            early 2024 as grey-market supply caught up with demand and
            post-pandemic spending cooled. The market stabilised in
            2024 and ticked up through 2025–2026. Rolex itself raised
            authorised-dealer retail prices by roughly 7% in January
            2026, which compressed the gap between grey-market and
            retail on most references (Daytona excepted). Any statement
            about &ldquo;Rolex prices&rdquo; needs a date and a
            reference — the index behaves very differently from
            individual references, and dealer asking prices behave
            differently from completed sales.
          </Faq>

          <Faq q="Is a Rolex a good investment?">
            Historically, certain references — Submariner, GMT-Master
            II, Daytona most commonly — have appreciated over
            multi-year windows. That history does not guarantee future
            performance. Compared with financial assets, a Rolex
            carries real costs that reduce net return: dealer spreads
            on sale (often 10–20%), service every ~10 years, insurance,
            and the risk of a market correction like 2022–2024. The
            honest framing is that a well-chosen steel Rolex has
            historically held value better than most consumer goods,
            but it is a watch first and a store of value second — not
            an investment vehicle substitute.
          </Faq>

          <Faq q="What are the hidden costs of owning a Rolex?">
            Four items are routinely under-counted by first-time
            buyers:
            <ul>
              <li>
                Rolex Service Centre servicing at ~$660–$940 USD or
                ~£550–£780 GBP per cycle on modern references, roughly
                once per decade.
              </li>
              <li>
                Selling frictions — dealer spreads of 10–20% on resale,
                or auction-house fees around 15–25% buyer&apos;s
                premium.
              </li>
              <li>
                Scheduled valuation and insurance premiums, especially
                if value has moved since purchase.
              </li>
              <li>
                On vintage pieces, the risk that a routine Rolex
                Service Centre polish will reduce value —
                &ldquo;no polish&rdquo; is a request vintage owners
                learn to make.
              </li>
            </ul>
          </Faq>
        </div>
      </section>
    </GuideLayout>
  );
}
