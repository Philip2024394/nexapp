// src/app/nex-native/[businessSlug]/[productId]/_identity-share-note.tsx
//
// Phase 1 · Slice 1G · owner-authorised 2026-10-24.
// -----------------------------------------------------------------------------
// Non-blocking transparency note displayed near the Order Now /
// Chat Now entry points on the product-detail page. Tells the user
// what happens to their identity BEFORE they tap, without demanding
// an acknowledgement or blocking the surface.
//
// This is NOT the Safe Trade consent modal (that is a legal waiver
// at the first commerce-chat open · see
// src/app/nex-native/chat/peer/[accountId]/_safe-trade-consent-modal.tsx).
// This slice adds a different, lighter affordance at the moment of
// INTENT so the user can make an informed decision before the
// identity-sharing action occurs.
//
// Copy design (sealed by saved plan §7.3 · reviewed against actual
// implementation 2026-10-24):
//
//   · "Starting a conversation about this product shares your NEX
//      ID with the seller."
//      TRUE · sendProductInquiryAction / shareProductToContactAction
//      insert a nex_peer_message with sender_account_id. The
//      seller's chat shows that identity.
//
//   · "Browsing doesn't share your identity."
//      TRUE · nex.discovery_signal view/tap rows are aggregate-only
//      in the seller-insight-service (Slice 1E). The seller-interest
//      dashboard (Slice 1F) renders views/taps as "events observed"
//      with no customer-identity field.
//
//   · "Your private messages stay in your conversation."
//      TRUE · message body lives in nex_peer_message with service-
//      layer participant enforcement. Note that G1 R1 (RLS defect
//      in nex_peer_message) remains open for production release ·
//      the service-layer check is the current enforcement. The copy
//      does NOT claim a database-level RLS guarantee.
//
// What this copy explicitly does NOT say:
//   · Does not promise retention or deletion behaviour (G3 open).
//   · Does not claim marketing opt-in (default FALSE preserved · an
//     enquiry is not consent).
//   · Does not claim viewing identifies the viewer.
//   · Does not promise that every event is recorded (signals are
//     best-effort · fail-open per Slice 1D).

import * as React from "react";

const NEX = {
  textDim: "#8BA9D1",
  textMute: "#526B89",
  border: "rgba(139, 169, 209, 0.14)",
  panelSoft: "rgba(6, 15, 28, 0.72)",
};

export function IdentityShareNote(): React.JSX.Element {
  return (
    <aside
      role="note"
      aria-label="How your identity is shared"
      data-nex-identity-share-note
      style={{
        maxWidth: 720,
        margin: "0 auto 10px",
        padding: "8px 12px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        background: NEX.panelSoft,
        border: `1px solid ${NEX.border}`,
        borderRadius: 10,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <span
        aria-hidden
        data-nex-identity-share-icon
        style={{
          flexShrink: 0,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "rgba(139, 169, 209, 0.18)",
          color: NEX.textDim,
          display: "grid",
          placeItems: "center",
          fontSize: 10,
          fontWeight: 800,
          marginTop: 2,
        }}
      >
        i
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          data-nex-identity-share-primary
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            color: NEX.textDim,
            lineHeight: 1.35,
          }}
        >
          Starting a conversation about this product shares your NEX
          ID with the seller.
        </p>
        <p
          data-nex-identity-share-secondary
          style={{
            margin: "3px 0 0",
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.4,
          }}
        >
          Browsing doesn&apos;t share your identity. Your private
          messages stay in your conversation.
        </p>
      </div>
    </aside>
  );
}
