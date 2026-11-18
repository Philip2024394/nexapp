// src/app/nex-generated/buying-guides/mobile-phones/page.tsx
//
// Mobile Phones Buying Guide · substantial single-scroll editorial
// article. Independent Next content · not affiliated with any
// handset manufacturer, carrier or refurbisher.
// Sandbox-only preview surface · noindex at page scope.
//
// 2026-11-17 content from evidence/buying-guides/mobile-phones/
// (research-ledger.md + questions.md + draft-content.md).
// 2026-11-17 refactor: rebuilt on shared GuideLayout.

import type * as React from "react";
import {
  Smartphone,
  Package,
  Settings,
  ShieldCheck,
  Clock,
  HelpCircle,
} from "lucide-react";
import { GuideLayout, ImageSlot, Faq } from "../_guide-layout";
import styles from "../_phone-frame.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mobile Phone Buying Guide — Next",
  description:
    "An independent guide to choosing a mobile phone — new, refurbished or used — covering specs that matter, used-phone checks, and software-support length. Not affiliated with any handset manufacturer or carrier.",
};

export default async function MobilePhonesBuyingGuidePage(): Promise<React.JSX.Element> {
  return (
    <GuideLayout
      dataScope="buying-guides-mobile-phones"
      title="Mobile Phones"
      lede={
        <>
          Choosing a phone is less about picking a winner and more about
          matching a device to the way you actually use one — how long you
          keep phones, how you shoot photos, where you travel, and how
          much safety margin you want on software support. This guide
          walks through the decisions in order, whether the handset in
          front of you is new, refurbished, or used.
        </>
      }
      disclaimer={[
        "Independent decision framework. Next does not rank, score or endorse specific phone brands or models.",
        "Next is a marketplace and community platform, not a phone retailer or carrier.",
        "Not affiliated with Apple, Google, Samsung, or any other handset manufacturer, carrier, or refurbisher.",
      ]}
      heroImage={{
        n: 1,
        instruction:
          "Square 1:1. A phone showing its 15-digit IMEI after dialling *#06#, with the IMEI plate on the back of the box held alongside for comparison. Natural light, matte surface.",
      }}
      toc={[
        { href: "#what-you-need", label: "Decide what you need the phone for" },
        { href: "#new-refurbished-used", label: "New, refurbished or used" },
        { href: "#specs-that-matter", label: "Specs that matter" },
        { href: "#checking-used", label: "Checking a used phone" },
        { href: "#software-support", label: "Software support & longevity" },
        { href: "#faq", label: "Frequently asked questions" },
        { href: "#for-sellers", label: "For phone sellers" },
      ]}
      trailingImage={{
        n: 6,
        instruction:
          "Square 1:1. The iPhone setup flow at the point where Activation Lock would appear, shown after a successful factory reset passes through to the 'Hello' welcome screen (confirming the lock is off). Owner's own device.",
      }}
      sellerBlock={{
        title: "Are you a phone seller?",
        body: (
          <>
            Running a phone repair, refurb, or resale business? Create your
            shop on Nex and list IMEI, grade, battery health, and the
            specific warranty you offer up-front — the exact facts buyers
            who&apos;ve read a guide like this are looking for.
          </>
        ),
      }}
      footerText="Next · Independent buying guide · preview build · not affiliated with any phone manufacturer, carrier or refurbisher. Last reviewed: 2026-11-17."
    >
      {/* ─────────── Section 1: What you need ─────────── */}
      <section id="what-you-need" aria-labelledby="what-you-need-heading">
        <h2 id="what-you-need-heading">
          <Smartphone aria-hidden="true" className={styles.sectionIcon} />
          Decide what you need the phone for
        </h2>
        <p>
          The single most useful question to answer before looking at any
          spec sheet is: what will this phone be doing on a normal Tuesday
          in six months&apos; time? A phone used mainly for messaging,
          navigation, banking and a steady camera roll is a very different
          purchase from one that has to hold up through heavy mobile
          gaming, long video shoots, or international travel on multiple
          carriers.
        </p>
        <p>
          Consumer Reports&apos; testing programme consistently identifies
          battery life, display quality, camera performance and overall
          reliability as the four priorities most buyers end up caring
          about — not the specs that attract the most marketing. Start
          from your own workload and work outward from there.
        </p>

        <h3>A one-paragraph workload audit</h3>
        <ul>
          <li>
            <strong>
              Daily messaging, email, social media, maps, light photos.
            </strong>{" "}
            Almost any mid-range phone from the last two to three years
            handles this; prioritise battery life and software-support
            length.
          </li>
          <li>
            <strong>Serious photography.</strong> Prioritise sensor size
            over megapixel count, plus the quality of the main wide-angle
            lens; you will use it far more than the periscope or
            ultra-wide.
          </li>
          <li>
            <strong>Travel across countries.</strong> Prioritise band
            support (both LTE and 5G) for every carrier you plan to use,
            and consider eSIM compatibility so you can add local data
            without swapping cards.
          </li>
          <li>
            <strong>Gaming, 4K video capture, on-device AI.</strong>{" "}
            Prioritise current-generation processor, thermal headroom
            (bigger phones generally dissipate heat better), and 256 GB of
            storage or more.
          </li>
          <li>
            <strong>Long keep-length (5+ years).</strong> Prioritise
            published software-support end-date and repairability,
            especially battery access.
          </li>
        </ul>

        <h3>What usually does not matter as much as it sounds</h3>
        <ul>
          <li>
            Peak brightness numbers quoted by the manufacturer — most are
            measured in a small spot, not across the whole screen.
          </li>
          <li>
            Headline megapixel counts on secondary cameras, which are
            rarely the sensor you actually photograph with.
          </li>
          <li>
            Peak charging-speed watts — above a certain point, all it
            affects is the last five minutes of a charge.
          </li>
        </ul>
      </section>

      {/* ─────────── Section 2: New/refurb/used ─────────── */}
      <section
        id="new-refurbished-used"
        aria-labelledby="new-refurbished-used-heading"
      >
        <h2 id="new-refurbished-used-heading">
          <Package aria-hidden="true" className={styles.sectionIcon} />
          New, refurbished or used
        </h2>
        <p>
          These three words describe three very different purchases.
          Reading the label carefully is the first cost-saving step.
        </p>
        <p>
          A <strong>new</strong> phone is unopened, sold through the
          manufacturer or an authorised retailer, carries the full
          manufacturer warranty from the date you buy it, and comes with
          current software. A <strong>refurbished</strong> phone has been
          previously owned or returned, then inspected, tested, cleaned
          and repaired as needed by a seller who graded it and attached
          some form of warranty. A <strong>used</strong> or{" "}
          <strong>pre-owned</strong> phone has had a previous owner but
          is sold as-is, with no promise of testing, no refurbishment
          process, and usually no warranty beyond what remains of the
          original manufacturer cover.
        </p>
        <p>
          &ldquo;Renewed&rdquo; is not a fourth category — it is a
          marketplace brand name (notably Amazon&apos;s) applied to
          devices that meet that platform&apos;s refurbishment standard.
          Treat it as a type of refurbished.
        </p>

        <h3>Refurbished grades, decoded</h3>
        <p>
          Grades are <strong>seller-defined</strong>, not legally
          standardised, so always read the specific definition on the
          specific listing. Broadly:
        </p>
        <ul>
          <li>
            <strong>
              Grade A / &ldquo;like new&rdquo; / &ldquo;excellent&rdquo;
            </strong>{" "}
            — minimal or no visible wear under normal use.
          </li>
          <li>
            <strong>
              Grade B / &ldquo;very good&rdquo; / &ldquo;good&rdquo;
            </strong>{" "}
            — light surface marks visible on close inspection; fully
            functional. Which? has flagged this as the usual balance
            between price and condition for most buyers.
          </li>
          <li>
            <strong>Grade C / &ldquo;fair&rdquo;</strong> — visible wear
            including scratches or minor dents; fully functional.
          </li>
        </ul>

        <h3>Which route fits which buyer?</h3>
        <ul>
          <li>
            You want the latest features and a full fresh warranty:{" "}
            <strong>new</strong>.
          </li>
          <li>
            You want most of the quality of new at a lower price, with a
            formal warranty:{" "}
            <strong>
              refurbished from a reputable seller with a published grade
              and a written warranty of 12 months or more.
            </strong>
          </li>
          <li>
            You want the lowest possible price and are willing to do your
            own inspection in person: <strong>used</strong>, with the
            full pre-purchase checklist in the next section applied.
          </li>
        </ul>

        <h3>The warranty question</h3>
        <p>
          Manufacturer limited warranties generally transfer with the
          device because they attach to the serial number and start from
          the original retail-sale date. Extended-service plans
          (AppleCare+, Samsung Care+, carrier-insurance programmes)
          often do <strong>not</strong> transfer, especially if they
          were on a monthly plan. Before you buy second-hand, check
          coverage on the manufacturer&apos;s online tool using the
          serial or IMEI.
        </p>

        <ImageSlot
          n={2}
          instruction="Square 1:1. A refurbished-phone listing zoomed in on the grade description paragraph — specifically a grade-definition explaining what 'Grade B' means for that seller. Screen capture on a laptop or tablet."
        />
      </section>

      {/* ─────────── Section 3: Specs ─────────── */}
      <section
        id="specs-that-matter"
        aria-labelledby="specs-that-matter-heading"
      >
        <h2 id="specs-that-matter-heading">
          <Settings aria-hidden="true" className={styles.sectionIcon} />
          Specs that matter, and how to judge them
        </h2>
        <p>
          Spec sheets are where most buying mistakes get made. A short
          list of judgements is more useful than a long list of numbers.
        </p>

        <h3>Display</h3>
        <p>
          Independent testing labs such as RTings measure response time,
          flicker, colour accuracy and motion handling with instruments,
          not with marketing copy. If display quality matters to you,
          read independent measurements rather than manufacturer claims.
          For most buyers, the practical trade-off is size versus
          one-hand usability, and refresh rate (90 Hz or 120 Hz feels
          smoother than 60 Hz, but drains more battery when always on).
        </p>

        <h3>Camera</h3>
        <p>
          Sensor size usually matters more than megapixel count. A larger
          sensor gathers more light, which is what makes low-light and
          high-dynamic-range photos look better. A 48-megapixel camera on
          a larger sensor can out-shoot a 200-megapixel camera on a
          smaller one. Pay more attention to the main wide-angle
          camera&apos;s sensor than to the headline numbers on ultrawide,
          periscope or depth sensors — the main sensor takes the vast
          majority of real-world photos.
        </p>

        <h3>Battery</h3>
        <p>
          Battery life depends on battery capacity, display efficiency,
          processor efficiency and your actual usage pattern — in roughly
          that order. On a <strong>new</strong> phone, published hours
          are approximate; independent all-day-use tests tell you more.
          On a <strong>used</strong> phone, the figure to look at is the
          battery-health or maximum-capacity percentage shown in the
          device&apos;s own settings — this estimates how much capacity
          remains versus when the battery was new.
        </p>

        <h3>Storage</h3>
        <p>
          Pick for workload, not habit. A typical cloud-first user on
          128 GB is comfortable for two to three years. Heavy
          local-video or gaming users want 256 GB or more. The operating
          system and pre-installed apps typically consume 15–20 GB
          before you store anything. Storage is almost always
          non-upgradable on modern phones — buy a tier up from your
          current size if you plan to keep the device three years or
          more.
        </p>

        <h3>Connectivity</h3>
        <ul>
          <li>
            <strong>5G band support</strong> — carriers deploy 5G on
            different frequency bands, and a phone that lists
            &ldquo;5G&rdquo; may not support the specific bands your
            carrier uses. Compare the phone&apos;s published band list to
            your carrier&apos;s coverage page before buying.
          </li>
          <li>
            <strong>eSIM</strong> — a programmable SIM profile stored in
            the phone itself, defined by the GSMA SGP.22 specification.
            Convenient for travel and adding carriers, but note that a
            factory reset erases eSIM profiles; a physical SIM retains
            its identity in the card.
          </li>
          <li>
            <strong>Wi-Fi 6E / Wi-Fi 7</strong> — matters if your home
            router supports it; otherwise irrelevant until you upgrade
            routers.
          </li>
        </ul>

        <h3>Build and water resistance</h3>
        <p>
          IP ratings are defined in IEC 60529. The common IP68 rating
          means the device is fully dust-tight and protected against
          continuous immersion under conditions the manufacturer
          declares (usually a specific depth for a specific time in
          fresh water). This is a laboratory rating on a new sealed
          device — it does not survive opening for repair, significant
          drops, salt water, or age. Warranties typically exclude
          liquid damage even on IP68 devices.
        </p>

        <ImageSlot
          n={3}
          instruction="Square 1:1. A close-up of a phone's charging port illuminated by a small torch, showing the inside of the port — used to illustrate 'inspect the port for lint, corrosion or bent pins'."
        />
      </section>

      {/* ─────────── Section 4: Checking used ─────────── */}
      <section id="checking-used" aria-labelledby="checking-used-heading">
        <h2 id="checking-used-heading">
          <ShieldCheck aria-hidden="true" className={styles.sectionIcon} />
          Checking a used phone before you buy
        </h2>
        <p>
          If you take nothing else from this guide, take this section. A
          twenty-minute check in person prevents the most common
          post-purchase regrets.
        </p>

        <h3>The five-minute identity check</h3>
        <ul>
          <li>
            <strong>
              Dial <code>*#06#</code> on the phone
            </strong>{" "}
            and compare the 15-digit IMEI shown to the one printed on the
            box, SIM tray or in Settings. They must match.
          </li>
          <li>
            <strong>Run the IMEI through a lookup service</strong> — the
            GSMA&apos;s Central Equipment Identity Register is the global
            database carriers submit to; CTIA&apos;s Stolen Phone Checker
            is a US-facing tool fed by that infrastructure. A
            &ldquo;clean&rdquo; result is necessary but not sufficient —
            BBC reporting has documented that IMEIs can be altered in the
            grey market.
          </li>
          <li>
            <strong>Ask for proof of purchase</strong> from the seller.
            Not every legitimate seller has kept it, but a seller who
            refuses outright is a flag.
          </li>
        </ul>

        <h3>The account-lock check</h3>
        <p>
          This is the step most new-to-second-hand buyers skip, and it
          is the one that kills the most deals after the fact.
        </p>
        <ul>
          <li>
            <strong>iPhone:</strong> have the seller factory-reset the
            phone in front of you, then walk through setup on the spot.
            If the phone displays an &ldquo;iPhone Locked to Owner&rdquo;
            screen or asks for the previous owner&apos;s Apple Account,
            Activation Lock is still on — do not buy.
          </li>
          <li>
            <strong>Android:</strong> same principle, different name.
            Factory Reset Protection will prompt for the last signed-in
            Google account after a reset. The seller must pass that
            screen to a fresh home screen before you pay.
          </li>
        </ul>

        <h3>The condition inspection</h3>
        <ul>
          <li>
            <strong>Battery health.</strong> iPhone: Settings › Battery ›
            Battery Health &amp; Charging; Pixel: Settings › Battery ›
            Battery Health; Samsung: Settings › Battery › Battery
            Information (varies by One UI version). 90% or higher is
            strong; 80% or lower means budget for a battery replacement
            or negotiate accordingly. A swollen or bulging back cover is
            a hard &ldquo;no&rdquo; regardless of the number — that is a
            safety issue.
          </li>
          <li>
            <strong>Screen.</strong> Display a plain white image to check
            for burn-in shadows, dead pixels or yellow patches. Display a
            plain black image to check for backlight bleed and stuck
            pixels. Open a notes or drawing app and run your finger
            across the full surface, including corners, to test touch
            response.
          </li>
          <li>
            <strong>Ports and charging.</strong> Inspect the charging
            port with a torch for bent pins, lint or corrosion. Connect a
            known-good charger and confirm it reports
            &ldquo;charging&rdquo; within a few seconds.
          </li>
          <li>
            <strong>Buttons.</strong> Each button should click crisply
            with no travel or stickiness — power, volume up, volume
            down, mute switch where present, and the shutter button on
            dual-purpose models.
          </li>
          <li>
            <strong>Cameras.</strong> Open the camera app, cycle through
            every lens (wide, ultra-wide, telephoto, front) and take a
            photo on each. Look for blur, dust specks, or colour casts
            on one lens that the others don&apos;t show.
          </li>
          <li>
            <strong>Repair indicators.</strong> On recent iPhones,
            Settings › General › About shows notices when non-genuine
            parts have been installed. Treat these as a disclosure point
            — the phone is still a phone, but the price should reflect
            the repair history.
          </li>
        </ul>

        <h3>The red-flag list</h3>
        <ul>
          <li>Price well below the market for the model and condition.</li>
          <li>Seller refuses to show the phone powered on.</li>
          <li>Seller refuses to share the IMEI before meeting.</li>
          <li>Payment only via a channel with no buyer protection.</li>
          <li>
            Any claim that an iCloud lock or Google lock is &ldquo;easy
            to remove&rdquo; — it isn&apos;t, and a seller saying this
            is admitting the phone is locked.
          </li>
        </ul>

        <ImageSlot
          n={4}
          instruction="Square 1:1. The iOS Battery Health & Charging screen, showing the Maximum Capacity percentage field, taken on a phone that has been in daily use. Avoid including any personally identifying info in the status bar."
        />
      </section>

      {/* ─────────── Section 5: Software support ─────────── */}
      <section
        id="software-support"
        aria-labelledby="software-support-heading"
      >
        <h2 id="software-support-heading">
          <Clock aria-hidden="true" className={styles.sectionIcon} />
          Software support and longevity
        </h2>
        <p>
          A phone that stops receiving security updates is still a phone,
          but it stops being a safe banking, email or account-recovery
          device. Match your intended keep-length to the model&apos;s
          published security-update end date, not to its release date.
        </p>

        <h3>What manufacturers publish</h3>
        <ul>
          <li>
            <strong>Apple</strong> publishes security-update information
            per device on its support pages, and in practice iPhones
            have typically received six to eight years of combined major
            iOS and security updates.
          </li>
          <li>
            <strong>Google</strong> publishes a seven-year commitment of
            OS and security updates for Pixel 8 and later, measured from
            first availability on the Google Store in the United States.
          </li>
          <li>
            <strong>Samsung</strong> publishes a seven-year commitment of
            OS and security updates for Galaxy S24 and later flagships,
            and six years for selected A-series devices from late 2024
            onward.
          </li>
          <li>
            <strong>Other Android brands</strong> vary widely. Always
            look up the specific model&apos;s published policy; a
            brand&apos;s promise for one tier does not extend to every
            device it sells.
          </li>
        </ul>

        <h3>What the EU regulation now sets as a floor</h3>
        <p>
          Since 20 June 2025, the EU&apos;s Ecodesign regulation for
          smartphones and tablets has required manufacturers of new
          phones placed on the EU market to provide operating-system and
          security updates for at least five years after the last unit
          of that model is placed on the market, and to ensure
          spare-parts availability for several years after a model is
          discontinued. This is a floor, not a ceiling — manufacturers
          publishing longer commitments go beyond it.
        </p>

        <h3>Repairability as a longevity signal</h3>
        <p>
          Battery health declines with charge cycles regardless of how
          carefully you use the phone. A phone whose battery can be
          replaced through an accessible process costs less to keep
          alive past year three. iFixit&apos;s published repairability
          scoring — validated in peer-reviewed industrial-ecology
          research — identifies battery access and fastener type as the
          single biggest drivers of score. Models that score higher are
          not automatically &ldquo;better,&rdquo; but they do have a
          lower cost-of-ownership curve past year three.
        </p>

        <h3>Treating software support as a line item</h3>
        <p>
          When comparing two used phones at similar prices, calculate
          the remaining security-update window for each. A device with
          36 months of support remaining is often a better buy than a
          slightly nicer device with only 12 months remaining — the
          cheaper-feeling choice has more usable life.
        </p>

        <ImageSlot
          n={5}
          instruction="Square 1:1. A plain white full-screen image displayed on a phone, held at a slight angle to reveal any yellowing, dead pixels or OLED burn-in shadows. Dim-lit room for contrast."
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
          when first researching a phone purchase. Longer answers live
          in the article sections above.
        </p>

        <div className={styles.faq}>
          <Faq q="What is a &ldquo;clean&rdquo; IMEI?">
            Every phone has a 15-digit IMEI defined by 3GPP standards. A
            &ldquo;clean&rdquo; IMEI is one that does not appear on the
            GSMA&apos;s global list of handsets reported lost, stolen or
            with unpaid financing. Blocked IMEIs can be denied service by
            carriers in the country where they were reported.
          </Faq>

          <Faq q="Is an IMEI check enough to confirm a used phone is safe?">
            No. IMEIs can be altered in the grey market, and a phone
            stolen hours before may not yet appear on the list. Combine
            the IMEI check with in-person inspection, an account-lock
            test, and a payment channel that offers dispute protection.
          </Faq>

          <Faq q="What does &ldquo;refurbished&rdquo; actually mean?">
            A previously owned or returned device that a seller has
            inspected, tested, cleaned and repaired as needed, then
            resold under a published grade with a warranty.
            &ldquo;Used&rdquo; is sold as-is; &ldquo;renewed&rdquo; is a
            marketplace brand name for refurbished.
          </Faq>

          <Faq q="How many years of software updates should I expect?">
            In the EU, a published minimum of five years is now required
            by law from 20 June 2025 onward. Google and Samsung publish
            seven-year commitments for recent flagships; Apple&apos;s
            practical pattern has typically been six to eight years.
          </Faq>

          <Faq q="Is a bigger-megapixel camera better?">
            Not on its own. Sensor size usually matters more. A large
            48-megapixel sensor can out-shoot a small 200-megapixel
            sensor in low light and dynamic range.
          </Faq>

          <Faq q="Does IP68 mean my phone is waterproof?">
            No. IP68 under IEC 60529 is a laboratory-tested resistance
            rating on a new, sealed device — specific to the depth and
            duration the manufacturer declares. It does not cover salt
            water, pressurised water, or sealing degraded by age or
            repair.
          </Faq>

          <Faq q="What battery health percentage is acceptable on a used phone?">
            90% or higher is strong, 85–89% is acceptable, below 80%
            means budget for a battery replacement. A swollen back cover
            is a safety issue — do not buy.
          </Faq>

          <Faq q="Does Apple's warranty transfer to me if I buy a used iPhone?">
            The remaining portion of the one-year Apple Limited Warranty
            transfers because it is tied to the serial number and starts
            from the original retail-sale date. AppleCare+ on legacy
            single-payment plans often transfers; monthly AppleCare+
            does not.
          </Faq>

          <Faq q="How do I know Activation Lock or Factory Reset Protection is off?">
            Have the seller factory-reset the phone in front of you and
            walk through setup to a fresh home screen before paying. If
            any previous-owner account prompt appears, do not buy.
          </Faq>

          <Faq q="Should I buy a phone from another country to save money?">
            Only after confirming that your destination carrier&apos;s
            5G bands, VoLTE, Wi-Fi Calling and eSIM support are present
            on the exact imported model. Some features are region-locked
            and not switchable.
          </Faq>

          <Faq q="eSIM or physical SIM?">
            For a single-country single-carrier user, both work fine.
            eSIM is faster to swap for travel and removes the SIM-tray
            attack path used in some SIM-swap fraud. A factory reset
            erases eSIM profiles; a physical SIM retains its identity in
            the card.
          </Faq>

          <Faq q="Is a refurbished phone as good as new?">
            For everyday reliability from a reputable seller with a
            12-month-plus warranty and a published grade, Consumer
            Reports&apos; review of the category concludes the gap is
            usually cosmetic rather than functional.
          </Faq>
        </div>
      </section>
    </GuideLayout>
  );
}
