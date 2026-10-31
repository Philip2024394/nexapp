"use client";

// src/components/nex-native/creator/CreatorSupportSheet.tsx
//
// Owner-authorised 2026-10-31 · NEX Creator Programme · Stage 1.
// Universal Support pop-up. Opens when a viewer taps a Creator badge
// on a profile. Shows the creator's avatar, name, earned badges,
// suggested amounts, QR / PayPal / external links, thank-you message
// and the required payment disclaimer.
//
// Hard rules (sealed):
//   · NEX NEVER processes payments. This sheet only displays pointers
//     the creator provided. The fan completes payment outside NEX.
//   · A static QR scan NEVER produces a payment-success toast.
//   · If no payment method is configured, show a friendly empty state
//     instead of a broken panel.

import * as React from "react";
import type { CreatorSupportSettings } from "@/lib/nex-native/creator/creator-support-service";
import type { SectionProgress } from "@/lib/nex-native/creator/creator-badges-common";
import { sectionBadgeLabel } from "@/lib/nex-native/creator/creator-badges-common";
import { NexYellowChip } from "@/components/nex-native/badge/NexYellowChip";

const INK = "#102033";
const INK_DIM = "#4A6080";
const ACCENT = "#00AFFF";
const RIM = "rgba(0, 175, 255, 0.18)";

export interface CreatorSupportSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly creatorName: string;
  readonly creatorAvatarUrl: string | null;
  readonly creatorNexHandle: string | null;
  readonly earnedBadges: readonly SectionProgress[];
  /** Null = creator has not enabled Support yet · we show the friendly
   *  empty state (not a broken payment panel). */
  readonly settings: CreatorSupportSettings | null;
}

export function CreatorSupportSheet(
  props: CreatorSupportSheetProps,
): React.JSX.Element | null {
  if (!props.open) return null;
  const s = props.settings;
  const hasAnyPayment =
    s !== null &&
    s.enabled === true &&
    (s.qrisImageUrl !== null || s.paypalLink !== null || s.externalLinks.length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nex-creator-support-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(10, 21, 38, 0.8)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 12,
      }}
      onClick={props.onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#FFFFFF",
          borderRadius: "20px 20px 0 0",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          fontFamily: "Inter, system-ui, sans-serif",
          color: INK,
          maxHeight: "85dvh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {props.creatorAvatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={props.creatorAvatarUrl}
              alt=""
              style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(0, 175, 255, 0.12)",
                color: ACCENT,
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                fontSize: 18,
              }}
            >
              {props.creatorName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id="nex-creator-support-title"
              style={{ fontSize: 16, fontWeight: 800, margin: 0, color: INK }}
            >
              Support {props.creatorName}
            </h2>
            {props.creatorNexHandle ? (
              <div
                style={{
                  fontSize: 11,
                  color: INK_DIM,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                {props.creatorNexHandle}
              </div>
            ) : null}
            {props.earnedBadges.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  marginTop: 6,
                }}
              >
                {props.earnedBadges.map((b) => (
                  <NexYellowChip
                    key={b.section}
                    label={sectionBadgeLabel(b.section)}
                    position="inline"
                  />
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close"
            style={{
              padding: 6,
              borderRadius: 999,
              border: "none",
              background: "transparent",
              color: INK_DIM,
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {!hasAnyPayment ? (
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: "rgba(0, 175, 255, 0.06)",
              border: `1.5px solid ${RIM}`,
              fontSize: 13,
              color: INK,
              lineHeight: 1.55,
            }}
          >
            This creator hasn&rsquo;t set up Support yet. You can still enjoy
            their content, follow them, and share it with others.
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: INK, lineHeight: 1.55, margin: 0 }}>
              Your support helps this creator keep contributing to NEX and
              invest in their work.
            </p>

            {s!.suggestedAmounts.length > 0 ? (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                  Suggested amounts
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {s!.suggestedAmounts.map((amt) => (
                    <span
                      key={amt}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: `1.5px solid ${RIM}`,
                        background: "#fff",
                        color: INK,
                        fontWeight: 800,
                        fontSize: 13,
                      }}
                    >
                      {formatAmount(amt, s!.currency)}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: INK_DIM, marginTop: 6 }}>
                  These are suggestions. You decide the actual amount in your
                  payment app.
                </div>
              </div>
            ) : null}

            {s!.qrisImageUrl ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: INK_DIM, textTransform: "uppercase", letterSpacing: "0.04em", alignSelf: "flex-start" }}>
                  Scan QR
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s!.qrisImageUrl}
                  alt={`QR code for ${props.creatorName}`}
                  style={{
                    width: 240,
                    height: 240,
                    objectFit: "contain",
                    background: "#fff",
                    borderRadius: 12,
                    border: `1.5px solid ${RIM}`,
                    padding: 8,
                  }}
                />
              </div>
            ) : null}

            {s!.paypalLink ? (
              <a
                href={s!.paypalLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "#00457C",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 800,
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                Open PayPal
              </a>
            ) : null}

            {s!.externalLinks.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {s!.externalLinks.map((link, i) => (
                  <a
                    key={`${link.label}-${i}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: `1.5px solid ${RIM}`,
                      background: "#fff",
                      color: INK,
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: 13,
                      textAlign: "center",
                    }}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}

            {s!.thankYouMessage ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(31, 143, 79, 0.06)",
                  border: "1.5px solid rgba(31, 143, 79, 0.25)",
                  fontSize: 13,
                  color: INK,
                  lineHeight: 1.5,
                  fontStyle: "italic",
                }}
              >
                {s!.thankYouMessage}
              </div>
            ) : null}

            <p style={{ fontSize: 11, color: INK_DIM, lineHeight: 1.5, margin: 0 }}>
              Payments are made directly to the creator. NEX does not process
              or guarantee payments.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function formatAmount(minor: number, currency: string): string {
  // Simple major-unit formatting · Rp for IDR, else ISO + major.
  const major = (minor / 100).toFixed(0);
  const majorIntl = Math.round(minor / 100).toLocaleString();
  if (currency === "IDR") {
    // IDR has no decimal places in common use. Values are stored in
    // minor-units convention; display as whole rupiah.
    return `Rp ${Math.round(minor).toLocaleString()}`;
  }
  void major;
  return `${currency} ${majorIntl}`;
}
