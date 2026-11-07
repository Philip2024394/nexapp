// src/app/nex-native/chat/peer/[accountId]/__tests__/stage-a-document-contract.test.ts
//
// Stage A · owner-authorised 2026-11-03 · regression contract for the
// document attachment lifecycle wired this stage. Lint-level checks on
// source files so the pipeline wiring is enforced the same way the
// sealed `media-capture-recorder-contract.test.ts` does for Camera /
// Video / Voice. Not an end-to-end integration test · the harness
// `stage-a-document-integration.test.ts` (same folder) proves the
// service-layer round-trip against the shared pg mock.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

describe("Stage A · document attachment contract", () => {
  // ─── Media capture surface ──────────────────────────────────
  describe("_media-capture.tsx", () => {
    const SRC = read("app/nex-native/chat/peer/[accountId]/_media-capture.tsx");

    it("CaptureKind includes 'document'", () => {
      expect(SRC).toMatch(
        /export type CaptureKind\s*=\s*"camera"\s*\|\s*"video"\s*\|\s*"voice"\s*\|\s*"document"/,
      );
    });

    it("has a dedicated document form + input", () => {
      expect(SRC).toMatch(/documentFormRef/);
      expect(SRC).toMatch(/documentInputRef/);
      expect(SRC).toMatch(/accept="\*\/\*"/);
      // Phase 1 (2026-11-07) · onFileChosen signature is now
      // `onFileChosen(kind)` · the per-form ref is resolved inside
      // the plaintext submit helper, not threaded through the handler.
      expect(SRC).toMatch(/onChange=\{onFileChosen\("document"\)\}/);
    });

    it("documents are routed via attemptEncryptedAttachment (Phase 1 fail-closed)", () => {
      // Phase 1 replaces the old Bridge 88 'skip encrypted path for
      // documents' branch. Documents now enter the encryption attempt,
      // which returns `blocked` with reason 'unsupported-mime' so the
      // explicit-choice prompt renders · no silent plaintext submit.
      expect(SRC).toMatch(/attemptEncryptedAttachment/);
      expect(SRC).not.toMatch(/encryptedUploadEnabled\s*&&\s*kind\s*!==\s*"document"/);
    });

    it("has client-side size + MIME pre-check before upload", () => {
      expect(SRC).toMatch(/MAX_BYTES\s*=\s*25\s*\*\s*1024\s*\*\s*1024/);
      expect(SRC).toMatch(/validationError/);
      expect(SRC).toMatch(/25 MB cap/);
    });

    it("surfaces validation failures via a transient toast", () => {
      expect(SRC).toMatch(/ValidationErrorToast/);
      expect(SRC).toMatch(/role="status"/);
    });

    it("open('document') dispatches to the document input", () => {
      // The switch inside the imperative handle must route kind
      // "document" to documentInputRef (not the fallback voice).
      expect(SRC).toMatch(/kind === "voice"\s*\?\s*voiceInputRef\s*:\s*documentInputRef/);
    });
  });

  // ─── Composer surface ───────────────────────────────────────
  describe("_composer.tsx", () => {
    const SRC = read("app/nex-native/chat/peer/[accountId]/_composer.tsx");

    it("MediaModal exposes a visible Document tile", () => {
      expect(SRC).toMatch(/label="Document"/);
      expect(SRC).toMatch(/onPickCapture\?\.\("document"\)/);
    });

    it("pendingAttachment accepts kind 'document' + filename/sizeBytes/mime", () => {
      expect(SRC).toMatch(
        /kind:\s*"image"\s*\|\s*"video"\s*\|\s*"audio"\s*\|\s*"document"/,
      );
      expect(SRC).toMatch(/filename\?:\s*string/);
      expect(SRC).toMatch(/sizeBytes\?:\s*number/);
      expect(SRC).toMatch(/mime\?:\s*string/);
    });

    it("hidden form inputs smuggle filename/size/mime to the server", () => {
      expect(SRC).toMatch(/name="attachment_filename"/);
      expect(SRC).toMatch(/name="attachment_size"/);
      expect(SRC).toMatch(/name="attachment_mime"/);
    });

    it("recorder path explicitly bypasses document kinds", () => {
      expect(SRC).toMatch(/kind !== "document" && preferRecorder\(\)/);
    });

    it("pending-attachment caption reads 'Document ready' for documents", () => {
      expect(SRC).toMatch(/"Document ready"/);
    });
  });

  // ─── Server action surface ──────────────────────────────────
  describe("_actions.ts", () => {
    const SRC = read("app/nex-native/_actions.ts");

    it("sendPeerMessageAction accepts attachment_type='document'", () => {
      // Camel-cased variable declaration in the server action.
      expect(SRC).toMatch(
        /attachmentType:\s*"image"\s*\|\s*"video"\s*\|\s*"audio"\s*\|\s*"document"/,
      );
      // Guard against the raw form value being coerced.
      expect(SRC).toMatch(/attachmentTypeRaw === "document"/);
    });

    it("sendPeerMessageAction reads filename/size/mime form fields", () => {
      expect(SRC).toMatch(/formData\.get\("attachment_filename"\)/);
      expect(SRC).toMatch(/formData\.get\("attachment_size"\)/);
      expect(SRC).toMatch(/formData\.get\("attachment_mime"\)/);
    });

    it("sendPeerMessageAction projects document meta into attachment_meta on insert", () => {
      // The sendPeerMessage call must forward attachment_meta
      // (not just attachment_url + attachment_type).
      expect(SRC).toMatch(
        /sendPeerMessage\(\{[\s\S]*attachment_meta:\s*attachmentMeta[\s\S]*\}/,
      );
    });

    it("uploadPeerAttachmentAction forwards document meta on redirect", () => {
      expect(SRC).toMatch(/qs\.set\("attachment_filename"/);
      expect(SRC).toMatch(/qs\.set\("attachment_size"/);
      expect(SRC).toMatch(/qs\.set\("attachment_mime"/);
    });

    it("sendPeerMessageAction clamps filename at 256 chars + size at 25 MB", () => {
      expect(SRC).toMatch(/\.slice\(0,\s*256\)/);
      expect(SRC).toMatch(/25\s*\*\s*1024\s*\*\s*1024\s*\+\s*1024/);
    });
  });

  // ─── Service surface ────────────────────────────────────────
  describe("peer-message-service.ts", () => {
    const SRC = read("lib/nex-native/peer-message-service.ts");

    it("NexPeerAttachmentKind includes 'document'", () => {
      // Reading backwards from the union terminator so we don't
      // couple to the comment lines between the kinds.
      expect(SRC).toMatch(/\|\s*"sticker"[\s\S]*\|\s*"document"\s*;/);
    });

    it("NexPeerAttachmentMeta.filename is defined", () => {
      expect(SRC).toMatch(/filename\?:\s*string/);
    });

    it("classifyPeerAttachmentMime returns 'document' for non-media MIMEs", () => {
      expect(SRC).toMatch(/return "document"/);
    });

    it("classifyPeerAttachmentMime rejects empty MIME", () => {
      expect(SRC).toMatch(/if \(m\.length === 0\) return null/);
    });

    it("uploadPeerAttachment uploads documents as application/octet-stream", () => {
      expect(SRC).toMatch(
        /kind === "document"\s*\?\s*"application\/octet-stream"/,
      );
    });

    it("uploadPeerAttachment preserves filename on document uploads", () => {
      expect(SRC).toMatch(/meta\.filename\s*=\s*file\.name\.slice\(0,\s*256\)/);
    });
  });

  // ─── Recipient renderer surface ─────────────────────────────
  describe("_portrait-bloom-shell.tsx", () => {
    const SRC = read("app/nex-native/chat/_portrait-bloom-shell.tsx");

    it("MessageAttachment accepts kind 'document'", () => {
      expect(SRC).toMatch(
        /kind:\s*"image"\s*\|\s*"video"\s*\|\s*"audio"\s*\|\s*"document"/,
      );
    });

    it("renders a document chip with filename + download link", () => {
      expect(SRC).toMatch(/data-nex-peer-document-chip/);
      expect(SRC).toMatch(/download=\{filename\}/);
    });

    it("picks a MIME-aware icon for the chip", () => {
      expect(SRC).toMatch(/documentIconForMime/);
      // Minimum MIME families · PDF + archives + text.
      expect(SRC).toMatch(/"pdf"/);
      expect(SRC).toMatch(/"zip"/);
      expect(SRC).toMatch(/text\//);
    });

    it("formats sizes as KB / MB / bytes", () => {
      expect(SRC).toMatch(/formatDocumentSize/);
      expect(SRC).toMatch(/\bKB\b/);
      expect(SRC).toMatch(/\bMB\b/);
      expect(SRC).toMatch(/\bbytes\b/);
    });

    it("the attachment branch recognises 'document' alongside the sealed trio", () => {
      // The bubble renderer must include 'document' in the kind
      // guard that selects MessageAttachment.
      expect(SRC).toMatch(/m\.attachment_type === "document"/);
    });

    it("forwards attachment_meta to MessageAttachment for documents", () => {
      expect(SRC).toMatch(/filename:\s*m\.attachment_meta\?\.filename/);
      expect(SRC).toMatch(/size_bytes:\s*m\.attachment_meta\?\.size_bytes/);
      expect(SRC).toMatch(/mime:\s*m\.attachment_meta\?\.mime/);
    });

    it("image taps open the NEX lightbox (not a new tab)", () => {
      expect(SRC).toMatch(/onOpenImage=\{\s*m\.attachment_type === "image"/);
      expect(SRC).toMatch(/setLightboxUrl/);
      expect(SRC).toMatch(/<ImageLightbox/);
    });

    it("PortraitBloomMessage.attachment_meta is defined", () => {
      expect(SRC).toMatch(/attachment_meta\?:\s*\{[\s\S]*filename\?:\s*string/);
    });
  });

  // ─── Full-screen image lightbox ─────────────────────────────
  describe("_image-lightbox.tsx", () => {
    const SRC = read("app/nex-native/chat/_image-lightbox.tsx");

    it("mounts via React portal on document.body", () => {
      expect(SRC).toMatch(/createPortal\(node, document\.body\)/);
    });

    it("binds Escape to close + locks body overflow while open", () => {
      expect(SRC).toMatch(/document\.body\.style\.overflow = "hidden"/);
      expect(SRC).toMatch(/e\.key === "Escape"/);
    });

    it("uses the unified NEX Orange close button", () => {
      expect(SRC).toMatch(/background: ORANGE/);
      expect(SRC).toMatch(/#FF7200/);
    });

    it("exposes a download affordance so recipients can save the image", () => {
      expect(SRC).toMatch(/download\b/);
      expect(SRC).toMatch(/aria-label="Download photo"/);
    });

    it("renders the image with object-fit: contain so portrait + landscape fit", () => {
      expect(SRC).toMatch(/objectFit:\s*"contain"/);
    });
  });

  // ─── Peer chat page URL-param reader ───────────────────────
  describe("peer page.tsx", () => {
    const SRC = read("app/nex-native/chat/peer/[accountId]/page.tsx");

    it("accepts attachment_type='document' from URL state", () => {
      expect(SRC).toMatch(/attachTypeRaw === "document"/);
    });

    it("reads attachment_filename / attachment_size / attachment_mime", () => {
      expect(SRC).toMatch(/sp\.attachment_filename/);
      expect(SRC).toMatch(/sp\.attachment_size/);
      expect(SRC).toMatch(/sp\.attachment_mime/);
    });

    it("clamps size to the 25 MB bucket cap + envelope slack", () => {
      expect(SRC).toMatch(/25\s*\*\s*1024\s*\*\s*1024\s*\+\s*1024/);
    });

    it("projects document meta into the pendingAttachment payload", () => {
      expect(SRC).toMatch(/filename:\s*attachFilename/);
      expect(SRC).toMatch(/sizeBytes:\s*attachSizeBytes/);
      expect(SRC).toMatch(/mime:\s*attachMime/);
    });
  });

  // ─── Migration 259 draft ────────────────────────────────────
  describe("migration 259", () => {
    const SRC = readFileSync(
      join(
        process.cwd(),
        "nex-supabase/migrations/259_nex_peer_message_document_attachment.sql",
      ),
      "utf8",
    );

    it("adds 'document' to the attachment_type CHECK", () => {
      expect(SRC).toMatch(
        /attachment_type IN[\s\S]*'image'[\s\S]*'document'/,
      );
    });

    it("is reversible · includes a rollback script with a safety note", () => {
      expect(SRC).toMatch(/Rollback/i);
      expect(SRC).toMatch(/Safety condition/);
    });

    it("records a migration-history row", () => {
      expect(SRC).toMatch(/INSERT INTO nex_migration_history/);
      expect(SRC).toMatch(/VALUES \(\s*'259'/);
    });

    it("Bridge 88 posture explicitly preserved in the migration doctrine", () => {
      expect(SRC).toMatch(/Bridge 88[\s\S]*unchanged|Bridge 88[\s\S]*posture/i);
    });

    it("is marked DRAFT · not applied without authorisation", () => {
      expect(SRC).toMatch(/DRAFT.*NOT YET APPLIED/i);
    });
  });
});
