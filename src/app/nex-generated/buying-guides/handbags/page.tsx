// src/app/nex-generated/buying-guides/handbags/page.tsx
//
// Handbags Buying Guide · how to judge handbag quality independently
// of brand. Independent Next content · not affiliated with any bag
// maker. Sandbox-only preview surface · noindex at page scope.
//
// 2026-11-17 content from evidence/buying-guides/handbags/
// (research-ledger.md + questions.md + draft-content.md).
// 2026-11-17 refactor: rebuilt on shared GuideLayout.
//
// Routed under /nex-generated/buying-guides/handbags because
// `handbags` is not itself a Nex taxonomy node — the closest parent
// is `bags_luggage` under `fashion_clothing` in the sealed
// departments.ts taxonomy. The manifest's categoryGroupId is
// `bags_luggage` so the index groups it under Bags & Luggage.

import type * as React from "react";
import {
  ShieldCheck,
  Package,
  Scissors,
  Settings,
  Shield,
  HelpCircle,
} from "lucide-react";
import { GuideLayout, ImageSlot, Faq } from "../_guide-layout";
import styles from "../_phone-frame.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Handbag Buying Guide — Next",
  description:
    "An independent guide to judging handbag quality at any price — leather types, construction, stitching, hardware, lining, and generic advice on counterfeits and pre-owned. Not affiliated with any brand.",
};

export default async function HandbagsBuyingGuidePage(): Promise<React.JSX.Element> {
  return (
    <GuideLayout
      dataScope="buying-guides-handbags"
      title="Handbags"
      lede={
        <>
          A handbag is one of the few accessories most people carry every
          day, in all weather, loaded with the weight of a life. The
          difference between a bag that still looks good in five years
          and one that peels in five months is not the logo on the front
          — it is in the grain of the leather, the density of the
          stitching, and the brass inside the strap anchor.
        </>
      }
      disclaimer={[
        "Editorially independent. No brand has paid for inclusion or sponsored any wording on this page.",
        "Not a counterfeit authentication service. Generic red flags are discussed for self-protection; brand-specific authentication requires qualified specialists.",
        "Prices, trends and brand rankings are deliberately omitted. This is a how-to-judge guide, not a how-to-shop list.",
      ]}
      heroImage={{
        n: 1,
        instruction:
          "Square 1:1. Close-up of a full-grain leather panel next to a corrected top-grain panel, showing the difference between natural pore structure and an embossed uniform surface. Daylight, matte background.",
      }}
      toc={[
        { href: "#what-quality-means", label: "What quality actually means" },
        { href: "#leather-and-materials", label: "Leather & materials" },
        {
          href: "#construction-and-stitching",
          label: "Construction & stitching",
        },
        {
          href: "#hardware-zippers-lining",
          label: "Hardware, zippers & lining",
        },
        { href: "#fakes-and-pre-owned", label: "Fakes & pre-owned" },
        { href: "#faq", label: "Frequently asked questions" },
        { href: "#for-sellers", label: "For bag makers & sellers" },
      ]}
      trailingImage={{
        n: 6,
        instruction:
          "Square 1:1. Base corner of a used bag showing honest patina versus a second corner showing material failure (peeling bonded leather) — the two corners captioned together to contrast wear and defect.",
      }}
      sellerBlock={{
        title: "Make or sell handbags?",
        body: (
          <>
            List clear specifications — leather grade and tannage,
            hardware material, zipper brand, lining — on your Nex shop.
            Buyers who&apos;ve read a guide like this one are looking for
            exactly those facts.
          </>
        ),
      }}
      footerText="Next · Independent buying guide · preview build · not affiliated with any bag maker or retailer. Last reviewed: 2026-11-17."
    >
      {/* ─────────── Section 1: What quality means ─────────── */}
      <section
        id="what-quality-means"
        aria-labelledby="what-quality-means-heading"
      >
        <h2 id="what-quality-means-heading">
          <ShieldCheck aria-hidden="true" className={styles.sectionIcon} />
          What &ldquo;quality&rdquo; actually means in a handbag
        </h2>
        <p>
          Handbag &ldquo;quality&rdquo; is not one property; it is a
          stack of decisions a maker takes, from hide selection to the
          last stitch on the lining. A luxury name on the front
          doesn&apos;t guarantee any of them, and a modest price
          doesn&apos;t preclude them. The useful skill is learning to
          inspect the stack directly.
        </p>
        <p>
          A well-made bag carries weight predictably, closes cleanly,
          ages without falling apart, and can usually be repaired rather
          than discarded. Everything else — colour, silhouette, branding
          — is personal taste layered on top of that structural core.
        </p>

        <h3>Four honest tests to run on any bag</h3>
        <ul>
          <li>
            <strong>Load and lift test.</strong> Fill the bag with what
            you actually carry (roughly 1.5–2 kg for an everyday bag).
            Watch how the handles meet the body — do they fold neatly or
            does the leather around the attachment pucker? A bag should
            move under load, not fight it.
          </li>
          <li>
            <strong>Seam test.</strong> Run a thumbnail along each major
            seam. Stitching should be straight, evenly spaced, with no
            loose thread tails. Back-stitching at stress points (handle
            base, strap D-ring, zipper ends) should be visible as a
            short run of reverse stitches locking the seam.
          </li>
          <li>
            <strong>Edge test.</strong> Look at every raw edge. It should
            be either neatly turned under or coated in built-up, polished
            edge paint. A single thin layer of paint that chips to a
            nail is a short-life finish.
          </li>
          <li>
            <strong>Corner test.</strong> Check the base corners inside
            and out. Corners are where loaded bags fail first — look for
            reinforcement, extra stitching, or a sewn-in base panel.
          </li>
        </ul>

        <h3>The three places quality shows up first</h3>
        <ul>
          <li>
            The <strong>interior</strong> — lining stitching, pocket
            construction, base reinforcement — is where cost-cutting
            tends to show first, because buyers rarely look.
          </li>
          <li>
            The <strong>underside of the strap</strong> — glued seams,
            raw edges, exposed thread ends — is where strap longevity is
            decided.
          </li>
          <li>
            The <strong>hardware attachment points</strong> — the small
            brass or alloy plate where a handle meets the bag — is where
            an otherwise good bag can fail in year two.
          </li>
        </ul>
      </section>

      {/* ─────────── Section 2: Leather & materials ─────────── */}
      <section
        id="leather-and-materials"
        aria-labelledby="leather-and-materials-heading"
      >
        <h2 id="leather-and-materials-heading">
          <Package aria-hidden="true" className={styles.sectionIcon} />
          Leather types and material categories
        </h2>
        <p>
          Handbags work the leather harder than most leather goods — more
          surface area, bigger panels, more flex under load, more
          exposure to weather. The grading language is the same used
          elsewhere in leather goods, but the structural demands on a
          bag mean the trade-offs land differently: a hide that is
          beautiful in a pocket wallet may be too soft to hold a
          bag&apos;s shape, or too stiff to drape over the shoulder.
        </p>
        <p>
          Below is the practical hierarchy as a bag buyer should read
          it, with the caveat that <em>tannage</em> and <em>finish</em>{" "}
          matter as much as grade.
        </p>

        <h3>Real leather grades</h3>
        <ul>
          <li>
            <strong>Full-grain leather</strong> — the outermost layer of
            the hide, unsanded, with natural pores and markings intact.
            Resists tearing well because the dense top fibres are
            preserved. Breaks in rather than wearing out; develops
            patina. Small natural marks are character, not defects.
          </li>
          <li>
            <strong>Top-grain leather</strong> — the outermost layer, but
            lightly sanded and surface-corrected for uniformity, then
            finished with a coating or embossing. More scratch-resistant
            than full-grain and more consistent panel-to-panel; slightly
            less fibre strength. Standard for mid-range structured bags.
          </li>
          <li>
            <strong>Split leather</strong> — the lower layer of a hide
            after the top layer has been separated off. Weaker fibres,
            often finished with heavy coating or embossing to imitate
            top-grain. Reasonable as a lining or in low-stress panels;
            not ideal for strap or handle use.
          </li>
          <li>
            <strong>&ldquo;Genuine leather&rdquo;</strong> — a legal
            catch-all for any real leather, which in handbag practice
            often means a corrected split with a polyurethane finish.
            Not a quality signal on its own.
          </li>
          <li>
            <strong>Bonded leather</strong> — shredded leather scrap
            mixed with PU binder and pressed onto a backing. Contains
            leather but behaves like a laminate. Expect peeling at flex
            points within one to three years. Acceptable for interior
            panels on short-life bags; not a structural material.
          </li>
        </ul>

        <h3>Non-leather categories</h3>
        <ul>
          <li>
            <strong>Polyurethane (PU)</strong> — the most common
            synthetic. A PU coating on a woven fabric backing, often
            polyester or cotton. Quality varies by coating thickness,
            backing density, and plasticiser mix. Good PU on a dense
            backing outperforms bad leather for daily hard use; bad PU
            cracks and peels.
          </li>
          <li>
            <strong>PVC</strong> — still used in budget and in some
            glossy &ldquo;patent&rdquo; finishes. Stiffer, less
            breathable, more prone to cracking in cold.
          </li>
          <li>
            <strong>Bio-based alternatives</strong> — mushroom mycelium,
            cactus leaf, pineapple leaf, apple-skin composites. Still a
            developing category; most on the market are hybrids with PU
            coatings. Ask what the backing and binder are.
          </li>
          <li>
            <strong>Recycled synthetics</strong> — PU or polyester
            reclaimed from post-industrial or post-consumer streams.
            Performance similar to virgin PU; the environmental case is
            in the sourcing, not the hand feel.
          </li>
          <li>
            <strong>Fabric bags</strong> (canvas, waxed cotton, nylon,
            recycled nylon) — judged differently: look at thread count,
            coating treatment, and whether the fabric is reinforced at
            handles and corners.
          </li>
        </ul>

        <h3>Tannage — what to ask</h3>
        <ul>
          <li>
            <strong>Chrome-tanned leather</strong> is soft, colour-stable,
            water-resistant and dominant in handbag use. Finished well,
            it is unproblematic; cheap chrome imports can carry residues
            regulated under REACH in Europe.
          </li>
          <li>
            <strong>Vegetable-tanned leather</strong> is firmer and
            develops richer patina. Traditional in structured,
            saddle-style bags. It marks easily with water and darkens in
            sunlight — worth it to some buyers, a frustration to others.
          </li>
          <li>
            <strong>Combination tannages</strong> (chrome-retanned with
            veg extracts) are common in bags that need both softness and
            shape retention.
          </li>
        </ul>

        <ImageSlot
          n={2}
          instruction="Square 1:1. Side-by-side of a turned-edge strap and a cut-edge strap with built-up edge paint, both finished to a high standard but using different construction languages. Macro lens preferred."
        />
      </section>

      {/* ─────────── Section 3: Construction & stitching ─────────── */}
      <section
        id="construction-and-stitching"
        aria-labelledby="construction-and-stitching-heading"
      >
        <h2 id="construction-and-stitching-heading">
          <Scissors aria-hidden="true" className={styles.sectionIcon} />
          Construction and stitching
        </h2>
        <p>
          Construction is where a bag earns the right to be judged on
          its materials. A beautiful hide, cut carelessly and stitched
          sparsely, will fail before a modest material assembled
          properly.
        </p>
        <p>
          Most of what follows is visible in a thirty-second inspection,
          if you know where to look. You do not need to be a
          leatherworker to see whether a bag was made by one.
        </p>

        <h3>Stitching</h3>
        <ul>
          <li>
            <strong>Stitches per inch (SPI).</strong> Most quality
            handbags run 6–10 SPI on main seams. Density matters less
            than evenness: look for consistent spacing, straight lines,
            no skipped or doubled stitches.
          </li>
          <li>
            <strong>Thread.</strong> Bonded nylon and polyester threads
            dominate; well-made bags use thread thick enough to match
            the leather weight. Thin thread on heavy leather is a
            short-life combination.
          </li>
          <li>
            <strong>Back-stitching at stress points.</strong> At the
            start and end of every seam, and especially at handle
            anchors and zipper ends, a short reverse run locks the
            seam. Its absence is a warning sign.
          </li>
          <li>
            <strong>Saddle stitch vs machine lock-stitch.</strong> Saddle
            stitch (hand-sewn, two needles) will not unravel if one
            thread breaks and is the mark of bench-level work. Machine
            lock-stitch is the industry norm and is perfectly good —
            look for tension and evenness rather than the technique.
          </li>
        </ul>

        <h3>Edges</h3>
        <ul>
          <li>
            <strong>Turned edge (folded).</strong> The material is skived
            thinner at the border, folded under, and stitched, hiding
            the raw edge. Clean, European, common on structured
            calfskin bags. More labour.
          </li>
          <li>
            <strong>Cut edge.</strong> Raw edge exposed, then either
            burnished smooth (traditional for veg-tan) or built up with
            multiple thin layers of edge paint that are heat-set and
            polished.
          </li>
          <li>
            <strong>Red flags.</strong> Edge paint that is a single
            thick layer; edge paint that beads away from the leather;
            cut edges with no finish at all; turned edges where the
            fold bulges because the leather wasn&apos;t skived.
          </li>
        </ul>

        <h3>Panels and shape</h3>
        <ul>
          <li>
            <strong>Skiving.</strong> Thinning the leather at folds and
            overlaps so joins lie flat. Where skipped, you&apos;ll see
            lumpy seams and strap fittings sitting at an angle.
          </li>
          <li>
            <strong>Base reinforcement.</strong> A stiffening board —
            ideally a dense cardboard or plastic composite — that keeps
            the bag&apos;s base flat. Thin, flimsy base boards collapse
            under load within months.
          </li>
          <li>
            <strong>French seams and box stitching.</strong> French
            seams enclose the raw edge inside the seam itself; box
            stitching reinforces rectangular panels at corners. Both are
            signs of a maker thinking past the first wash of use.
          </li>
        </ul>

        <h3>Handle and strap attachment</h3>
        <ul>
          <li>
            <strong>Stitched reinforcement patch + rivet/plate.</strong>{" "}
            The most durable everyday setup — load is spread across an
            area, not a single point.
          </li>
          <li>
            <strong>D-ring with captive bar.</strong> Reliable when the
            ring is solid metal and the surrounding leather is
            reinforced.
          </li>
          <li>
            <strong>Single-rivet or single-stitch attachment.</strong>{" "}
            The common failure point on budget bags. The bag may work
            for a season; it will not take a full shoulder load for
            years.
          </li>
        </ul>

        <ImageSlot
          n={3}
          instruction="Square 1:1. Macro of consistent machine lock-stitching at roughly 8 SPI with visible back-stitching at a strap anchor. Light raking across the stitches to make them readable."
        />
      </section>

      {/* ─────────── Section 4: Hardware / zippers / lining ─────────── */}
      <section
        id="hardware-zippers-lining"
        aria-labelledby="hardware-zippers-lining-heading"
      >
        <h2 id="hardware-zippers-lining-heading">
          <Settings aria-hidden="true" className={styles.sectionIcon} />
          Hardware, zippers and lining
        </h2>
        <p>
          Hardware is the most mechanical part of a handbag — zippers
          cycle thousands of times, clasps thousands more, D-rings pivot
          under load. These are the components most likely to fail in
          the second and third year of use.
        </p>
        <p>
          Lining, meanwhile, is where cost-cutting shows up first,
          because buyers tend to look at the outside of a bag and
          inspect the inside only after they&apos;ve bought it.
        </p>

        <h3>Hardware</h3>
        <ul>
          <li>
            <strong>Solid vs plated.</strong> Solid brass or zinc alloy
            hardware tends to be heavier and hold plating longer. Hollow
            plated hardware is lighter and flakes sooner at edges and
            contact points. A light tap on the main ring or buckle
            gives you a feel for the difference.
          </li>
          <li>
            <strong>Plating quality.</strong> Thick, smooth plating with
            no visible casting lines indicates finishing work. Rough
            edges inside screw heads, beads of plating pooled at
            corners, or logos that read slightly off-centre are signs
            of rushed production.
          </li>
          <li>
            <strong>Weight vs load.</strong> Heavier hardware is not
            always better — it also stresses the leather and stitches
            around its attachment. Judge weight relative to what is
            being anchored.
          </li>
        </ul>

        <h3>Zippers</h3>
        <ul>
          <li>
            <strong>Baseline.</strong> YKK is the global standard and a
            reasonable minimum across price points. A smoothly running
            YKK zipper is not a luxury marker but it is a reliability
            marker.
          </li>
          <li>
            <strong>Premium.</strong> Italian makers Riri and Lampo are
            frequently specified on higher-end bags for tighter
            tolerances and decorative plating options.
          </li>
          <li>
            <strong>What to feel.</strong> The pull should slide without
            catching, the teeth should seat without gaps, the pull
            itself should sit square and not wobble on the slider.
          </li>
          <li>
            <strong>Red flags.</strong> Grit in the action on a new bag,
            misaligned teeth, slider that opens when pulled sideways,
            zipper tape stitched in crooked.
          </li>
        </ul>

        <h3>Lining</h3>
        <ul>
          <li>
            <strong>Bagged lining.</strong> Sewn into the outer seams;
            the lining becomes part of the bag&apos;s structure. Clean,
            durable, hard to replace if it ever tears.
          </li>
          <li>
            <strong>Free-hanging lining.</strong> A separate pouch
            attached at the top edge only. You can lift it and inspect
            the inside of the outer shell. Common on higher-end leather
            bags because it lets the outer hide move naturally and makes
            lining replacement possible.
          </li>
          <li>
            <strong>Materials.</strong> Tightly woven cottons, microfibre
            suedes, and dense polyester twills perform well. Thin
            acetate tears at the seams; loosely woven cotton pills and
            fuzzes quickly.
          </li>
          <li>
            <strong>Seam check.</strong> Lift the lining where allowed
            and look at the seams — glued lining, exposed raw edges, or
            lining that doesn&apos;t quite reach the seam allowance are
            all cost-cutting markers.
          </li>
        </ul>

        <ImageSlot
          n={4}
          instruction="Square 1:1. Interior shot showing a free-hanging lining lifted to reveal the inside of the outer leather shell. Lighting should let the seam allowance be visible at the lifted edge."
        />
      </section>

      {/* ─────────── Section 5: Fakes & pre-owned ─────────── */}
      <section
        id="fakes-and-pre-owned"
        aria-labelledby="fakes-and-pre-owned-heading"
      >
        <h2 id="fakes-and-pre-owned-heading">
          <Shield aria-hidden="true" className={styles.sectionIcon} />
          Spotting fakes and buying pre-owned
        </h2>
        <p>
          This section is deliberately generic. Brand-specific
          authentication requires specialists with access to
          current-season reference materials; what follows is a list of
          self-protection red flags any buyer can apply.
        </p>
        <p>
          Pre-owned, bought carefully, is often better value than a new
          low-quality bag. The key is knowing which failure points you
          are inheriting.
        </p>

        <h3>Generic counterfeit red flags</h3>
        <ul>
          <li>
            <strong>Stitching discrepancies.</strong> Misaligned rows,
            inconsistent SPI, loose thread ends, obviously different
            stitch quality on the interior versus the exterior.
          </li>
          <li>
            <strong>Hardware weight and finish.</strong> Lightweight
            metal where the original bag would be heavy; plating that
            flakes at corners; logos slightly off-centre, slightly
            off-font, or stamped shallow.
          </li>
          <li>
            <strong>Lining mismatch.</strong> The quality of the lining
            fabric doesn&apos;t match the implied tier of the exterior;
            lining seams finished to a visibly lower standard.
          </li>
          <li>
            <strong>Smell.</strong> Strong chemical odour that
            doesn&apos;t fade after a week of airing — a signal of cheap
            coatings or poorly rinsed tannage.
          </li>
          <li>
            <strong>Packaging and documentation.</strong> Mismatched
            fonts on tags, poorly printed authenticity cards,
            misspellings. Note: real bags are occasionally sold without
            original packaging, so missing boxes are not themselves a
            red flag — mismatched or wrong-era packaging is.
          </li>
          <li>
            <strong>Price that doesn&apos;t make sense.</strong> A
            material-and-labour price floor exists for any bag. A deeply
            discounted &ldquo;luxury&rdquo; bag through a private
            channel is overwhelmingly likely to be either counterfeit or
            stolen.
          </li>
        </ul>

        <h3>Buying pre-owned</h3>
        <ul>
          <li>
            <strong>Buy from a trader where possible.</strong> Under UK
            and EU law, purchases from traders carry stronger
            consumer-rights protections than purchases from private
            sellers. Traders usually offer a returns window; private
            sales typically do not.
          </li>
          <li>
            <strong>Inspect the failure points.</strong> Handles
            (especially where they attach), base corners, interior
            lining at the seams, zipper action end-to-end. These are
            the places a bag ages first.
          </li>
          <li>
            <strong>Ask about repair history.</strong> A re-stitched
            handle or replaced lining is not a defect — it&apos;s
            maintenance. A bag never touched in ten years can hide
            fatigue damage that is about to appear.
          </li>
          <li>
            <strong>Expect patina.</strong> Genuine wear — softened
            corners, slight colour deepening — is normal on quality
            leather. Peeling, cracking, and flaking are different: those
            are material failure.
          </li>
        </ul>

        <ImageSlot
          n={5}
          instruction="Square 1:1. Zipper pull and tape from the inside of a bag, with brand stamp visible on the slider. YKK, Riri, or Lampo stamp preferred — pick whichever is closest to hand."
        />
      </section>

      {/* ─────────── Section 6: FAQ ─────────── */}
      <section id="faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading">
          <HelpCircle aria-hidden="true" className={styles.sectionIcon} />
          Frequently asked questions
        </h2>
        <p>
          Short, neutral answers to the questions readers most often ask
          when first researching handbags. Longer answers live in the
          article sections above.
        </p>

        <div className={styles.faq}>
          <Faq q="Does more expensive always mean better?">
            No. Price reflects materials, labour, overheads and brand
            positioning. A well-made modestly priced bag — straight
            stitching, functional hardware, dense lining — will outlast
            an expensive bag assembled carelessly. Use the inspection
            tests above; ignore the price tag during inspection and
            reconsider it only afterwards.
          </Faq>

          <Faq q="Is &ldquo;Made in Italy&rdquo; a guarantee of quality?">
            It is a claim about where the bag was assembled and finished,
            not where every component was sourced (country-of-origin
            rules reflect last substantial transformation). Italian
            leather goods often benefit from deep manufacturing
            expertise, but the label alone is not proof of quality — the
            inspection still matters.
          </Faq>

          <Faq q="How long should a leather handbag last with everyday use?">
            A well-made leather bag used daily and cared for should give
            5–10 years of serviceable life, with many lasting decades.
            Synthetics typically have shorter useful lives because
            coatings eventually crack, but they can still serve for
            years with lighter use.
          </Faq>

          <Faq q="Can I use a leather bag in the rain?">
            Finished leather tolerates light rain. The risk is uneven
            drying — water marks, stiffness. Blot (don&apos;t rub),
            air-dry away from radiators, and condition once fully dry.
            Suede and nubuck are much more vulnerable than coated
            calfskin.
          </Faq>

          <Faq q="What's the best way to store a handbag between uses?">
            Empty it, stuff it loosely with acid-free tissue or a cotton
            pillow to hold its shape, close the closure, and store it
            upright in a breathable dust bag away from direct sunlight.
            Avoid plastic — it traps moisture and causes mildew.
          </Faq>

          <Faq q="Is bonded leather worth buying?">
            For short-use bags where appearance for one season matters
            more than longevity, bonded can be reasonable. For an
            everyday bag, no — it peels at flex points, usually within
            one to three years.
          </Faq>

          <Faq q="Are rolled handles stronger than flat handles?">
            Generally yes, for daily hard use. Rolled handles — a single
            piece of leather wrapped and stitched — distribute grip
            pressure and resist cracking better than cut-edge flat
            straps. Flat handles are perfectly acceptable for lighter
            bags and less frequent use.
          </Faq>

          <Faq q="How do I check the zipper is good quality?">
            Run it slowly end to end both ways. It should slide without
            catching, the teeth should close cleanly, the pull should
            sit square. Check for a brand stamp — YKK is a reasonable
            minimum, Riri and Lampo are premium. A gritty zipper on a
            new bag will only get worse.
          </Faq>

          <Faq q="What is skiving and should I care?">
            Skiving is thinning the leather at edges and overlaps so
            joins lie flat. Where it&apos;s skipped, folded edges bulge,
            strap fittings sit crooked, and seams look lumpy. It is one
            of the most reliable visible signs that a maker understands
            leather.
          </Faq>

          <Faq q="Can I trust &ldquo;vegan leather&rdquo;?">
            It depends entirely on which vegan leather. Most are
            PU-coated fabrics; some are bio-based composites; a few are
            recycled synthetics. Ask what the coating and backing are
            and treat the term as a category question, not a quality
            guarantee.
          </Faq>

          <Faq q="Does a heavy bag mean a well-made bag?">
            Not reliably. Weight correlates with thicker leather and
            solid metal, but it also tires the shoulder and stresses the
            strap anchors. Lift the bag loaded with your usual contents
            and judge whether the weight is usable.
          </Faq>

          <Faq q="What about environmental claims — LWG Gold, &ldquo;sustainable leather&rdquo;?">
            Leather Working Group ratings describe a tannery&apos;s
            environmental audit performance, not the finished
            bag&apos;s quality. A Gold-rated tannery indicates good
            environmental practice there; it does not tell you about
            hide grade, construction, or longevity of the finished
            product.
          </Faq>
        </div>
      </section>
    </GuideLayout>
  );
}
