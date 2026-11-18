// src/app/nex-generated/buying-guides/leather-wallets/page.tsx
//
// Leather Wallets Buying Guide · substantial single-scroll editorial
// article. Independent Next content · not affiliated with any wallet
// brand or retailer. Sandbox-only preview surface · noindex at page
// scope.
//
// 2026-11-17 content from evidence/buying-guides/leather-wallets/
// (research-ledger.md + questions.md + draft-content.md).
// Built on shared GuideLayout.

import type * as React from "react";
import {
  Wallet,
  Sparkles,
  Scissors,
  Ruler,
  Shield,
  Clock,
  HelpCircle,
} from "lucide-react";
import { GuideLayout, ImageSlot, Faq } from "../_guide-layout";
import styles from "../_phone-frame.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leather Wallet Buying Guide — Next",
  description:
    "An independent guide to judging a leather wallet on its merits — leather grade, tanning, stitching, edges, RFID shielding, and care. Not affiliated with any wallet brand.",
};

export default async function LeatherWalletsBuyingGuidePage(): Promise<React.JSX.Element> {
  return (
    <GuideLayout
      dataScope="buying-guides-leather-wallets"
      title="Leather Wallets"
      lede={
        <>
          A wallet lives in a pocket, so the material and stitching that
          look great on a product photo have to survive daily flex, card
          friction, body heat and the occasional wet jacket. This guide
          explains how to read the small signals — leather grade, tanning
          type, stitch style, edge finish, RFID claims — so you can judge
          a wallet on its merits rather than on the brand stamped inside.
        </>
      }
      disclaimer={[
        "Editorial reference, not a product review or ranking. No brand endorsements, no affiliate links.",
        "Material claims are drawn from ISO / FTC guidelines, trade-education resources, and peer-reviewed sources on tanning chemistry and RFID. See the research ledger.",
        "RFID discussion reflects how contactless payment cards actually work today; we try not to overstate the threat.",
      ]}
      heroImage={{
        n: 1,
        instruction:
          "Cut-edge close-ups of full-grain, top-grain, split and bonded leather, labelled with the visible fibre layers.",
      }}
      toc={[
        { href: "#leather-grades", label: "Leather grades decoded" },
        { href: "#tanning", label: "Tanning: vegetable vs chrome" },
        { href: "#stitching", label: "Stitching and construction" },
        { href: "#edges", label: "Edge finishing and small signals" },
        { href: "#rfid", label: "RFID shielding — what it does and doesn't" },
        { href: "#care", label: "Care, longevity and end-of-life signs" },
        { href: "#faq", label: "Frequently asked questions" },
        { href: "#for-sellers", label: "For leather-wallet sellers" },
      ]}
      trailingImage={{
        n: 6,
        instruction:
          "Cross-section illustration showing a wallet shell, interior metallised layer, and cards — with annotations on where a 13.56 MHz signal attenuates.",
      }}
      sellerBlock={{
        title: "Are you a leather-wallet seller?",
        body: (
          <>
            Listing leather wallets on Nex? Buyers who&apos;ve read a
            guide like this look for specifics: leather grade, tanning
            type, stitch style and SPI, edge finish, and an honest RFID
            claim. Create your shop and describe wallets the way the
            research ledger describes them.
          </>
        ),
      }}
      footerText="Next · Independent buying guide · preview build · not affiliated with any wallet brand, retailer, or authentication service."
    >
      {/* ─────────── Section 1: Leather grades ─────────── */}
      <section id="leather-grades" aria-labelledby="leather-grades-heading">
        <h2 id="leather-grades-heading">
          <Wallet aria-hidden="true" className={styles.sectionIcon} />
          Leather grades decoded
        </h2>
        <p>
          Leather grade is about <em>which layer of the hide</em> you are
          holding. In a wallet, that layer is under constant small-radius
          flex at the spine, friction at every card slot, and pocket
          pressure against your hip — so grade matters more than on a bag
          panel that just hangs.
        </p>
        <ul>
          <li>
            <strong>Full-grain</strong>: the outermost surface of the
            hide, untouched. The fibre structure is at its densest right
            at the surface — the layer your fingers rub. Patinas rather
            than peels. Best choice if you want the wallet to age with
            you.
          </li>
          <li>
            <strong>Top-grain</strong>: the top layer, lightly sanded and
            often embossed with a uniform grain pattern. Slightly less
            durable than full-grain because the toughest micro-layer has
            been abraded away. Still a sound wallet material.
          </li>
          <li>
            <strong>Corrected-grain</strong>: heavily sanded top layer
            with an embossed grain and a pigment coating. Looks uniform
            but the coating can crack along the bifold crease over years.
            Fine on a flat cardholder; less forgiving on a deep bifold.
          </li>
          <li>
            <strong>Genuine leather</strong>: a labelling category under
            FTC/ISO, not a quality grade — it only means the product
            contains real leather. Often applied to splits or heavily
            corrected hides. Read it as the floor, not a feature.
          </li>
          <li>
            <strong>Split</strong>: the lower horizontal layer with no
            natural grain. Usually coated with a polymer finish and
            embossed. Acceptable for internal panels; weak choice for
            outer surfaces that flex.
          </li>
          <li>
            <strong>Bonded leather</strong>: shredded leather fibre bound
            with polyurethane and rolled into sheets. FTC guides require
            the leather content percentage to be disclosed. It
            delaminates and flakes at folds — avoid in a wallet.
          </li>
          <li>
            <strong>Patent leather</strong>: a glossy polymer coating over
            leather. Water-resistant but the coating is prone to visible
            crease marks and cannot be refinished at home.
          </li>
          <li>
            <strong>Suede</strong>: a split with a raised nap on the
            flesh side. Stains visibly from pocket oils.
          </li>
          <li>
            <strong>Nubuck</strong>: top-grain lightly buffed on the
            grain side. Stronger than suede but still vulnerable to
            darkening from skin oils.
          </li>
          <li>
            <strong>Vegan / PU / &ldquo;plant-based&rdquo; leathers</strong>:
            polyurethane sheets, sometimes with cactus, mushroom,
            pineapple or apple fibre content. Often reasonable for a few
            years of use, but PU hydrolyses over time and typically
            cracks at fold points earlier than quality leather.
            Independent longevity data on newer bio-based composites is
            limited.
          </li>
        </ul>
        <p>
          <em>Context note</em>: a handbag&apos;s leather is judged
          partly on structure and strap load. A wallet&apos;s leather is
          judged on daily flex at a tight fold radius, friction from card
          edges, and whether it patinas or peels after a few years of
          pocket life. Even the same hide can suit one purpose and not
          the other.
        </p>
      </section>

      {/* ─────────── Section 2: Tanning ─────────── */}
      <section id="tanning" aria-labelledby="tanning-heading">
        <h2 id="tanning-heading">
          <Sparkles aria-hidden="true" className={styles.sectionIcon} />
          Tanning: vegetable vs chrome
        </h2>
        <p>
          Tanning is the chemistry that turns a hide into leather. Two
          main systems dominate wallet manufacture.
        </p>
        <ul>
          <li>
            <strong>Vegetable-tanned</strong> uses plant tannins (oak,
            chestnut, mimosa). Produces a firmer, warm-toned leather that
            darkens and polishes with handling — the patina people
            associate with craft wallets. Water will mark it; direct heat
            will crack it; daylight will tan it further.
          </li>
          <li>
            <strong>Chrome-tanned</strong> uses chromium(III) salts.
            Produces a softer, more uniformly dyed leather that tolerates
            damp and flex better. Holds bright colours. Patinas less
            dramatically.
          </li>
          <li>
            <strong>Combination / retan</strong> leathers start one way
            and are retanned with the other system; many
            &ldquo;pull-up&rdquo; and &ldquo;waxed&rdquo; wallet leathers
            are combination tans.
          </li>
        </ul>
        <p>
          Environmental trade-offs are real but nuanced. Chromium(III)
          tanning is efficient and the fixed chromium in finished leather
          is biologically inert, but tannery effluent management matters
          — this is what Leather Working Group audits grade tanneries on.
          Vegetable tanning is slower and uses natural tannins but
          requires more water and time. Neither is automatically
          &ldquo;green&rdquo;; the tannery&apos;s actual practices and
          certifications are what to look for.
        </p>

        <ImageSlot
          n={2}
          instruction="A six-month-old and a three-year-old veg-tan cardholder side by side, same model, showing how patina develops with handling."
        />
      </section>

      {/* ─────────── Section 3: Stitching ─────────── */}
      <section id="stitching" aria-labelledby="stitching-heading">
        <h2 id="stitching-heading">
          <Scissors aria-hidden="true" className={styles.sectionIcon} />
          Stitching and construction — stress points that fail first
        </h2>
        <p>
          A wallet&apos;s stitch line is the chassis. Two things
          determine how long it holds.
        </p>
        <ul>
          <li>
            <strong>Stitch type.</strong> Machine lock-stitch uses one
            top thread and one bobbin thread looped together — fast and
            strong, but if the bobbin thread breaks the row can unravel
            progressively. Saddle stitch uses two needles, one on each
            side, passing through each hole independently — if one stitch
            breaks, the stitches either side are still knotted.
            Hand-saddle-stitched wallets cost more for this reason;
            machine-stitched wallets are not bad, they just rely on
            thread integrity more.
          </li>
          <li>
            <strong>Stitches per inch (SPI).</strong> Typical wallet work
            falls between 7 and 12 SPI. Very low SPI on thin leather
            leaves visible thread floating between holes; very high SPI
            on thick leather weakens the panel like a perforation line.
            Density should suit the leather weight.
          </li>
        </ul>

        <h3>Stress points worth inspecting</h3>
        <ol>
          <li>
            <strong>Card-slot ends.</strong> The top corners of each card
            pocket take the most wear. Look for a short run of
            backstitching or a reinforcement stitch there. If stitches
            end flush at the edge with no backtrack, they can start to
            unravel after a year.
          </li>
          <li>
            <strong>The fold crease (bifold spine).</strong> A very thick
            panel stitched tightly at the spine stresses the stitch holes
            every open/close cycle. Some makers skive the leather thinner
            at the fold, which reduces this stress.
          </li>
          <li>
            <strong>Zip tape on zip-arounds.</strong> The zip itself is
            often not the weak point — it&apos;s the row of stitches
            attaching the zip tape to the leather. Dense, even stitching
            with no visible puckering is what you want.
          </li>
          <li>
            <strong>Interior welt / gusset seams.</strong> If a bifold
            has an internal gusset (common on long wallets), that seam
            carries the load when the wallet is loaded with cards and
            cash.
          </li>
        </ol>
        <p>
          <strong>Card-pocket construction</strong> matters too.
          &ldquo;Skived&rdquo; means the pocket leather has been thinned
          at the edge where it meets the shell — this reduces bulk but,
          if over-skived, can tear. &ldquo;Folded&rdquo; (turned-edge)
          pockets are thicker but hide stress from view. Neither is
          strictly better; what matters is whether the skive is even and
          the stitching tracks straight.
        </p>

        <ImageSlot
          n={3}
          instruction="Interior macro of a saddle-stitched bifold, arrow pointing to the backstitched corner where the card slot meets the shell."
        />
      </section>

      {/* ─────────── Section 4: Edges ─────────── */}
      <section id="edges" aria-labelledby="edges-heading">
        <h2 id="edges-heading">
          <Ruler aria-hidden="true" className={styles.sectionIcon} />
          Edge finishing and the small signals of quality
        </h2>
        <p>
          Edges reveal more about a wallet&apos;s build than almost any
          other detail.
        </p>
        <ul>
          <li>
            <strong>Burnished edges</strong> are the leather itself,
            compressed with gum tragacanth or beeswax and polished with a
            slicker until smooth. You can see the fibre layers continuing
            right to the edge. Common on veg-tan. Over years they can
            dry out — a small amount of beeswax paste restores them.
          </li>
          <li>
            <strong>Painted edges</strong> are a coat of acrylic or
            polyurethane edge paint, sometimes several layers sanded
            between coats. Common on chrome-tan and on mass-market
            wallets. When well done they are flawless; when poorly done
            they chip, revealing a raw leather edge underneath.
          </li>
          <li>
            <strong>Raw / cut edges</strong> are left exposed, sometimes
            sealed with a thin wax. Common on craft wallets where the
            aesthetic is deliberately honest. Easy to inspect: the
            leather should look dense, not spongy.
          </li>
          <li>
            <strong>Turned edges</strong> fold the leather back onto
            itself and stitch inside, so no cut edge shows. Common on
            dressy bifolds and long wallets. The downside is you cannot
            see what is happening at the fold — trust the stitch quality
            elsewhere.
          </li>
        </ul>
        <p>
          What to look for in person: consistent edge thickness along the
          whole panel, no gaps between stitched panels at the corners,
          and — on painted edges — no visible rings, bubbles or sag at
          the bottom of the wallet where paint would have pooled during
          drying.
        </p>

        <ImageSlot
          n={4}
          instruction="Macro comparison: burnished edge, painted edge, raw edge, turned edge — same wallet thickness, same angle."
        />
      </section>

      {/* ─────────── Section 5: RFID ─────────── */}
      <section id="rfid" aria-labelledby="rfid-heading">
        <h2 id="rfid-heading">
          <Shield aria-hidden="true" className={styles.sectionIcon} />
          RFID shielding — what it does and doesn&apos;t do
        </h2>
        <p>
          Many wallets advertise RFID protection. Here is the honest
          version.
        </p>
        <ul>
          <li>
            Contactless payment cards use the 13.56 MHz ISO/IEC 14443
            standard. A metallised fabric or thin metal layer in a wallet
            does attenuate that frequency.
          </li>
          <li>
            <strong>However</strong>, modern contactless EMV cards
            generate a one-time cryptogram for each transaction. An
            attacker who passively intercepts your card&apos;s radio
            emissions cannot replay them to make a fraudulent purchase.
            This is why reported contactless fraud rates are low relative
            to magnetic-stripe cloning.
          </li>
          <li>
            Where RFID shielding is genuinely useful:{" "}
            <strong>
              access control cards, transit cards and some corporate ID
              cards
            </strong>{" "}
            often use older or weaker authentication, where a copied card
            number is actually usable.
          </li>
          <li>
            It is also useful to prevent <strong>accidental
            double-reads</strong> at payment terminals when you hold your
            whole wallet up and two cards are within range.
          </li>
          <li>
            <strong>Relay attacks</strong> are a real academic topic but
            require specialised hardware and proximity to the card. A
            shielded wallet does defeat the card-side half of a relay.
          </li>
        </ul>
        <p>
          So: shielding isn&apos;t snake oil, but a shielded wallet is
          not the single security upgrade some marketing suggests. For
          EMV payment cards alone the cryptographic protections already
          do most of the work.
        </p>
      </section>

      {/* ─────────── Section 6: Care ─────────── */}
      <section id="care" aria-labelledby="care-heading">
        <h2 id="care-heading">
          <Clock aria-hidden="true" className={styles.sectionIcon} />
          Care, longevity and end-of-life signs
        </h2>
        <ul>
          <li>
            <strong>Break-in</strong>: just use it. Chrome-tan softens in
            weeks, firm veg-tan in a few months. Avoid soaking or heavy
            conditioning on day one.
          </li>
          <li>
            <strong>Conditioning</strong>: a light application of a
            neutral leather conditioner one to three times a year is
            enough for most wallets. Over-conditioning darkens leather
            permanently and softens it beyond its design.
          </li>
          <li>
            <strong>Wet wallet</strong>: blot with a cloth, open flat,
            remove cards, dry away from direct heat. Heat shrinks
            collagen and causes cracking.
          </li>
          <li>
            <strong>Cleaning</strong>: a barely damp cloth with
            pH-neutral soap. Skip baby wipes, alcohol and (on finished
            leathers) saddle soap — they can strip dye. Suede and nubuck
            need a dedicated brush, not water.
          </li>
          <li>
            <strong>End of life</strong> looks like: flaking surface at
            the fold (most common on corrected-grain or PU), stitching
            broken on more than one card slot, edge paint chipping away
            revealing untreated leather, or card slots that no longer
            grip.
          </li>
          <li>
            <strong>Repair vs replace</strong>: restitching and re-edging
            a quality full-grain wallet is viable and often economical.
            Delaminating PU or flaking bonded leather generally cannot be
            fixed.
          </li>
        </ul>
        <p>
          <strong>Generic authenticity notes</strong>: real leather at a
          cut edge shows fibrous layers; PU shows a foam-like
          cross-section. Real leather carries a faint organic smell; PU
          often smells faintly chemical. Under FTC and UK consumer
          protection rules, misleading material labels are prohibited —
          so always read the fibre label. We do not publish
          brand-specific counterfeit guides.
        </p>

        <ImageSlot
          n={5}
          instruction="Macro of a wallet fold crease on a three-year-old corrected-grain wallet showing early surface flaking, alongside the same spot on a well-cared-for full-grain wallet."
        />
      </section>

      {/* ─────────── Section 7: FAQ ─────────── */}
      <section id="faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading">
          <HelpCircle aria-hidden="true" className={styles.sectionIcon} />
          Frequently asked questions
        </h2>
        <p>
          Short, neutral answers to the questions readers most often ask
          when choosing a leather wallet.
        </p>

        <div className={styles.faq}>
          <Faq q="Is full-grain always worth the premium?">
            For a daily wallet you expect to carry for years, usually yes
            — the fibre at the surface is the densest and most
            abrasion-resistant part of the hide. For a secondary or
            travel wallet, top-grain or a good combination tan is plenty.
          </Faq>

          <Faq q="Is 'genuine leather' the same as fake?">
            No. &ldquo;Genuine leather&rdquo; under FTC/ISO vocabulary
            means real leather, but it is a floor claim — often applied
            to splits or corrected-grain. It is not, by itself, a mark
            of quality.
          </Faq>

          <Faq q="Should I buy an RFID wallet?">
            If you carry access cards, transit cards or ID cards, yes.
            If you only carry EMV payment cards, it is a belt-and-braces
            measure — the cards themselves already protect against
            replay fraud.
          </Faq>

          <Faq q="How often should I condition it?">
            One to three times a year for most wallets. Chrome-tan needs
            less than veg-tan. More is not better.
          </Faq>

          <Faq q="Why did my new wallet stain my cards?">
            Freshly dyed or over-conditioned leather can transfer colour
            onto adjacent surfaces until it fully sets. Wipe the cards
            with a dry cloth and let the wallet air for a few days. The
            transfer usually stops.
          </Faq>

          <Faq q="My bifold creaks — is that bad?">
            Creaking is common on firm veg-tan and usually quiets as the
            leather breaks in. Persistent creaking on chrome-tan can
            indicate the lining and shell are debonding — inspect for a
            visible gap.
          </Faq>

          <Faq q="Can I machine-wash a leather wallet?">
            No. Water, agitation and detergent all attack leather.
            Spot-clean with a barely damp cloth.
          </Faq>

          <Faq q="What's the difference between burnished and painted edges?">
            Burnished edges are the leather itself, compressed and
            polished. Painted edges are a coat of acrylic or polyurethane
            on top of the edge. Either can be done well; the failure
            modes differ.
          </Faq>

          <Faq q="Why does patina darken unevenly?">
            UV, skin oils and air exposure all darken veg-tan, and they
            don&apos;t hit the wallet evenly. Rotating how you carry it
            evens things out over time.
          </Faq>

          <Faq q="How many cards should I carry in a bifold?">
            Enough that the slots grip but the wallet still closes flat.
            Chronically overstuffing distorts the slot leather and
            strains the spine stitching.
          </Faq>

          <Faq q="Is thicker leather always more durable?">
            No. 1.0–1.6 mm (roughly 2.5–4 oz) is typical for a reason.
            Thicker adds bulk and strains its own fold stitching.
          </Faq>

          <Faq q="When should I replace it?">
            When the surface is flaking along the fold, multiple slot
            stitches have failed, or the edge paint is chipping off onto
            your cards. Earlier than that is a repair question, not a
            replacement one.
          </Faq>
        </div>
      </section>
    </GuideLayout>
  );
}
