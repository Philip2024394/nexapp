// src/app/nex-native/privacy/page.tsx
//
// NEX Privacy Policy · public.
// -------------------------------------------------------------------
// Companion to the sealed /nex-native/terms page. Written as a
// GOOD-FAITH FOUNDATION covering the standard SaaS / chat-first
// commerce categories:
//
//   1. What data NEX collects
//   2. How NEX uses that data
//   3. Who NEX shares it with
//   4. User rights (access, correct, delete, export)
//   5. Cookies and local storage
//   6. Children
//   7. International transfers
//   8. Security
//   9. Changes to this policy
//  10. Contact
//
// IMPORTANT · owner-authorised 2026-10-19:
//   This document is a HONEST TEMPLATE grounded in NEX's actual
//   product behaviour (chat-first · never handles payments ·
//   Supabase-backed · PWA · optional WebAuthn · optional ECB-sourced
//   FX display · opt-in discovery signals). It is NOT a substitute
//   for review by a licensed solicitor / privacy counsel before
//   public launch · particularly for the jurisdictions NEX actually
//   operates in (Indonesia primary · international travellers via
//   the directory). A sealed banner at the top of the document
//   discloses the review status to viewers so no one is misled.
//
// Visual pattern mirrors /nex-native/terms for consistency.

import type * as React from "react";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  panelBorder: "rgba(0,175,255,0.18)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.35)",
  orange: "#FF7200",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Fixed effective date · update when the policy is amended. */
const EFFECTIVE_DATE = "2026-10-19";

export default function PrivacyPolicyPage(): React.ReactElement {
  return (
    <main
      data-nex-privacy-root
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        padding:
          "calc(env(safe-area-inset-top, 0px) + 20px) 18px calc(env(safe-area-inset-bottom, 0px) + 40px)",
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ marginBottom: 18 }}>
          <Link
            href="/nex-native"
            style={{
              display: "inline-block",
              marginBottom: 10,
              fontSize: 12,
              color: NEX.cyan,
              textDecoration: "none",
            }}
          >
            ← NEX
          </Link>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: "-0.015em",
              color: NEX.text,
            }}
          >
            Privacy Policy
          </h1>
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: NEX.textDim,
            }}
          >
            Effective {EFFECTIVE_DATE}
          </p>
        </header>

        {/* Honesty disclosure · this template is a foundation ·
            formal privacy counsel review precedes public launch. */}
        <section style={bannerStyle} aria-label="Draft notice">
          <strong style={{ color: NEX.text }}>Draft foundation.</strong>{" "}
          This policy describes NEX's current product behaviour
          honestly. It is subject to formal privacy-counsel review
          before public launch and may be amended as NEX adds
          features, enters new jurisdictions, or signs data
          processors. We will notify active users of any material
          change in writing via the account email on file.
        </section>

        <Section title="1 · What we collect">
          <p style={paragraphStyle}>
            NEX collects only what it needs to operate the service
            you asked for:
          </p>
          <ul style={listStyle}>
            <li>
              <strong style={strongStyle}>Account basics</strong>{" "}
              · the email address, display name, chosen NEX handle,
              phone number (optional at signup), country / locale,
              and the salted password hash maintained by our
              authentication provider (Supabase Auth).
            </li>
            <li>
              <strong style={strongStyle}>Chat and content you
              create</strong> · messages you send, media you share,
              profile details you set, business listings you own,
              themes you apply, and products or services you choose
              to display in the NEX Directory.
            </li>
            <li>
              <strong style={strongStyle}>Device + session
              signals</strong> · a correlation ID per request for
              debugging, your approximate location only when you
              explicitly grant it, timestamps of when you signed in,
              and the device type sent in your browser's User-Agent
              header. We do not fingerprint you across sites.
            </li>
            <li>
              <strong style={strongStyle}>Optional biometric
              credential</strong> · if you set up Face Sign-In, a
              WebAuthn public key is stored on NEX. The private key
              and the actual biometric template never leave your
              device.
            </li>
            <li>
              <strong style={strongStyle}>Opt-in discovery
              signals</strong> · if NEX's personalisation
              surface is enabled on your account, we record which
              directory cards you view, tap, chat with, save, or
              dismiss. The signal store is scoped to your account
              and is used ONLY to re-rank what you see. You can
              clear it from Settings · Privacy at any time.
            </li>
          </ul>
          <p style={paragraphStyle}>
            NEX does NOT collect: payment card data (we never handle
            payments or escrow), government ID documents, your
            contacts' phone books, your social-media accounts, or
            any health data.
          </p>
        </Section>

        <Section title="2 · How we use it">
          <ul style={listStyle}>
            <li>
              Provide the chat, directory, and business surfaces you
              requested when you created an account.
            </li>
            <li>
              Keep your account secure (sign-in, session refresh,
              rate-limiting, abuse review).
            </li>
            <li>
              Respond to support requests and reports (yours or
              about you).
            </li>
            <li>
              Operate the Directory discovery experience · including
              optional personalised ranking when you've enabled it.
            </li>
            <li>
              Convert prices to your chosen currency using daily
              European Central Bank reference rates (via
              frankfurter.app). The currency choice sits in a cookie
              on your device; the rate itself is public data.
            </li>
            <li>
              Comply with our legal obligations, enforce our Terms,
              and defend NEX against claims when required.
            </li>
          </ul>
          <p style={paragraphStyle}>
            NEX does NOT: sell your personal data, share it with
            advertisers for cross-site targeting, train third-party
            AI models on your private chats, or use your content for
            marketing without your explicit permission.
          </p>
        </Section>

        <Section title="3 · Who we share with">
          <p style={paragraphStyle}>
            NEX shares data only with the processors it needs to run
            the service, and only to the extent each needs to do its
            job:
          </p>
          <ul style={listStyle}>
            <li>
              <strong style={strongStyle}>Supabase</strong> · database,
              authentication, storage, and realtime infrastructure.
            </li>
            <li>
              <strong style={strongStyle}>Vercel</strong> · hosting
              and edge delivery of the NEX application.
            </li>
            <li>
              <strong style={strongStyle}>Postmark</strong> ·
              transactional email delivery (sign-in confirmations,
              password resets, operational notices).
            </li>
            <li>
              <strong style={strongStyle}>frankfurter.app /
              European Central Bank</strong> · public FX reference
              rates for display conversion. No personal data is sent
              · we fetch rates once a day for all users at once.
            </li>
          </ul>
          <p style={paragraphStyle}>
            If NEX ever adds another processor, we will update this
            page before the new processor goes live and tell you via
            the account email on file. We never share your private
            messages with any third party except where legally
            compelled to by a valid court order addressed to NEX.
          </p>
          <p style={paragraphStyle}>
            Businesses you contact in the NEX Directory see what
            you've told them in-chat PLUS the public identity you
            chose for your profile. They never see your email, phone
            number, or any data you haven't explicitly provided to
            them.
          </p>
        </Section>

        <Section title="4 · Your rights">
          <p style={paragraphStyle}>
            You can at any time:
          </p>
          <ul style={listStyle}>
            <li>
              <strong style={strongStyle}>Access</strong> your
              account data via Settings · Account.
            </li>
            <li>
              <strong style={strongStyle}>Correct</strong> any
              inaccurate information in Settings · Profile.
            </li>
            <li>
              <strong style={strongStyle}>Delete</strong> your
              account via Settings · Account · Delete account. This
              removes your account row, your messages, your profile
              data, your Discovery signals, and your WebAuthn
              credential. Cached search snippets and law-enforcement
              hold items may survive deletion where legally required
              · we will tell you if that applies to your deletion.
            </li>
            <li>
              <strong style={strongStyle}>Export</strong> a copy of
              your data by writing to the contact address below.
              We'll respond within 30 days with a JSON archive of
              everything NEX holds about you.
            </li>
            <li>
              <strong style={strongStyle}>Opt out of personalised
              discovery</strong> at any time in Settings · Privacy.
              Opt-out clears your signal history.
            </li>
            <li>
              <strong style={strongStyle}>Lodge a complaint</strong>{" "}
              with your local data-protection authority if you
              believe we are mishandling your data.
            </li>
          </ul>
        </Section>

        <Section title="5 · Cookies + local storage">
          <p style={paragraphStyle}>
            NEX uses a small number of first-party cookies and local-
            storage entries, all strictly necessary for the service
            to function:
          </p>
          <ul style={listStyle}>
            <li>
              <strong style={strongStyle}>Session cookies</strong>{" "}
              (Supabase sb-* · session refresh) · keeps you signed
              in · deleted on sign-out.
            </li>
            <li>
              <strong style={strongStyle}>Correlation ID header</strong>{" "}
              (per request, not stored) · lets us trace errors you
              report back to the exact server request.
            </li>
            <li>
              <strong style={strongStyle}>Preference cookies</strong>{" "}
              · your chosen display currency, your directory sort
              seed (15-min TTL), dismissal flags for one-shot
              banners. Each has a short TTL and no cross-site reach.
            </li>
            <li>
              <strong style={strongStyle}>Local storage</strong> ·
              your in-flight cart contents (purely client-side ·
              never sent to NEX until you check out), draft messages,
              and the install-home-screen prompt dismissal flag.
            </li>
          </ul>
          <p style={paragraphStyle}>
            NEX does not use advertising cookies, tracking pixels,
            session replay, or any third-party analytics that profile
            you across other sites.
          </p>
        </Section>

        <Section title="6 · Children">
          <p style={paragraphStyle}>
            NEX is not intended for anyone under 13. If you believe
            a child has created an account, write to the contact
            address below and we will investigate and delete the
            account where appropriate.
          </p>
        </Section>

        <Section title="7 · International transfers">
          <p style={paragraphStyle}>
            NEX hosts data in the regions where our processors
            operate (currently Supabase EU-West and Vercel's global
            edge). Where personal data moves across borders, we rely
            on the standard contractual protections our processors
            provide (Standard Contractual Clauses or an equivalent).
          </p>
        </Section>

        <Section title="8 · Security">
          <p style={paragraphStyle}>
            We use HTTPS everywhere, salted password hashes
            maintained by our auth provider, Row-Level Security on
            every sensitive database table, and the Vault end-to-end
            encryption primitive for user-chosen secure
            conversations. We cannot guarantee perfect security · no
            service can · but we take proportionate measures to
            protect your data and will tell you promptly if a breach
            affects your account.
          </p>
        </Section>

        <Section title="9 · Changes to this policy">
          <p style={paragraphStyle}>
            We may update this policy as NEX evolves. Material
            changes will be announced via the account email on file
            and will not take effect for existing accounts for at
            least 14 days after the notice.
          </p>
        </Section>

        <Section title="10 · Contact">
          <p style={paragraphStyle}>
            Questions, access requests, or deletion requests · email{" "}
            <a href="mailto:asknexapp@gmail.com" style={linkStyle}>
              asknexapp@gmail.com
            </a>
            . We aim to respond within 30 days.
          </p>
        </Section>

        <footer style={footerStyle}>
          <p style={{ margin: 0, fontSize: 11, color: NEX.textMute }}>
            See also:{" "}
            <Link href="/nex-native/terms" style={linkStyle}>
              NEX Terms of Service
            </Link>
            .
          </p>
        </footer>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <section style={sectionStyle}>
      <h2 style={h2Style}>{title}</h2>
      {children}
    </section>
  );
}

const bannerStyle: React.CSSProperties = {
  padding: "12px 14px",
  marginBottom: 22,
  borderRadius: 12,
  background: "rgba(255, 114, 0, 0.08)",
  border: `1px solid ${NEX.orange}`,
  fontSize: 12.5,
  lineHeight: 1.55,
  color: NEX.textDim,
};
const sectionStyle: React.CSSProperties = {
  marginBottom: 22,
  padding: "16px 16px 10px",
  background: NEX.panel,
  border: `1px solid ${NEX.panelBorder}`,
  borderRadius: 14,
};
const h2Style: React.CSSProperties = {
  margin: "0 0 10px",
  color: NEX.cyan,
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: "0.02em",
};
const paragraphStyle: React.CSSProperties = {
  margin: "0 0 10px",
  color: NEX.text,
  fontSize: 13.5,
  lineHeight: 1.55,
};
const listStyle: React.CSSProperties = {
  margin: "0 0 10px",
  paddingLeft: 20,
  color: NEX.text,
  fontSize: 13.5,
  lineHeight: 1.55,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};
const strongStyle: React.CSSProperties = {
  color: NEX.text,
  fontWeight: 700,
};
const linkStyle: React.CSSProperties = {
  color: NEX.cyan,
  textDecoration: "underline",
};
const footerStyle: React.CSSProperties = {
  marginTop: 26,
  paddingTop: 12,
  borderTop: `1px solid ${NEX.panelBorder}`,
};
