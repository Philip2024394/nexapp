// src/app/nex-generated/buying-guides/running-shoes/page.tsx
//
// Running Shoes Buying Guide · substantial single-scroll editorial
// article. Independent Next content · not affiliated with any
// footwear brand, retailer or athletic body.
// Sandbox-only preview surface · noindex at page scope.
//
// 2026-11-17 content from evidence/buying-guides/running-shoes/
// (research-ledger.md + questions.md + draft-content.md).
// Built on shared GuideLayout.

import type * as React from "react";
import {
  Footprints,
  Ruler,
  Settings,
  MapPin,
  Wrench,
  HelpCircle,
} from "lucide-react";
import { GuideLayout, ImageSlot, Faq } from "../_guide-layout";
import styles from "../_phone-frame.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Running Shoes Buying Guide — Next",
  description:
    "An independent guide to choosing a running shoe for the running you actually do — surface, distance, fit, drop, and when to retire a pair. Not affiliated with any footwear brand.",
};

export default async function RunningShoesBuyingGuidePage(): Promise<React.JSX.Element> {
  return (
    <GuideLayout
      dataScope="buying-guides-running-shoes"
      title="Running Shoes"
      lede={
        <>
          A good running shoe isn&apos;t the one on a &ldquo;best of
          2026&rdquo; list. It&apos;s the one that suits the runs you
          actually do — the surface under your feet, the distance in your
          training week, the paces you work at, the shape and width of
          your foot, and the miles already on your legs. This guide walks
          through how to choose by the running, not by the brand, and
          treats the still-contested bits of running-shoe science
          (pronation matching, drop, super shoes) with the caution the
          peer-reviewed literature asks for.
        </>
      }
      disclaimer={[
        "Editorial reference, not a product review or ranking. No brand received payment or placement for inclusion.",
        "This page does not provide medical advice. For pain, injury or pregnancy concerns, speak to a GP, physiotherapist, podiatrist, midwife or obstetrician.",
        "Clinical and biomechanics references are listed in the research ledger alongside each claim.",
      ]}
      heroImage={{
        n: 1,
        instruction:
          "A row of three shoes showing a daily trainer, a lightweight workout shoe, and a trail shoe side by side, labelled by category.",
      }}
      toc={[
        { href: "#how-you-run", label: "How you run determines what you need" },
        { href: "#fit-shape-size", label: "Fit, shape and sizing" },
        { href: "#cushioning-drop-stack", label: "Cushioning, drop and stack" },
        { href: "#road-trail-track", label: "Road vs trail vs track" },
        { href: "#when-to-replace", label: "When to replace a running shoe" },
        { href: "#faq", label: "Frequently asked questions" },
        { href: "#for-sellers", label: "For running-shoe sellers" },
      ]}
      trailingImage={{
        n: 6,
        instruction:
          "An overhead comparison of two pairs of running shoes, one with visible outsole wear at the heel and forefoot, the other new, with wear patterns annotated.",
      }}
      sellerBlock={{
        title: "Are you a running-shoe seller?",
        body: (
          <>
            Running a specialty running shop, boutique or resale listing?
            Create a shop on Nex and describe shoes honestly — intended
            use, surface, drop, stack height, width options, and
            condition if used — so runners can match a shoe to their
            running.
          </>
        ),
      }}
      footerText="Next · Independent buying guide · preview build · not affiliated with any footwear brand or retailer. Not medical advice."
    >
      <div className={styles.banner}>
        Comfort and fit beat theory. No shoe prevents injury. Stated
        lifespans are estimates. Peer-reviewed sources behind each claim
        live in the research ledger.
      </div>

      {/* ─────────── Section 1: How you run ─────────── */}
      <section id="how-you-run" aria-labelledby="how-you-run-heading">
        <h2 id="how-you-run-heading">
          <Footprints aria-hidden="true" className={styles.sectionIcon} />
          How you run determines what you need
        </h2>
        <p>
          Before anything about brands or categories, answer four
          questions honestly: how many kilometres a week, on what
          surface, at what paces, and with which niggles. Someone running
          three 5 km loops a week on pavement needs a different shoe from
          someone training for a hill marathon. The categories most shops
          use translate roughly like this:
        </p>
        <ul>
          <li>
            <strong>Daily trainer</strong> — the workhorse for easy
            miles, long slow runs and most training. Moderate cushion,
            durable outsole, nothing extreme.
          </li>
          <li>
            <strong>Tempo / workout shoe</strong> — a lighter, more
            responsive shoe for faster sessions, threshold runs and
            shorter races.
          </li>
          <li>
            <strong>Race-day / plated shoe</strong> — stiff plate plus a
            lightweight, high-return foam; designed for race pace and
            peer-reviewed as improving running economy for many runners,
            but not an everyday trainer.
          </li>
          <li>
            <strong>Trail shoe</strong> — aggressive outsole lugs, firmer
            midsole, reinforced upper, often a rock plate for protection
            on stony ground.
          </li>
          <li>
            <strong>Stability / support shoe</strong> — a daily trainer
            with structure built into the midsole. Some runners genuinely
            prefer the feel; the claim that these prevent injury based on
            arch shape is not well supported (see FAQ).
          </li>
        </ul>
        <p>
          For most new runners, one well-fitting daily trainer is enough.
          As weekly volume grows, a second pair — a lighter workout shoe,
          or a trail shoe if you&apos;re heading off road — starts to
          make sense. One of the few habits with real peer-reviewed
          support is rotating between pairs: a cohort study published in
          the <em>Journal of Foot and Ankle Research</em> found runners
          using several shoes had lower injury incidence than single-shoe
          runners.
        </p>
      </section>

      {/* ─────────── Section 2: Fit ─────────── */}
      <section id="fit-shape-size" aria-labelledby="fit-shape-size-heading">
        <h2 id="fit-shape-size-heading">
          <Ruler aria-hidden="true" className={styles.sectionIcon} />
          Fit, shape and sizing
        </h2>
        <p>
          Fit is the one thing a brand review cannot tell you. Specialty
          running retailers use variations on the same methodology and
          it&apos;s worth borrowing even if you shop online.
        </p>

        <h3>Length</h3>
        <p>
          Stand up, weight on the foot. Aim for roughly a thumb&apos;s
          width — about 1 cm — between your longest toe and the front of
          the shoe. Your foot lengthens under load, and it lengthens more
          on downhills; a shoe that feels snug sitting down will bruise
          toenails over 15 km.
        </p>

        <h3>Width</h3>
        <p>
          Have both feet measured; most people have one foot bigger than
          the other. If the forefoot of the shoe compresses your foot,
          if you get hot spots, or if your toes go numb on long runs, you
          likely need a wider last or a different brand&apos;s shape.
          Several brands offer wide fits and lasts vary considerably.
        </p>

        <h3>Heel</h3>
        <p>
          The heel should hold without slipping, pinching or blistering.
          Use the runner&apos;s loop — the extra top eyelet most running
          shoes have — if your heel moves. If lacing can&apos;t fix it,
          the last is wrong for your foot and no amount of foam will
          rescue the shoe.
        </p>

        <h3>Timing</h3>
        <p>
          Measure feet in the afternoon or evening, with the socks
          you&apos;ll actually run in. Feet swell during the day and on
          runs; a morning fitting in thin socks is a setup for an
          under-sized shoe.
        </p>

        <h3>Men&apos;s / women&apos;s / unisex</h3>
        <p>
          Women-specific lasts are usually narrower at the heel and
          softer in midsole density to suit lower average body mass, but
          there&apos;s wide overlap. Many women fit better in a unisex or
          &ldquo;men&apos;s&rdquo; last. Fit first, label second.
        </p>

        <ImageSlot
          n={2}
          instruction="Overhead view of a foot inside a shoe, with a thumb's width of space illustrated at the toe and the runner's loop shown at the heel."
        />
      </section>

      {/* ─────────── Section 3: Cushioning / drop / stack ─────────── */}
      <section
        id="cushioning-drop-stack"
        aria-labelledby="cushioning-drop-stack-heading"
      >
        <h2 id="cushioning-drop-stack-heading">
          <Settings aria-hidden="true" className={styles.sectionIcon} />
          Cushioning, drop and stack
        </h2>
        <p>
          Three variables get talked about most — and all three are more
          nuanced than retail copy suggests.
        </p>

        <h3>Cushioning</h3>
        <p>
          About foam density, thickness and the ride it produces. Softer
          foams feel forgiving on long runs; firmer foams feel responsive
          at pace. Neither is objectively &ldquo;better.&rdquo;
          Peer-reviewed biomechanics comparisons between maximalist and
          minimalist shoes show different loading patterns, not a safer
          category.
        </p>

        <h3>Heel-to-toe drop</h3>
        <p>
          The height difference between heel and forefoot, usually quoted
          in millimetres. Review-level literature shows drop can shift
          load between the knee and the Achilles, but there isn&apos;t a
          single &ldquo;correct&rdquo; drop. The more consistent finding
          is that changing drop suddenly — dropping from 10 mm to 4 mm
          overnight, for instance — is a risk factor on its own. If
          you&apos;re changing drop, change it slowly over months.
        </p>

        <h3>Stack height</h3>
        <p>
          The total foam under the foot. Taller stacks usually mean more
          cushion and less ground feel; lower stacks are lighter and give
          more feedback but are less forgiving.
        </p>

        <h3>Plated &ldquo;super shoes&rdquo;</h3>
        <p>
          A stiff plate plus a lightweight high-return foam has been
          shown in peer-reviewed work to improve running economy,
          especially at faster paces. Caveats: they wear faster than
          daily foams, their ride suits race pace, and their biomechanics
          differ from a standard trainer. Most runners use them for key
          workouts and races, not for every easy jog.
        </p>
        <p>
          If you&apos;re new to running or switching categories
          (minimalist from maximalist, or the reverse), introduce the new
          shoe gradually: a short easy run once or twice a week before
          building up.
        </p>

        <ImageSlot
          n={3}
          instruction="Side profile of a worn shoe next to a new shoe of the same model, showing the compressed midsole on the worn one and the deeper, intact foam on the new one."
        />
      </section>

      {/* ─────────── Section 4: Road / trail / track ─────────── */}
      <section id="road-trail-track" aria-labelledby="road-trail-track-heading">
        <h2 id="road-trail-track-heading">
          <MapPin aria-hidden="true" className={styles.sectionIcon} />
          Road vs trail vs track
        </h2>
        <p>
          The outsole is where the surface mismatch bites first.
        </p>
        <ul>
          <li>
            <strong>Road shoes</strong> have smoother outsoles, softer
            midsoles and uppers built for heat and mileage. On wet grass
            or loose stone they slip; on pavement they&apos;re what the
            shoe was engineered for.
          </li>
          <li>
            <strong>Trail shoes</strong> have aggressive lugs for grip on
            soil, roots and rock. Many have a firmer midsole, reinforced
            toe bumper, and sometimes a rock plate to protect the foot
            from sharp ground. Running pavement in deep-lug trail shoes
            wears the lugs down fast and makes the ride feel clumpy;
            running trails in road shoes is slippery and bruising.
          </li>
          <li>
            <strong>Track shoes and spikes</strong> are for shorter,
            faster reps and track races. Spikes aren&apos;t daily
            training shoes — the plate is stiff, the upper is minimal,
            and the fit is race-snug. Most runners doing weekly track
            sessions use their regular workout shoe and reserve spikes
            for competition or specific race-prep sessions.
          </li>
        </ul>
        <p>
          A rough test: if most of your runs are on pavement with the
          occasional park loop, buy a road shoe and don&apos;t overthink
          it. If more than a couple of runs a week are on soft, stony or
          technical ground, a dedicated trail shoe earns its place
          quickly.
        </p>

        <ImageSlot
          n={4}
          instruction="Close-up of two outsoles side by side — a smooth road outsole and an aggressive-lug trail outsole — on the same background."
        />
      </section>

      {/* ─────────── Section 5: When to replace ─────────── */}
      <section id="when-to-replace" aria-labelledby="when-to-replace-heading">
        <h2 id="when-to-replace-heading">
          <Wrench aria-hidden="true" className={styles.sectionIcon} />
          When to replace a running shoe
        </h2>
        <p>
          Shoes don&apos;t fail the way a watch strap does. The midsole
          foam quietly compresses before the outsole or upper looks
          finished. Independent editorial and peer-reviewed work
          generally suggest <strong>480–800 km (roughly 300–500 miles)</strong>{" "}
          for a typical midsole, but this is a range, not a rule.
        </p>

        <h3>Faster wear is normal when</h3>
        <ul>
          <li>
            You weigh more than average and the foam compresses harder
            each step.
          </li>
          <li>
            You run almost all your miles in the same pair (no rotation).
          </li>
          <li>
            Your weekly running is in very hot climates, which
            accelerates foam breakdown.
          </li>
          <li>You walk, commute and gym in them too.</li>
        </ul>

        <h3>Signs it&apos;s time to retire</h3>
        <ul>
          <li>
            Midsole foam that stays creased when you press and
            doesn&apos;t spring back.
          </li>
          <li>
            Outsole rubber smoothed down to the midsole at your usual
            contact point.
          </li>
          <li>
            A new ache in a familiar run on a familiar route — especially
            a new calf, shin or knee twinge.
          </li>
          <li>
            A fresh pair of the same model feels noticeably different and
            more cushioned.
          </li>
        </ul>
        <p>
          Rotating between two or more pairs — one daily trainer plus a
          workout or long-run shoe — extends the life of each and, per
          the cohort evidence cited in the ledger, is associated with
          lower injury incidence.
        </p>
        <p>
          When you do retire a pair, don&apos;t put them back into
          circulation. Many UK specialty shops and charities run
          take-back or donation schemes for shoes in good condition;
          shoes with a collapsed midsole are no longer supportive for the
          next runner.
        </p>

        <ImageSlot
          n={5}
          instruction="Macro of a compressed midsole fold-line next to the same area on a new pair. Caption: The foam tells you long before the outsole does."
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
          when choosing a running shoe.
        </p>

        <div className={styles.faq}>
          <Faq q="Should I buy a shoe matched to my pronation?">
            The simple &ldquo;overpronator / neutral / underpronator&rdquo;
            sort is a popular retail heuristic. Peer-reviewed studies —
            including work in the <em>British Journal of Sports
            Medicine</em> — have found that assigning shoes based on
            static arch shape did not reduce injury rates, and that
            pronation in novice runners was not a strong injury
            predictor. The retail framework isn&apos;t wrong to offer
            stability shoes to people who like them; the claim that it
            prevents injury based on your arch is not well supported.
          </Faq>

          <Faq q="How long do running shoes last?">
            Typically 480–800 km (300–500 miles) for the midsole, with
            heavier runners and single-pair users at the lower end. Treat
            it as a range, not a warranty.
          </Faq>

          <Faq q="Do I really need two pairs?">
            Not when you&apos;re starting. As weekly mileage grows,
            having a second pair extends the life of each and — per a{" "}
            <em>Journal of Foot and Ankle Research</em> cohort study — is
            associated with lower injury incidence.
          </Faq>

          <Faq q="Are carbon-plated super shoes worth it for a recreational runner?">
            For race pace, often yes — peer-reviewed work shows real
            improvements in running economy. For easy daily miles,
            usually no — the foams wear faster, the ride suits faster
            paces, and the biomechanics are different from a normal
            trainer.
          </Faq>

          <Faq q="Can I run while pregnant?">
            NHS and ACOG guidance supports moderate exercise — including
            continuing to run — in most uncomplicated pregnancies, with
            individual advice from your midwife, GP or obstetrician. Feet
            often widen and swell during pregnancy, so many runners
            re-measure and go up in width or half a size.
          </Faq>

          <Faq q="My knees hurt after running — is it my shoes?">
            Shoes can be part of the picture (worn midsole, abrupt drop
            change) but persistent knee pain is a clinical question. NHS
            and Royal College of Podiatry guidance is clear: see a GP,
            physiotherapist or podiatrist rather than diagnosing from a
            shoe wall.
          </Faq>

          <Faq q="Should I go up half a size for running?">
            Many runners do. Feet swell on long runs and in heat. The
            trustworthy way to find out is to measure late in the day, in
            the socks you&apos;ll actually run in, and keep roughly a
            thumb&apos;s width of space at the toe.
          </Faq>

          <Faq q="Are minimalist or barefoot-style shoes safer?">
            The &ldquo;more natural, fewer injuries&rdquo; claim
            isn&apos;t backed by robust evidence. Switching to very
            low-drop or minimal shoes abruptly is associated with calf
            and foot injuries. Some runners transition successfully over
            months; others never do.
          </Faq>

          <Faq q="Can I use running shoes for the gym?">
            Walking in them is fine. Lifting and anything with
            side-to-side motion (court sports, lateral HIIT) is not what
            a running shoe is built for — they&apos;re cushioned for
            forward motion with an elevated heel, not stable under load.
          </Faq>

          <Faq q="My toenails keep bruising — what's wrong?">
            Usually length or lacing: the foot slides forward on descents
            and the toenail bangs the front. Try half a size up, lace the
            runner&apos;s loop to tighten the heel, and check your sock.
            If it keeps happening, see a podiatrist.
          </Faq>
        </div>
      </section>
    </GuideLayout>
  );
}
