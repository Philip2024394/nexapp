// src/app/nex-generated/buying-guides/laptops/page.tsx
//
// Laptops Buying Guide · substantial single-scroll editorial article.
// Independent Next content · not affiliated with any manufacturer.
// Sandbox-only preview surface · noindex at page scope.
//
// 2026-11-17 content from evidence/buying-guides/laptops/
// (research-ledger.md + questions.md + draft-content.md).
// Built on shared GuideLayout alongside rolex / mobile-phones /
// handbags / running-shoes / leather-wallets.

import type * as React from "react";
import {
  HelpCircle,
  Cpu,
  Laptop,
  Wrench,
  ShieldCheck,
  CheckCircle,
} from "lucide-react";
import { GuideLayout, ImageSlot, Faq } from "../_guide-layout";
import styles from "../_phone-frame.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Laptop Buying Guide — Next",
  description:
    "An independent guide to choosing a laptop — what spec sheets really mean, longevity and repairability, and what to check when buying new, refurbished or used. Not affiliated with any manufacturer.",
};

export default async function LaptopsBuyingGuidePage(): Promise<React.JSX.Element> {
  return (
    <GuideLayout
      dataScope="buying-guides-laptops"
      title="Laptops"
      lede={
        <>
          A laptop is not one product — it is a stack of trade-offs between
          weight, heat, keyboard feel, display, battery, repairability,
          and years of software support. The right machine is the one
          whose trade-offs line up with the work you actually do. This
          guide translates spec sheets into buyer language, explains what
          longevity really depends on, and sets out the checks that
          separate a sound used laptop from a short-lived one.
        </>
      }
      disclaimer={[
        "Editorial buying guide. Next does not sell laptops and is not affiliated with any manufacturer.",
        "No specific CPU, GPU, or laptop model SKUs are recommended — those details age quickly; the principles here do not.",
        "No prices quoted. Independent consumer-rights testing bodies and manufacturer support pages back every substantive claim; see the research ledger.",
      ]}
      heroImage={{
        n: 1,
        instruction:
          "A clamshell laptop photographed from the keyboard side at a slight angle, no visible branding. Caption: Match the laptop to the work you actually do, not to a benchmark chart.",
      }}
      toc={[
        { href: "#decide-what-for", label: "Decide what the laptop is for" },
        { href: "#specs-translated", label: "Specs translated to buyer language" },
        { href: "#display-keyboard-ports", label: "Display, keyboard, port set" },
        { href: "#longevity-repair", label: "Longevity and repairability" },
        { href: "#new-refurb-used", label: "New, refurbished or used" },
        { href: "#faq", label: "Frequently asked questions" },
        { href: "#for-sellers", label: "For laptop sellers" },
      ]}
      trailingImage={{
        n: 6,
        instruction:
          "A person at a table inspecting a used laptop's hinge movement and keyboard. Caption: Hinge, keyboard, screen, battery, licence, account — six checks in one sitting.",
      }}
      sellerBlock={{
        title: "Are you a laptop seller?",
        body: (
          <>
            Listing a laptop on Nex? Buyers trust listings that read like
            inspection reports, not advertisements — exact configuration,
            battery cycle count, hinge condition, account state, and
            remaining warranty. Create your shop and list laptops the way
            a buyer who&apos;s read a guide like this expects to see them.
          </>
        ),
      }}
      footerText="Next · Independent buying guide · preview build · not affiliated with any laptop manufacturer or retailer."
    >
      {/* ─────────── Section 1: Decide what the laptop is for ─────────── */}
      <section id="decide-what-for" aria-labelledby="decide-what-for-heading">
        <h2 id="decide-what-for-heading">
          <HelpCircle aria-hidden="true" className={styles.sectionIcon} />
          Decide what the laptop is for
        </h2>
        <p>
          Before any spec talk, name the workload. The same budget buys
          very different machines depending on which of these you actually
          do most days.
        </p>
        <ul>
          <li>
            <strong>Writing, email, light web work.</strong> A thin, quiet,
            long-battery machine with a comfortable keyboard matters more
            than raw performance. A low-power CPU tier is appropriate
            here.
          </li>
          <li>
            <strong>Student work.</strong> Portability, battery life, and
            keyboard comfort dominate. Discrete graphics are rarely
            needed.
          </li>
          <li>
            <strong>Developer work.</strong> RAM headroom, SSD capacity,
            display real-estate, and a keyboard you will spend thousands
            of hours on. CPU single-thread responsiveness matters more
            than raw core count for most development, unless your
            toolchain is heavily parallel.
          </li>
          <li>
            <strong>Creative work (photo, design, illustration).</strong>{" "}
            Display colour accuracy, viewing angles, and brightness come
            first. RAM and SSD capacity follow.
          </li>
          <li>
            <strong>Light gaming.</strong> A mid-tier mobile CPU and
            modest discrete graphics suffice for older or less demanding
            titles.
          </li>
          <li>
            <strong>Heavy gaming.</strong> A dedicated gaming chassis with
            real cooling and a high-refresh display — not a thin-and-light
            that advertises &ldquo;gaming capability.&rdquo;
          </li>
          <li>
            <strong>Video editing.</strong> RAM headroom, a fast SSD with
            plenty of capacity, a CPU/GPU combination your editor can
            actually use, a colour-accurate display, and — critically —
            sustained thermal performance under load.
          </li>
        </ul>
        <p>
          Write the workload down. Everything that follows is a check
          against it.
        </p>
      </section>

      <ImageSlot
        n={2}
        instruction="Abstract illustration of chip tiers as stacked blocks (low-power / mid / high-performance), no SKUs on screen. Caption: Think in CPU tiers, not model numbers. Tiers are stable; chip names age fast."
      />

      {/* ─────────── Section 2: Specs translated ─────────── */}
      <section id="specs-translated" aria-labelledby="specs-translated-heading">
        <h2 id="specs-translated-heading">
          <Cpu aria-hidden="true" className={styles.sectionIcon} />
          Specs translated to buyer language
        </h2>

        <h3>CPU tiers, not SKUs</h3>
        <p>
          Mobile processors broadly split into low-power tiers (common
          for ultraportables and good for writing, browsing, email),
          mid-power tiers (good all-rounders for developers and creatives
          on the move), and high-performance tiers (serious multi-core
          workloads, heavy gaming, video editing — with the battery and
          heat penalties that implies). Chip generation numbers age
          quickly; the tier class is more stable as a decision frame.
        </p>

        <h3>RAM — minimum, sweet spot, overkill</h3>
        <p>
          For writing and browsing, a mid-tier amount is usually enough.
          For development, many open browser tabs, or creative apps, the
          sweet spot is higher. For large video projects or
          virtualisation, you want comfortably above the sweet spot. The
          non-negotiable question is whether the RAM is{" "}
          <strong>soldered</strong> — if yes, you must buy what you will
          need in three or four years today, because it cannot be
          upgraded.
        </p>

        <h3>SSD — capacity first, speed second</h3>
        <p>
          Running out of SSD space hurts performance and blocks OS
          updates. Speed matters for large files, but for everyday use
          capacity headroom is more important than peak read/write
          numbers. Avoid any new laptop that still ships with a mechanical
          hard drive as its primary storage.
        </p>

        <h3>Display — resolution, panel type, brightness</h3>
        <p>
          Higher resolution looks sharper but costs battery life. IPS
          gives wide angles and consistent colour; OLED gives per-pixel
          contrast and deep blacks but is more reflective and can show
          static-content wear over long time horizons; TN is now mostly
          found on the cheapest machines and usually looks poor off-axis.
          For outdoor or bright-room use, brightness in nits matters at
          least as much as resolution.
        </p>

        <h3>Battery life — claimed vs realistic</h3>
        <p>
          Manufacturer figures are produced under optimistic conditions.
          Independent measured results for mixed real-world use are
          consistently shorter. Trust independent reviews over the box
          number.
        </p>

        <h3>Thermals</h3>
        <p>
          You cannot read thermal behaviour off a spec sheet. A powerful
          CPU in a thin chassis will throttle under load, meaning your
          real-world performance is the throttled number, not the headline
          number. Reviews that run sustained-load tests are the only
          reliable signal.
        </p>
      </section>

      <ImageSlot
        n={3}
        instruction="A hand holding a slotted memory stick next to a laptop with the service cover removed. Caption: Slotted RAM extends useful life. Soldered RAM caps it at what you bought."
      />

      {/* ─────────── Section 3: Display / keyboard / ports ─────────── */}
      <section
        id="display-keyboard-ports"
        aria-labelledby="display-keyboard-ports-heading"
      >
        <h2 id="display-keyboard-ports-heading">
          <Laptop aria-hidden="true" className={styles.sectionIcon} />
          Display, keyboard, port set
        </h2>
        <p>
          These are the three parts of the laptop you touch every day —
          and the three places where cheap trade-offs hurt the most across
          the laptop&apos;s life.
        </p>
        <ul>
          <li>
            <strong>Display.</strong> Decide first on size (which drives
            weight and battery), then panel type (IPS for general use,
            OLED for contrast-sensitive work, TN to avoid on anything you
            will keep), then resolution, then refresh rate. Colour-critical
            work needs colour-accurate panels measured by independent
            reviewers.
          </li>
          <li>
            <strong>Keyboard.</strong> Travel, consistency, layout, and
            backlight (if you type in dim rooms). A tired or mushy
            keyboard is a tax paid every day of ownership.
          </li>
          <li>
            <strong>Trackpad.</strong> Precision glass trackpads are
            standard on higher-end machines and transform day-to-day use.
            On cheaper machines, test for jitter and palm-rejection.
          </li>
          <li>
            <strong>Ports.</strong> USB-C is dominant, but if you depend
            on HDMI, SD cards, or ethernet, confirm native support or
            budget for a reliable hub.
          </li>
        </ul>
      </section>

      {/* ─────────── Section 4: Longevity ─────────── */}
      <section id="longevity-repair" aria-labelledby="longevity-repair-heading">
        <h2 id="longevity-repair-heading">
          <Wrench aria-hidden="true" className={styles.sectionIcon} />
          Longevity and repairability
        </h2>
        <p>How long a laptop lasts depends on five practical things:</p>
        <ol>
          <li>
            <strong>Battery replaceability.</strong> If the battery is
            glued in and the manufacturer does not sell spares, the
            laptop&apos;s useful life is approximately the battery&apos;s
            rated cycles. Check iFixit and the manufacturer&apos;s service
            pages before you buy.
          </li>
          <li>
            <strong>RAM slotted or soldered.</strong> Slotted RAM extends
            a laptop&apos;s useful life by letting you upgrade when your
            software grows heavier. Soldered RAM caps the machine at
            whatever you chose on day one.
          </li>
          <li>
            <strong>Published service documentation.</strong> A
            manufacturer that publishes service manuals and sells spare
            parts is making a long-term commitment. A manufacturer that
            does neither is not.
          </li>
          <li>
            <strong>Chassis durability.</strong> Hinges, keyboard decks,
            and screen bezels are the first things to fail. Business-class
            chassis are usually better here than consumer-class.
          </li>
          <li>
            <strong>Software support horizon.</strong> Windows versions
            have documented end-of-support dates; ChromeOS devices have a
            published AUE (Auto Update Expiration) date; macOS support is
            time-limited but not published as a fixed per-model date.
            Buying close to any of these end dates is a false economy.
          </li>
        </ol>
        <p>
          Framework publishes modular, user-serviceable laptops as a
          benchmark for what full repairability looks like;
          iFixit&apos;s repairability scores are the most widely-cited
          measure across other manufacturers.
        </p>

        <ImageSlot
          n={4}
          instruction="An ifixit-style exploded view of a laptop's internal components with labelled modules. Caption: A published service manual is a long-term commitment from the manufacturer."
        />
      </section>

      {/* ─────────── Section 5: New / refurb / used ─────────── */}
      <section id="new-refurb-used" aria-labelledby="new-refurb-used-heading">
        <h2 id="new-refurb-used-heading">
          <ShieldCheck aria-hidden="true" className={styles.sectionIcon} />
          New, refurbished or used
        </h2>

        <h3>New</h3>
        <p>
          A new laptop comes with a full manufacturer warranty, a known
          battery condition, and current software support. The main
          pitfalls are over-buying (paying for a CPU tier you will never
          use) and under-buying longevity (soldered RAM at a capacity
          that is already tight).
        </p>

        <h3>Refurbished</h3>
        <p>
          Refurbished can be excellent value when the refurbisher is the
          manufacturer or a reputable retailer, the warranty is
          meaningful, and the condition is honestly graded. Cosmetic
          grades (A / B / C) are not standardised across retailers and
          tell you nothing about the parts of the laptop that actually
          determine its remaining life — battery condition, keyboard
          wear, hinge play, screen hours. Ask the seller, in writing,
          for:
        </p>
        <ul>
          <li>
            The battery cycle count and current full-charge capacity
            relative to design capacity.
          </li>
          <li>
            Confirmation that the hinge is firm and silent through its
            full travel.
          </li>
          <li>
            Confirmation the keyboard has been tested and no keys stick
            or fail to register.
          </li>
          <li>
            Confirmation the display has been inspected for uniformity,
            backlight bleed, retention (on OLED), and dead pixels.
          </li>
          <li>
            Confirmation the OS is activated and the previous owner&apos;s
            account is removed.
          </li>
        </ul>

        <h3>Used (private sale)</h3>
        <p>
          Private used purchases carry no warranty and no cosmetic
          grading. Inspect in person. The laptop-specific checklist is
          distinct from phones:
        </p>
        <ul>
          <li>
            <strong>Battery cycle count.</strong> On Windows, generate a
            battery report from the command line and review design
            capacity, full-charge capacity, and cycle count. On macOS,
            check the system report for cycle count and condition. A low
            cycle count relative to the manufacturer&apos;s rated
            lifetime is good; a count near or above the rated lifetime
            means pricing it as a battery-replacement job.
          </li>
          <li>
            <strong>Keyboard wear.</strong> Look at the space bar, E, A,
            S, Enter, and Backspace for shiny tops or worn legends. Type
            a paragraph and listen for any key that sounds different.
          </li>
          <li>
            <strong>Screen hours and panel wear.</strong> Display a
            full-screen bright white background to look for uneven
            brightness or dead pixels; then a black background for
            backlight bleed. On OLED, look for retention of taskbars or
            menu bars.
          </li>
          <li>
            <strong>Hinge condition.</strong> Open and close several
            times. Any creak, catch, or screen flicker during motion is a
            red flag — hinge repairs on many thin laptops are not
            economic.
          </li>
          <li>
            <strong>Windows licence status.</strong> Confirm Windows
            reports as Activated in Settings. For OEM machines the
            digital entitlement is tied to the hardware and transfers
            with ownership; machines with no visible licence state are a
            risk.
          </li>
          <li>
            <strong>Apple Activation Lock.</strong> For Macs, have the
            seller fully sign out of their Apple account and wipe the Mac
            in your presence, reaching the initial setup screen. If it
            ever asks for the previous owner&apos;s credentials, do not
            buy.
          </li>
          <li>
            <strong>BIOS / firmware lock.</strong> Confirm no BIOS
            password is set, especially on ex-corporate machines. A
            locked BIOS can make a laptop effectively unusable.
          </li>
          <li>
            <strong>Charger and charging port.</strong> A worn barrel or
            loose USB-C port is a recurring failure point that is easy to
            overlook.
          </li>
        </ul>
        <p>
          The checklist above is <strong>laptop-specific on purpose</strong>:
          battery <em>cycle count</em> rather than a battery-health
          percentage, screen <em>hours</em> and panel wear rather than
          screen scratches, <em>Activation Lock</em> rather than carrier
          blacklist, and <em>Windows licence state</em> rather than a
          phone IMEI check. Different product, different checks.
        </p>

        <ImageSlot
          n={5}
          instruction="Close-up of a battery report on screen showing cycle count and full-charge capacity. Caption: The cycle count tells you more than any grade letter."
        />
      </section>

      {/* ─────────── Section 6: FAQ ─────────── */}
      <section id="faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading">
          <CheckCircle aria-hidden="true" className={styles.sectionIcon} />
          Frequently asked questions
        </h2>
        <p>
          Short, neutral answers to the questions readers most often ask
          when researching a laptop purchase.
        </p>

        <div className={styles.faq}>
          <Faq q="How much RAM should I buy for a new laptop I want to keep for years?">
            If the RAM is soldered, buy comfortably above today&apos;s
            sweet spot for your workload — you cannot add later. If it is
            slotted, you can start at the sweet spot and upgrade when
            needed.
          </Faq>

          <Faq q="Is OLED worth it on a laptop?">
            For contrast-heavy work and video, yes. For static-UI work
            all day — spreadsheets, code editors — be aware of the
            long-horizon retention risk and the higher reflectivity.
          </Faq>

          <Faq q="What battery cycle count is acceptable on a used laptop?">
            There is no universal number; manufacturers rate their cells
            for different total cycles. A cycle count that is a small
            fraction of the rated lifetime is healthy; one near or above
            the rated lifetime should be priced as a battery-replacement
            job.
          </Faq>

          <Faq q="Can I always upgrade the RAM later?">
            Only if it is slotted. Check iFixit&apos;s teardown or the
            manufacturer&apos;s service manual before you commit. Many
            thin-and-light machines solder RAM; business and some
            performance models still slot it.
          </Faq>

          <Faq q="Will a Chromebook be supported long enough to be worth buying used?">
            Only if its Auto Update Expiration (AUE) date is still
            comfortably in the future. A Chromebook past AUE will stop
            receiving security updates and should not be bought as a
            daily driver.
          </Faq>

          <Faq q="Do I need a touchscreen?">
            Only if you will actually use it. Touchscreens add weight,
            cost, and reflectivity. If you do not already draw or use the
            tablet modes of a 2-in-1, skip it.
          </Faq>

          <Faq q="Is a bigger laptop always more powerful?">
            No, but it usually has more room for cooling, which means a
            given CPU tier can sustain its performance for longer. If you
            run heavy sustained workloads, chassis volume matters.
          </Faq>

          <Faq q="How do I know a used Mac is not Activation Locked?">
            Insist on seeing the seller sign out of their Apple account
            and wipe the Mac in front of you, then reach the initial
            setup screen. If setup ever prompts for the previous
            owner&apos;s credentials, walk away.
          </Faq>

          <Faq q="Does extended warranty make sense?">
            Sometimes. Statutory consumer rights (particularly in the UK
            and EU) already provide meaningful coverage. Read the
            extended warranty for what it adds on top — accidental
            damage, for instance, is a real extension; duplicating
            statutory rights is not.
          </Faq>

          <Faq q="What is the single biggest buyer trap?">
            Buying a laptop with soldered RAM at a capacity that is
            already tight today. Three years later the machine still
            works but no longer keeps up, and nothing can be done about
            it.
          </Faq>

          <Faq q="How do I check sustained performance before buying?">
            Read independent reviews that run a prolonged workload and
            report the stable &ldquo;after N minutes&rdquo; number. That
            stable number is what you will actually get in daily use.
          </Faq>

          <Faq q="Is a 2-in-1 worth it?">
            Only if you have a concrete, named use for the tablet or tent
            modes. Otherwise the extra hinge, weight, and keyboard-rigidity
            compromises are paid for no reason.
          </Faq>
        </div>
      </section>
    </GuideLayout>
  );
}
