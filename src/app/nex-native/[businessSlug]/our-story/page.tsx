// src/app/nex-native/[businessSlug]/our-story/page.tsx
//
// NEX shop · per-shop long-form "Our story" page. Owner-authorised
// 2026-11-28 for the X-Rated Tool Belts shop. Content supplied verbatim
// by the owner (Why + About brand copy).
//
// Doctrine
//   · Slug-dispatched content. Only shops that have a long-form entry
//     in STORY_CONTENT render a page · other slugs resolve to
//     notFound() so the sub-route stays hidden for shops that have not
//     yet authored this material.
//   · Static marketing copy · no DB writes · no user state.
//   · Shop theme-neutral palette (Warm Ivory background · ink text ·
//     orange accent) matching the sealed X-Rated drawer backdrop.
//   · Back link returns to the storefront. The storefront's chat FAB
//     remains the single sealed path for customer messages · we do
//     NOT duplicate the chat affordance here beyond a plain CTA that
//     deep-links into the same /nex-native/<slug>?open-chat=1 flow.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/nex-native/business-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Palette ────────────────────────────────────────────────────────

const PALETTE = {
  bg: "#FFF9E9", // Warm Ivory · same base as the shop drawer
  surface: "#FFFFFF",
  ink: "#0A1526",
  inkDim: "#4B5468",
  accent: "#F97316", // orange · same hue as the X-Rated drawer rim
  accentDeep: "#B45309",
  rule: "rgba(10, 21, 38, 0.12)",
} as const;

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF =
  "Georgia, 'Times New Roman', 'Noto Serif', 'Playfair Display', serif";

// ─── Content ────────────────────────────────────────────────────────
//
// Keyed by shop slug. Each entry has a page title, subtitle, and an
// ordered list of sections. A section is either a prose block (H2 +
// paragraphs) or a bullet block (H2 + items). The "why" and "about"
// super-sections are rendered as two H1 blocks separated by a divider.

interface StorySection {
  readonly heading: string;
  readonly kind: "prose" | "bullets";
  readonly body: readonly string[];
  /** Bullet lead-in label rendered in bold before the colon. */
  readonly bulletLeadStyle?: "bold-lead";
}

interface StoryArea {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly sections: readonly StorySection[];
}

interface StoryContent {
  readonly browserTitle: string;
  readonly metaDescription: string;
  readonly intro: StoryArea; // "WHY ..."
  readonly aboutArea: StoryArea; // "ABOUT ..."
  readonly closing: {
    readonly heading: string;
    readonly lines: readonly string[];
    readonly ctaLabel: string;
    readonly signature: string;
    readonly tagline: string;
  };
}

const STORY_CONTENT: Record<string, StoryContent> = {
  "x-rated-tool-belts": {
    browserTitle: "Our story · X-Rated Tool Belts",
    metaDescription:
      "Why X-Rated Tool Belts and about the brand · innovation, premium materials and professional-grade equipment designed to stand apart.",
    intro: {
      eyebrow: "WHY X-RATED TOOL BELTS?",
      title: "Don't Follow the Industry. Lead It.",
      subtitle:
        "Choosing the right tool belt supplier is about more than buying another product. It's about offering equipment that stands out, performs exceptionally and gives your customers a reason to choose your brand.",
      sections: [
        {
          heading: "Innovation at the Core",
          kind: "prose",
          body: [
            "At X-Rated Tool Belts, we combine innovative design, premium materials and an understanding of the professional trades to create equipment that challenges conventional standards.",
            "We don't simply follow market trends. We work to stay ahead of them.",
          ],
        },
        {
          heading: "The Next Generation of Scaffolding Rigs",
          kind: "prose",
          body: [
            "We are proud to develop some of the most advanced and contemporary scaffolding rigs in our product range, designed around the practical demands of today's professional scaffolders.",
            "Our approach goes beyond traditional belt designs. We focus on intelligent layouts, robust construction, functionality and the details that make a difference on the job.",
            "We continually look for ways to improve what is available, creating equipment that gives professionals something genuinely different.",
          ],
        },
        {
          heading: "A Design for Every Trade",
          kind: "prose",
          body: [
            "No two trades work in exactly the same way. That's why we believe professional equipment should never be limited to a one-design-fits-all approach.",
            "From scaffolding rigs and tool belts to specialist holders, pouches and trade accessories, our ambition is to offer designs suited to the requirements of different industries.",
            "Whether your customers work in construction, carpentry, electrical installation, roofing, plumbing or other specialist trades, we aim to provide equipment that matches the way they work.",
            "And if you have a particular design or requirement in mind, we're always ready to discuss the challenge.",
          ],
        },
        {
          heading: "Premium Materials. Professional Standards.",
          kind: "prose",
          body: [
            "A great design means nothing without the quality to support it.",
            "X-Rated Belts places strong emphasis on premium materials, dependable construction and robust manufacturing standards.",
            "We focus on the details that matter: material selection, stitching, strength, durability, usability and finishing.",
            "Quality control is considered throughout the production process, with the objective of delivering products that meet the expectations of professional users and businesses.",
          ],
        },
        {
          heading: "Retail-Ready Packaging. Wholesale-Ready Supply.",
          kind: "prose",
          body: [
            "We understand that our products need to work for more than the end user. They also need to work for the businesses that stock and sell them.",
            "That's why we consider presentation and packaging as part of the complete product experience.",
            "Our aim is to provide professional product presentation suitable for retail shelves, trade suppliers, wholesalers and distributors, helping our partners offer something distinctive to their customers.",
            "We want X-Rated Belts to look the part, perform the part and give retailers a product range they can be proud to display.",
          ],
        },
        {
          heading: "We Understand Your Industry.",
          kind: "prose",
          body: [
            "Our team understands that every market has its own demands, challenges and expectations.",
            "We approach product development with a practical mindset, combining creative thinking with robust design standards and an appreciation of how professional tradespeople actually work.",
            "We welcome new ideas, specialist requirements and opportunities to develop products that answer real market needs.",
            "We are always prepared to take on a new belt challenge, explore a different design and work towards a result that meets our quality expectations.",
          ],
        },
        {
          heading: "Your Business. Our Products. A Stronger Partnership.",
          kind: "prose",
          body: [
            "Whether you are an independent retailer, established wholesaler, trade supplier or distributor, we want to hear from you.",
            "We are interested in building relationships with businesses that want to offer their customers something beyond ordinary, mass-produced equipment.",
            "Let's discuss your market, your customers and the products you want to put on your shelves.",
            "From individual product enquiries to larger wholesale requirements and custom design discussions, our team is ready to hear from you.",
          ],
        },
      ],
    },
    aboutArea: {
      eyebrow: "ABOUT X-RATED TOOL BELTS",
      title: "Built Beyond Ordinary. Designed to Lead.",
      subtitle:
        "At X-Rated Tool Belts, we believe professional tradespeople deserve equipment that works as hard as they do.",
      sections: [
        {
          heading: "A Forward-Thinking Brand",
          kind: "prose",
          body: [
            "We are more than a tool belt and accessories supplier. We are a forward-thinking brand driven by innovation, precision, performance and an uncompromising commitment to quality.",
            "Based in Indonesia, we are building a new generation of professional tool belts and trade accessories designed to challenge conventional products and raise expectations across the industry.",
            "We don't believe in simply reproducing what has been done before. We believe in moving forward.",
          ],
        },
        {
          heading: "Innovation Without Compromise",
          kind: "prose",
          body: [
            "The industry has relied on mass-produced, conventional designs for too long. At X-Rated Tool Belts, we look beyond what already exists.",
            "We continually research, develop and refine our products, focusing on practical improvements, intelligent design and features that make a genuine difference to the people who use them every day.",
            "Our ambition is simple: to create products that stand apart in their respective industries, delivering performance, durability and functionality that exceed expectations.",
            "Every product begins with a purpose. Every detail has a reason.",
          ],
        },
        {
          heading: "Premium Materials. Advanced Manufacturing.",
          kind: "prose",
          body: [
            "Quality is not something we add at the end of production. It is built into every stage of the process.",
            "We carefully select premium materials and use modern manufacturing equipment, advanced production techniques and precision machinery to bring our designs to life.",
            "From material selection and construction through to finishing and final inspection, quality control is an essential part of our production process.",
            "We pay attention to the details that matter: strength, stitching, construction, durability, comfort and everyday usability.",
            "Our objective is to deliver equipment that professionals can depend on, day after day, job after job.",
          ],
        },
        {
          heading: "Designed for Professionals. Made for Real Work.",
          kind: "prose",
          body: [
            "We understand that professional equipment must do more than look good.",
            "It must perform under pressure, withstand demanding working environments and make the working day more efficient.",
            "That's why we focus on practical design, intelligent storage, dependable construction and thoughtful features that serve the needs of modern tradespeople.",
            "Whether you work in construction, carpentry, electrical installation, roofing, plumbing or another demanding trade, our goal is to provide equipment that earns its place on your job site.",
          ],
        },
        {
          heading: "Proudly Based in Indonesia. Connected to the World.",
          kind: "prose",
          body: [
            "Indonesia is where our journey is based, but our ambitions extend far beyond our borders.",
            "We aim to make premium X-Rated Tool Belts products accessible to professional customers and trade businesses around the world.",
            "We offer international shipping options, with suitable orders dispatched by international courier or air freight, depending on destination, product availability, shipment size and customer requirements.",
            "From Indonesia to international markets, we are committed to making our products available to customers wherever their work takes them.",
            "For larger orders, wholesale enquiries and international distribution opportunities, our team welcomes direct enquiries.",
          ],
        },
        {
          heading: "Our Commitment",
          kind: "bullets",
          bulletLeadStyle: "bold-lead",
          body: [
            "Innovation: Continuously research, develop and improve our products.",
            "Quality: Select premium materials and maintain quality control throughout production.",
            "Performance: Design equipment around the real demands of professional trades.",
            "Precision: Pay attention to construction, functionality and the smallest details.",
            "Progress: Embrace modern manufacturing methods and new ideas.",
            "Global Reach: Connect our Indonesian-based business with customers and trade partners worldwide.",
          ],
        },
      ],
    },
    closing: {
      heading: "READY TO STOCK SOMETHING DIFFERENT?",
      lines: [
        "Give your customers a reason to look beyond the ordinary.",
        "Get in touch with X-Rated Tool Belts and let's explore how we can help stock your shelves with distinctive professional equipment that puts your business ahead.",
      ],
      ctaLabel: "Contact our team",
      signature: "X-RATED TOOL BELTS",
      tagline: "Designed to Stand Apart. Built for the Professionals.",
    },
  },
};

// ─── Metadata ────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ businessSlug: string }>;
}): Promise<Metadata> {
  const { businessSlug } = await params;
  const story = STORY_CONTENT[businessSlug];
  if (!story) return {};
  return {
    title: story.browserTitle,
    description: story.metaDescription,
  };
}

// ─── Page ────────────────────────────────────────────────────────────

export default async function OurStoryPage({
  params,
}: {
  readonly params: Promise<{ businessSlug: string }>;
}): Promise<React.JSX.Element> {
  const { businessSlug } = await params;
  const story = STORY_CONTENT[businessSlug];
  if (!story) notFound();

  // Verify the shop actually exists · stale STORY_CONTENT entries for
  // deleted shops should not render.
  const shop = await getBusinessBySlug(businessSlug);
  if (!shop) notFound();

  const shopHref = `/nex-native/${encodeURIComponent(businessSlug)}`;
  const chatHref = `${shopHref}?open-chat=1`;

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: PALETTE.bg,
        color: PALETTE.ink,
        fontFamily: SANS,
        padding: "28px 18px 56px",
      }}
      data-nex-shop-our-story
      data-nex-shop-our-story-slug={businessSlug}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Back strip */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 22,
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: PALETTE.inkDim,
          }}
        >
          <Link
            href={shopHref}
            data-nex-shop-our-story-back
            style={{
              color: PALETTE.accentDeep,
              textDecoration: "none",
              borderBottom: `1px solid ${PALETTE.accent}`,
              paddingBottom: 2,
            }}
          >
            ← Back to shop
          </Link>
          <span aria-hidden style={{ opacity: 0.45 }}>
            ·
          </span>
          <span>{shop.display_name ?? businessSlug}</span>
        </nav>

        {/* Area 1 · Why */}
        <StoryAreaView area={story.intro} />

        {/* Divider between Why and About */}
        <hr
          style={{
            border: "none",
            borderTop: `1px solid ${PALETTE.rule}`,
            margin: "48px 0 40px",
          }}
          aria-hidden
        />

        {/* Area 2 · About */}
        <StoryAreaView area={story.aboutArea} />

        {/* Closing block · ready to stock something different */}
        <section
          style={{
            marginTop: 48,
            padding: "28px 24px",
            borderRadius: 14,
            background: PALETTE.surface,
            border: `1px solid ${PALETTE.rule}`,
            boxShadow: "0 8px 24px rgba(10,21,38,0.06)",
          }}
          data-nex-shop-our-story-closing
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: PALETTE.accentDeep,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              marginBottom: 6,
            }}
          >
            {story.closing.heading}
          </div>
          {story.closing.lines.map((line, i) => (
            <p
              key={i}
              style={{
                margin: "6px 0",
                fontSize: 15,
                lineHeight: 1.65,
                color: PALETTE.ink,
              }}
            >
              {line}
            </p>
          ))}
          <div style={{ marginTop: 18 }}>
            <Link
              href={chatHref}
              data-nex-shop-our-story-cta
              style={{
                display: "inline-block",
                padding: "11px 22px",
                borderRadius: 999,
                background: PALETTE.accent,
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                boxShadow: "0 6px 16px rgba(249,115,22,0.35)",
              }}
            >
              {story.closing.ctaLabel}
            </Link>
          </div>
          <div
            style={{
              marginTop: 22,
              paddingTop: 16,
              borderTop: `1px solid ${PALETTE.rule}`,
              fontFamily: SERIF,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: PALETTE.ink,
                letterSpacing: "0.02em",
              }}
            >
              {story.closing.signature}
            </div>
            <div
              style={{
                fontSize: 13,
                color: PALETTE.inkDim,
                marginTop: 4,
                fontStyle: "italic",
              }}
            >
              {story.closing.tagline}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

// ─── Area renderer ───────────────────────────────────────────────────

function StoryAreaView({
  area,
}: {
  readonly area: StoryArea;
}): React.JSX.Element {
  return (
    <section data-nex-shop-our-story-area>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: PALETTE.accentDeep,
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          marginBottom: 8,
        }}
        data-nex-shop-our-story-eyebrow
      >
        {area.eyebrow}
      </div>
      <h1
        style={{
          margin: "0 0 10px",
          fontFamily: SERIF,
          fontSize: 32,
          lineHeight: 1.15,
          fontWeight: 800,
          letterSpacing: "0.005em",
          color: PALETTE.ink,
        }}
      >
        {area.title}
      </h1>
      <p
        style={{
          margin: "0 0 28px",
          fontSize: 16,
          lineHeight: 1.65,
          color: PALETTE.inkDim,
        }}
      >
        {area.subtitle}
      </p>

      {area.sections.map((section) => (
        <div
          key={section.heading}
          style={{ marginBottom: 24 }}
          data-nex-shop-our-story-section
        >
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: 20,
              fontWeight: 800,
              margin: "0 0 10px",
              color: PALETTE.ink,
              letterSpacing: "0.005em",
            }}
          >
            {section.heading}
          </h2>
          {section.kind === "prose" ? (
            section.body.map((para, i) => (
              <p
                key={i}
                style={{
                  margin: "0 0 10px",
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: PALETTE.ink,
                }}
              >
                {para}
              </p>
            ))
          ) : (
            <ul
              style={{
                margin: "0 0 10px",
                paddingLeft: 20,
                listStyle: "disc",
              }}
            >
              {section.body.map((item, i) => (
                <li
                  key={i}
                  style={{
                    margin: "4px 0",
                    fontSize: 15,
                    lineHeight: 1.65,
                    color: PALETTE.ink,
                  }}
                >
                  {renderBullet(item, section.bulletLeadStyle)}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

function renderBullet(
  text: string,
  style: StorySection["bulletLeadStyle"],
): React.ReactNode {
  if (style !== "bold-lead") return text;
  const colonAt = text.indexOf(":");
  if (colonAt <= 0) return text;
  const lead = text.slice(0, colonAt);
  const rest = text.slice(colonAt);
  return (
    <>
      <strong>{lead}</strong>
      {rest}
    </>
  );
}
