// src/app/nex-native/live-commerce/guidelines/page.tsx
//
// NEX LIVE · Community + Safety Guidelines.
// Owner directive 2026-10-25 · law-firm text-UI redesign.
// Containers (card wrappers) retired; serif typography; numbered
// Roman-numeral sections with bulleted sub-items; generous line
// height; parchment-cream text on NEX navy. No cards. No borders.
//
// Honest status (unchanged):
//   · Draft policy copy · owner-authored for prototype. Final legal
//     wording pending separate legal review.
//   · No DB write, no account mutation. Read-only policy page.

import Link from "next/link";

export const metadata = {
  title: "NEX LIVE · Guidelines",
  description:
    "Community and safety guidelines for broadcasting on NEX LIVE, and NEX's rights to suspend accounts.",
};

const NEX = {
  bg: "#06101E",
  ink: "#EFE8D5",         // parchment · body text
  inkMuted: "#A89F89",    // muted parchment · meta / footer
  gold: "#C8A96A",        // soft gold · rules + section tags
  cyan: "#00AFFF",        // kept only for the Back link
  rule: "rgba(200, 169, 106, 0.32)",
} as const;

const SERIF =
  "Georgia, 'Times New Roman', 'Palatino', 'Palatino Linotype', ui-serif, serif";

interface Rule {
  readonly title: string;
  readonly body: string;
}

const COMMUNITY: ReadonlyArray<Rule> = [
  {
    title: "Be kind, be yourself.",
    body:
      "Treat everyone with respect. Different opinions are welcome; bullying and harassment are not.",
  },
  {
    title: "Keep your private life private.",
    body:
      "Protect passwords, private messages, financial details, and personal information. Ask before sharing another person's photo, voice, or story.",
  },
  {
    title: "Help everyone feel welcome.",
    body:
      "Keep your broadcast suitable for your intended audience. Avoid hateful, threatening, sexually exploitative, or dangerous content.",
  },
  {
    title: "Share honestly.",
    body:
      "Be genuine about products, services, and offers. Respect copyright and the rules of any connected platform.",
  },
  {
    title: "You are in control.",
    body:
      "You choose where to go LIVE. If something feels wrong, you may stop your broadcast, block or report another user, and take a break.",
  },
];

const RIGHTS: ReadonlyArray<Rule> = [
  {
    title: "Your content is your responsibility.",
    body:
      "You remain accountable for the words, images, audio, and video you broadcast, and for any claims you make about products, services, or other people.",
  },
  {
    title: "NEX may suspend accounts at any time, without notice.",
    body:
      "If content or behaviour breaks these guidelines or threatens the safety of the community, NEX may pause, restrict, or remove the account immediately and without prior warning.",
  },
  {
    title: "Local laws apply.",
    body:
      "You are responsible for ensuring your broadcast does not break the law in your location or in the locations of your viewers.",
  },
  {
    title: "Reports and takedowns.",
    body:
      "NEX may remove content that is reported, flagged by moderation, or found to be in breach of these guidelines. You may stop your own broadcast, block or report another user, or take a break at any time.",
  },
];

export default function LiveGuidelinesPage(): React.JSX.Element {
  return (
    <main
      data-nex-live-guidelines
      style={{
        minHeight: "100vh",
        background: NEX.bg,
        color: NEX.ink,
        fontFamily: SERIF,
        padding:
          "max(24px, env(safe-area-inset-top, 0px)) 24px calc(env(safe-area-inset-bottom, 0px) + 40px)",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        [data-nex-live-guidelines] p { margin: 0; }
        [data-nex-live-guidelines] a { color: inherit; }
        [data-nex-live-guidelines] ol[data-section] { list-style: none; padding: 0; margin: 0; }
        [data-nex-live-guidelines] ol[data-section] > li {
          position: relative;
          padding-left: 2.1em;
          margin: 0 0 1.1em;
          line-height: 1.65;
        }
        [data-nex-live-guidelines] ol[data-section] > li::before {
          position: absolute;
          left: 0;
          top: 0;
          content: counter(nex-rule, decimal) ".";
          counter-increment: nex-rule;
          font-weight: 700;
          color: ${NEX.gold};
          font-size: 0.95em;
          min-width: 1.6em;
          text-align: right;
          padding-right: 0.5em;
        }
        [data-nex-live-guidelines] ol[data-section] { counter-reset: nex-rule; }
      `}</style>

      <article
        style={{
          maxWidth: 580,
          margin: "0 auto",
          fontSize: 15,
          lineHeight: 1.65,
        }}
      >
        {/* Top nav · unobtrusive Back link */}
        <nav style={{ marginBottom: 22 }}>
          <Link
            href="/nex-native/live-commerce/welcome"
            data-nex-live-guidelines-back
            style={{
              color: NEX.cyan,
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
              fontSize: 12.5,
              textDecoration: "none",
              letterSpacing: "0.02em",
            }}
          >
            ← Back
          </Link>
        </nav>

        {/* Masthead · small-caps serif · law-firm style */}
        <header style={{ textAlign: "center", marginBottom: 22 }}>
          <div
            style={{
              fontSize: 10.5,
              letterSpacing: "0.42em",
              textTransform: "uppercase",
              color: NEX.gold,
              marginBottom: 10,
            }}
          >
            NEX LIVE
          </div>
          <h1
            style={{
              margin: "0 0 10px",
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.005em",
              color: NEX.ink,
            }}
          >
            Community &amp; Safety Guidelines
          </h1>
          <div
            style={{
              fontSize: 13.5,
              fontStyle: "italic",
              color: NEX.inkMuted,
            }}
          >
            A statement of what is expected of broadcasters, and of NEX&apos;s
            rights to protect the community.
          </div>
        </header>

        <hr
          aria-hidden
          style={{
            border: 0,
            borderTop: `1px solid ${NEX.rule}`,
            margin: "28px 0 28px",
          }}
        />

        {/* Section I. */}
        <section style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: NEX.gold,
              marginBottom: 10,
            }}
          >
            Article I
          </div>
          <h2
            style={{
              margin: "0 0 14px",
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.2,
              color: NEX.ink,
            }}
          >
            Community Guidelines
          </h2>
          <p
            style={{
              marginBottom: 18,
              color: NEX.ink,
              fontStyle: "italic",
            }}
          >
            Treat NEX LIVE as a shared space with a real audience. The following
            apply to every broadcast you choose to open.
          </p>
          <ol data-section>
            {COMMUNITY.map((r) => (
              <li key={r.title}>
                <strong style={{ fontWeight: 700 }}>{r.title}</strong>{" "}
                <span style={{ color: NEX.ink }}>{r.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <hr
          aria-hidden
          style={{
            border: 0,
            borderTop: `1px solid ${NEX.rule}`,
            margin: "4px 0 28px",
          }}
        />

        {/* Section II. */}
        <section style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: NEX.gold,
              marginBottom: 10,
            }}
          >
            Article II
          </div>
          <h2
            style={{
              margin: "0 0 14px",
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1.2,
              color: NEX.ink,
            }}
          >
            Your Account &amp; NEX&apos;s Rights
          </h2>
          <p
            style={{
              marginBottom: 18,
              color: NEX.ink,
              fontStyle: "italic",
            }}
          >
            Broadcasting on NEX LIVE is a privilege extended under these terms
            and may be withdrawn by NEX at any time.
          </p>
          <ol data-section>
            {RIGHTS.map((r) => (
              <li key={r.title}>
                <strong style={{ fontWeight: 700 }}>{r.title}</strong>{" "}
                <span style={{ color: NEX.ink }}>{r.body}</span>
              </li>
            ))}
          </ol>
        </section>

        <hr
          aria-hidden
          style={{
            border: 0,
            borderTop: `1px solid ${NEX.rule}`,
            margin: "4px 0 24px",
          }}
        />

        {/* Honest footer · unchanged content, italicised */}
        <footer
          style={{
            fontSize: 12,
            fontStyle: "italic",
            color: NEX.inkMuted,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Draft policy · pending legal review. The checkbox and call-to-action on
          the Welcome page are a concept preview and do not start a live
          broadcast.
        </footer>
      </article>
    </main>
  );
}
