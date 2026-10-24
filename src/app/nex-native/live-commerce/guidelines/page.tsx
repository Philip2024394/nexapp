// src/app/nex-native/live-commerce/guidelines/page.tsx
//
// Owner directive 2026-10-24 · "link the user can read for live
// posting online nex and suspended accounts". Full NEX LIVE
// community + safety guidelines surface · linked from the welcome
// page so the welcome itself can stay one-screen.
//
// Honest status:
//   · Draft policy copy · owner-authored for prototype. Final legal
//     wording is pending a separate legal review pass. Do not treat
//     this surface as a signed legal document.
//   · No DB write, no account mutation. This is a read-only policy
//     page served statically from this route.

import Link from "next/link";

export const metadata = {
  title: "NEX LIVE · Guidelines",
  description:
    "Community and safety guidelines for broadcasting on NEX LIVE, and NEX's rights to suspend accounts.",
};

const NEX = {
  bg: "#06101E",
  surface: "#0E1A2E",
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  cyan: "#00AFFF",
  gold: "#FFC24B",
  border: "rgba(0, 175, 255, 0.28)",
} as const;

const GUIDELINES: ReadonlyArray<{ readonly title: string; readonly body: string }> = [
  {
    title: "Be kind, be yourself",
    body:
      "Treat everyone with respect. Different opinions are welcome; bullying and harassment aren't.",
  },
  {
    title: "Keep your private life private",
    body:
      "Protect passwords, private messages, financial details and personal information. Ask before sharing someone else's photo, voice or story.",
  },
  {
    title: "Help everyone feel welcome",
    body:
      "Keep your LIVE suitable for your intended audience. Avoid hateful, threatening, sexually exploitative or dangerous content.",
  },
  {
    title: "Share honestly",
    body:
      "Be genuine about products, services and offers. Respect copyright and the rules of any connected platform.",
  },
  {
    title: "You're in control",
    body:
      "You choose where to go LIVE. If something feels wrong, you can stop your broadcast, block or report someone, and take a break.",
  },
];

export default function LiveGuidelinesPage(): React.JSX.Element {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding:
          "max(20px, env(safe-area-inset-top, 0px)) 20px calc(env(safe-area-inset-bottom, 0px) + 32px)",
      }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <nav style={{ marginBottom: 12 }}>
          <Link
            href="/nex-native/live-commerce/welcome"
            data-nex-live-guidelines-back
            style={{
              color: NEX.cyan,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            ← Back
          </Link>
        </nav>

        <h1
          style={{
            margin: "0 0 4px",
            fontSize: 24,
            fontWeight: 900,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
          }}
        >
          NEX LIVE · Guidelines
        </h1>
        <div
          style={{
            fontSize: 13,
            color: NEX.gold,
            fontWeight: 700,
            marginBottom: 20,
            letterSpacing: "0.02em",
          }}
        >
          Community &amp; safety · what to expect · your responsibilities
        </div>

        <section style={{ marginBottom: 24 }}>
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
            }}
          >
            Community guidelines
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {GUIDELINES.map((g) => (
              <div
                key={g.title}
                data-nex-live-guideline
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: NEX.surface,
                  border: `1px solid ${NEX.border}`,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
                  {g.title}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    color: NEX.textDim,
                  }}
                >
                  {g.body}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          data-nex-live-guidelines-protection
          style={{
            marginBottom: 24,
            padding: "14px 16px",
            borderRadius: 12,
            background: "rgba(255, 51, 85, 0.08)",
            border: "1px solid rgba(255, 51, 85, 0.35)",
          }}
        >
          <h2
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#FF6B81",
            }}
          >
            Your account &amp; NEX&apos;s rights
          </h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 13.5,
              lineHeight: 1.5,
              color: NEX.text,
            }}
          >
            <li>
              <strong>What you post on NEX LIVE is your responsibility.</strong>{" "}
              You remain accountable for the words, images, audio and video you
              broadcast, and for any claims you make about products, services
              or other people.
            </li>
            <li>
              <strong>
                NEX may suspend accounts at any time, without notice.
              </strong>{" "}
              If content or behaviour breaks these guidelines or threatens the
              safety of the community, NEX can pause, restrict or remove the
              account immediately and without prior warning.
            </li>
            <li>
              <strong>Local laws apply.</strong> You are responsible for
              ensuring your broadcast does not break the law in your location
              or in the locations of your viewers.
            </li>
            <li>
              <strong>Reports and takedowns.</strong> NEX can remove content
              that is reported, flagged by moderation, or found to be in breach
              of these guidelines. You can also stop your own broadcast, block
              or report someone, or take a break at any time.
            </li>
          </ul>
        </section>

        <div
          style={{
            fontSize: 11.5,
            color: NEX.textDim,
            lineHeight: 1.45,
            textAlign: "center",
            opacity: 0.9,
          }}
        >
          Draft policy · pending legal review. The checkbox and CTA on the
          Welcome page are a concept preview and do not start a live broadcast.
        </div>
      </div>
    </div>
  );
}
