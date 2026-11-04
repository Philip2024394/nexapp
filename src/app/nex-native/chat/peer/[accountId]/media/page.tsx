// src/app/nex-native/chat/peer/[accountId]/media/page.tsx
//
// Owner-authorised 2026-11-05 later-same-day iter 8 · Shared Media
// per-chat view. Read-only grid of every image / video / audio /
// document ever sent in this peer conversation. Backlinks to the
// chat.
//
// E2E note (Bridge 76): attachment_url is a plaintext storage URL
// on all attachment types (image/video/audio/document). The E2E
// pipeline encrypts the BODY, not the attached bytes — thumbnails
// and media are addressable by anyone with the URL. This view
// therefore does not leak anything that isn't already visible to
// a member of the conversation.

import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import * as peerConversationService from "@/lib/nex-native/peer-conversation-service";
import * as peerMessageService from "@/lib/nex-native/peer-message-service";
import * as accountService from "@/lib/nex-native/account-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  panel: "rgba(2,9,20,0.6)",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  gold: "var(--nex-world-secondary, #C6A15B)",
  hairline: "rgba(255,255,255,0.14)",
};

interface PageProps {
  readonly params: Promise<{ accountId: string }>;
}

export default async function SharedMediaPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { accountId: peerId } = await params;
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) redirect("/nex-native/sign-in");

  const peer = await accountService.getAccountById(peerId);
  if (!peer) notFound();

  const conversation = await peerConversationService.findPeerConversation(
    session.account.id,
    peer.id,
  );
  if (!conversation) notFound();

  const messages = await peerMessageService.listPeerMessages(conversation.id);
  // Only surface shareable media kinds · product/menu/cart snapshots
  // are commerce artifacts, not "media" in the user sense.
  const mediaKinds = new Set(["image", "video", "audio", "document"]);
  const media = messages.filter(
    (m) =>
      !m.deleted_for_everyone &&
      m.attachment_url &&
      m.attachment_type &&
      mediaKinds.has(m.attachment_type),
  );

  const images = media.filter((m) => m.attachment_type === "image");
  const videos = media.filter((m) => m.attachment_type === "video");
  const audios = media.filter((m) => m.attachment_type === "audio");
  const docs = media.filter((m) => m.attachment_type === "document");

  const chatHref = `/nex-native/chat/peer/${peer.id}`;

  return (
    <main
      data-nex-shared-media-page
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding:
            "calc(env(safe-area-inset-top, 0px) + 16px) 16px 14px 16px",
          background: NEX.bg,
          borderBottom: `1px solid ${NEX.hairline}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href={chatHref}
          aria-label="Back to chat"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#000000",
            border: `1px solid ${NEX.hairline}`,
            color: "#FFFFFF",
            textDecoration: "none",
            fontSize: 18,
            lineHeight: 1,
            boxShadow:
              "0 6px 18px rgba(0,0,0,0.55), inset 0 0 0 1px color-mix(in srgb, var(--nex-world-secondary, #C6A15B) 24%, transparent)",
          }}
        >
          ←
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Shared media
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: NEX.textDim,
              lineHeight: 1.2,
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {peer.display_name} · {media.length} item
            {media.length === 1 ? "" : "s"}
          </div>
        </div>
      </header>

      {media.length === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            color: NEX.textDim,
            fontSize: 14,
          }}
        >
          Photos, videos, voice notes and documents shared in this chat
          will show up here.
        </div>
      ) : (
        <div style={{ padding: "16px 12px 24px" }}>
          {images.length > 0 || videos.length > 0 ? (
            <Section title="Photos & videos">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 4,
                }}
              >
                {[...images, ...videos].map((m) => (
                  <a
                    key={m.id}
                    href={m.attachment_url!}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      position: "relative",
                      aspectRatio: "1 / 1",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#111",
                      display: "block",
                    }}
                    data-nex-shared-media-tile
                    data-nex-shared-media-tile-kind={m.attachment_type!}
                  >
                    {m.attachment_type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.attachment_url!}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <video
                          src={m.attachment_url!}
                          preload="metadata"
                          muted
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                        <span
                          aria-hidden
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%,-50%)",
                            color: "#FFFFFF",
                            fontSize: 24,
                            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
                          }}
                        >
                          ▶
                        </span>
                      </>
                    )}
                  </a>
                ))}
              </div>
            </Section>
          ) : null}

          {audios.length > 0 ? (
            <Section title="Voice notes">
              <ListRows>
                {audios.map((m) => (
                  <RowLink
                    key={m.id}
                    href={m.attachment_url!}
                    title="Voice note"
                    subtitle={formatSentAt(m.sent_at)}
                    glyph="🎙"
                  />
                ))}
              </ListRows>
            </Section>
          ) : null}

          {docs.length > 0 ? (
            <Section title="Documents">
              <ListRows>
                {docs.map((m) => (
                  <RowLink
                    key={m.id}
                    href={m.attachment_url!}
                    title={
                      (m.attachment_meta as { filename?: string } | null)
                        ?.filename ?? "Document"
                    }
                    subtitle={formatSentAt(m.sent_at)}
                    glyph="📄"
                  />
                ))}
              </ListRows>
            </Section>
          ) : null}
        </div>
      )}
    </main>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section style={{ marginBottom: 20 }}>
      <h2
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--nex-world-muted-ink, #B5C3D6)",
          padding: "0 6px 10px",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function ListRows({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {children}
    </div>
  );
}

function RowLink({
  href,
  title,
  subtitle,
  glyph,
}: {
  readonly href: string;
  readonly title: string;
  readonly subtitle: string;
  readonly glyph: string;
}): React.JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 12px",
        borderRadius: 10,
        background: "rgba(2,9,20,0.6)",
        border: "1px solid rgba(255,255,255,0.14)",
        textDecoration: "none",
        color: "#F2F5F8",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "#000000",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        {glyph}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 11, color: "#B5C3D6", marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
    </a>
  );
}

function formatSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
