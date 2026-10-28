"use client";

// src/app/nex-native/contacts/_group-terms-modal.tsx
//
// Owner directive 2026-10-23 · NEX Groups Terms & Conditions ·
// mock-complete surface. The CreateGroupForm renders a short
// "By creating a group you accept our terms · Read full policy →"
// line in its footer · tap opens this modal with the full text.
//
// DRAFT · owner is a non-lawyer and must have this reviewed by
// legal counsel before any production surface renders these terms
// to real users. The language borrows the sealed-pattern wording
// Apple uses in iCloud T&Cs ("sole discretion", "or otherwise
// objectionable", "at your own risk") because it has been battle-
// tested in app-store contexts.
//
// Security / legal posture the owner asked us to protect at all
// times:
//   · NEX never monitors group content proactively · only acts on
//     flagged reports · consistent with the sealed Community
//     Notice doctrine (2026-10-23) and the sealed Private Groups
//     contract rev 3 §5 (no decryption, no server-side read).
//   · Group content is user-generated · NEX is not the author,
//     endorser, or verifier of any claim made in a group.
//   · NEX is not liable for disputes between members · for member
//     claims, promises, offers, transactions, injuries, or losses.
//   · NEX reserves broad unilateral right to remove / deactivate
//     groups + suspend accounts · at sole discretion, no notice
//     required.
//   · Group owners / admins are NOT agents or representatives of
//     NEX · their statements do not bind NEX.
//
// Research anchors (short quotes · bodies of law vary · see each
// source for the full clause):
//   · Apple iCloud T&Cs: "you are solely responsible for any Content
//     you upload... use of the Service and any Content is solely at
//     your own risk"
//   · Apple iCloud T&Cs: "Apple reserves the right at all times to
//     determine whether Content is appropriate ... may ... remove
//     Content ... in its sole discretion"
//   · Apple iCloud T&Cs §V: "unlawful, harassing, threatening, ...
//     or otherwise objectionable"

import * as React from "react";

const NEX = {
  bgNavy: "#050F1E",
  bgPanel: "rgba(2,9,20,0.96)",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  cyan: "#00AFFF",
};

interface GroupTermsModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function GroupTermsModal({
  open,
  onClose,
}: GroupTermsModalProps): React.ReactElement | null {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Prevent body scroll while modal is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-group-terms-title"
      data-nex-group-terms-modal
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          maxHeight: "90dvh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          background: NEX.bgPanel,
          border: `1.5px solid ${NEX.cyan}`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 24px ${NEX.cyan}22`,
          overflow: "hidden",
        }}
      >
        {/* Header · flex-shrink:0 so only the body scrolls. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: `1px solid ${NEX.cyan}33`,
            flexShrink: 0,
          }}
        >
          <h2
            id="nex-group-terms-title"
            style={{
              margin: 0,
              flex: 1,
              fontSize: 15,
              fontWeight: 800,
              color: NEX.text,
              letterSpacing: 0.2,
              lineHeight: 1.2,
            }}
          >
            NEX Group Terms &amp; Conditions
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close terms"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              background: "transparent",
              border: `1px solid ${NEX.cyan}55`,
              borderRadius: 999,
              color: NEX.text,
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "14px 16px 16px",
            color: NEX.text,
            fontSize: 12,
            lineHeight: 1.55,
            letterSpacing: 0.15,
          }}
        >
          <TermsBody />
        </div>

        {/* Footer with a close affordance. */}
        <div
          style={{
            flexShrink: 0,
            padding: "10px 16px 14px",
            borderTop: `1px solid ${NEX.cyan}33`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            data-nex-group-terms-close
            style={{
              width: "100%",
              height: 40,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${NEX.cyan}, ${NEX.cyan}cc)`,
              border: `1px solid ${NEX.cyan}`,
              color: "#07140A",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: `0 2px 10px ${NEX.cyan}55`,
            }}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Terms body · DRAFT · requires legal review ─────────────── */

function TermsBody(): React.ReactElement {
  return (
    <>
      <TermsNote>
        Draft · last updated 2026-10-23. Review by legal counsel is
        required before this document is treated as a binding
        agreement. By creating a group you accept the policy set out
        below.
      </TermsNote>

      <Section n={1} title="No proactive monitoring">
        NEX does not pre-screen, read, or monitor the content of any
        group conversation. NEX reviews group content only when a
        message is reported through the in-app flag action by a group
        member. Any review of flagged content is carried out by the
        NEX moderation process and remains at NEX&rsquo;s sole
        discretion.
      </Section>

      <Section n={2} title="User-generated content">
        All group content &mdash; including messages, images, files,
        voice notes, invitations, member profiles, and any claims,
        offers, or representations made inside a group &mdash; is
        created and published solely by group members. NEX is not the
        author of this content and does not endorse, verify, warrant,
        or guarantee the accuracy, legality, or safety of any
        statement, product, service, promise, or representation made
        by any member in any group.
      </Section>

      <Section n={3} title="Member conduct">
        You are solely responsible for your own conduct inside groups
        and for all content you post. You agree that you will not use
        NEX Groups to post, share, or transmit any content that is
        unlawful, harassing, threatening, harmful, tortious,
        defamatory, libelous, abusive, violent, obscene, vulgar,
        invasive of another&rsquo;s privacy, hateful, racially or
        ethnically offensive, infringes any intellectual property or
        other right, or is otherwise objectionable in NEX&rsquo;s
        sole discretion. You will not use NEX Groups for unsolicited
        commercial messages, fraud, impersonation, pyramid schemes,
        malware distribution, or activity that violates applicable
        law.
      </Section>

      <Section n={4} title="No liability for member actions">
        NEX provides the Groups feature as a communication platform
        only. NEX is not a party to any arrangement, agreement,
        transaction, promise, or dispute between group members. NEX
        is not liable for any act, omission, claim, representation,
        offer, financial transaction, injury, loss, cost, or damage
        arising between members of any group, whether that group is
        private or open. All disputes between group members are the
        sole responsibility of the members involved and must be
        resolved by them.
      </Section>

      <Section n={5} title="Right to remove or deactivate">
        NEX reserves the right, at all times and at NEX&rsquo;s sole
        discretion, to:
        <ul style={{ paddingLeft: 18, margin: "6px 0" }}>
          <li>Remove any content from any group;</li>
          <li>Remove any member from any group;</li>
          <li>Deactivate or permanently delete any group;</li>
          <li>Suspend or permanently terminate any account that
            violates these terms, the NEX community standards, or any
            applicable law;</li>
          <li>Take any of the above actions with or without prior
            notice to the member or group owner.</li>
        </ul>
        Repeated or severe violations may result in permanent
        termination without further warning.
      </Section>

      <Section n={6} title="Group owners and admins">
        The person who creates a group is responsible for the
        group&rsquo;s purpose, for the members they invite, and for
        enforcing the group&rsquo;s own posting rules consistent with
        these terms. Group owners and admins are not agents,
        employees, partners, or representatives of NEX. Statements,
        promises, and actions by a group owner or admin do not bind
        NEX in any way.
      </Section>

      <Section n={7} title="Open groups discoverability">
        If you create an &ldquo;open&rdquo; group, the group&rsquo;s
        name, description, country, and member count may be made
        visible to other NEX account holders searching groups in the
        same country. Member identities visible inside the group are
        shown only to members. Private groups remain invisible to
        non-members at all times. You may convert visibility only
        where the UI allows it, and NEX may add further restrictions
        on visibility changes at any time.
      </Section>

      <Section n={8} title="Reporting and flagged content">
        Any group member may flag a message they believe violates
        these terms. Flagged messages are temporarily hidden from the
        group pending review. The identity of the flagger is kept
        confidential. False or malicious flagging is itself a
        violation of these terms and may result in action against
        the flagger&rsquo;s account.
      </Section>

      <Section n={9} title="Minimum age and minors">
        NEX Groups are available only to users aged 13 or older, or
        the minimum age for digital-services consent in the
        user&rsquo;s jurisdiction, whichever is higher. Parents and
        guardians are responsible for the use of NEX by any minor in
        their care, including which groups the minor joins or
        creates.
      </Section>

      <Section n={10} title="Encryption and server access">
        NEX group messaging is designed so that NEX servers do not
        have the ability to read group content in transit. NEX may
        store ciphertext and metadata necessary to deliver messages
        and to respond to flagged-content reports. Information shared
        inside a group may still be viewed, copied, saved, forwarded,
        or disclosed by any member of that group outside the NEX
        platform, and NEX has no control over such disclosure once it
        leaves the group.
      </Section>

      <Section n={11} title="Service provided as-is">
        Groups are provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo;. NEX does not warrant that the Groups
        feature will be uninterrupted, timely, secure, error-free, or
        free from unauthorised access. Your use of the Groups feature
        is solely at your own risk, to the fullest extent permitted
        by applicable law.
      </Section>

      <Section n={12} title="Limitation of liability">
        To the fullest extent permitted by applicable law, NEX, its
        parent, affiliates, officers, employees, agents, and
        licensors shall not be liable to any user for any indirect,
        incidental, consequential, special, exemplary, or punitive
        damages arising out of or in connection with the Groups
        feature, including loss of profits, loss of data, personal
        injury, property damage, or any damages arising from acts or
        omissions of other members. Nothing in these terms excludes
        any liability that cannot be excluded under applicable law.
      </Section>

      <Section n={13} title="Changes to these terms">
        NEX may update these Group Terms &amp; Conditions at any
        time. Continued use of the Groups feature after an update
        constitutes acceptance of the updated terms.
      </Section>

      <TermsFinalNote>
        Nothing in these terms is intended to override any mandatory
        protection you have under applicable consumer-protection,
        data-protection, or human-rights law. Where a provision in
        these terms is unenforceable in your jurisdiction, that
        provision applies to the maximum extent permitted and the
        rest of the terms remain in force.
      </TermsFinalNote>
    </>
  );
}

function Section({
  n,
  title,
  children,
}: {
  readonly n: number;
  readonly title: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <section style={{ marginTop: 10 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 800,
          color: NEX.cyan,
          letterSpacing: 0.3,
          lineHeight: 1.2,
          textTransform: "uppercase",
        }}
      >
        {n}. {title}
      </h3>
      <div
        style={{
          marginTop: 4,
          color: NEX.text,
        }}
      >
        {children}
      </div>
    </section>
  );
}

function TermsNote({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(255,215,0,0.06)",
        border: `1px dashed rgba(255,215,0,0.4)`,
        color: NEX.textMute,
        fontSize: 11,
        fontStyle: "italic",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

function TermsFinalNote({ children }: { readonly children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        marginTop: 14,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(0,175,255,0.06)",
        border: `1px solid ${NEX.cyan}33`,
        color: NEX.textMute,
        fontSize: 11,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
