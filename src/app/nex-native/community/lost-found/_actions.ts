"use server";

// src/app/nex-native/community/lost-found/_actions.ts
//
// Server actions for the Lost & Found UI.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  appendLostFoundUpdate,
  attachLostFoundPhoto,
  confirmLostFoundCard,
  createLostFoundCard,
  reportLostFoundCard,
} from "@/lib/nex-native/community/lost-found-service";
import { uploadLostFoundPhoto } from "@/lib/nex-native/community/photo-upload-service";
import {
  NEX_COMMUNITY_LOST_FOUND_SUBJECTS,
  NEX_COMMUNITY_REPORT_REASONS,
  NexCommunityMembershipRequiredError,
  NexCommunityRateLimitError,
  type NexCommunityLostFoundSubject,
  type NexCommunityLostOrFound,
  type NexCommunityReportReason,
} from "@/lib/nex-native/community/types";

async function requireAccountId(): Promise<string> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) throw new Error("unauthenticated");
  return session.account.id;
}

export async function createLostFoundAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const lostOrFoundRaw = String(formData.get("lost_or_found") ?? "");
  const subjectRaw = String(formData.get("subject_kind") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const area = String(formData.get("approximate_area_text") ?? "").trim();

  if (lostOrFoundRaw !== "lost" && lostOrFoundRaw !== "found") {
    redirect("/nex-native/community/lost-found/compose?e=bad_type");
  }
  if (!(NEX_COMMUNITY_LOST_FOUND_SUBJECTS as readonly string[]).includes(subjectRaw)) {
    redirect("/nex-native/community/lost-found/compose?e=bad_subject");
  }
  if (title.length === 0 || title.length > 120) {
    redirect("/nex-native/community/lost-found/compose?e=bad_title");
  }
  if (body.length > 2000) {
    redirect("/nex-native/community/lost-found/compose?e=bad_body");
  }
  if (area.length > 200) {
    redirect("/nex-native/community/lost-found/compose?e=bad_area");
  }
  // Optional file upload. Only accept a single File in Phase 2A.5.
  // Form must be enctype="multipart/form-data" for this to arrive as File.
  const photoEntry = formData.get("photo");
  const photoFile: File | null =
    photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : null;
  if (photoFile) {
    if (photoFile.size > 2 * 1024 * 1024) {
      redirect("/nex-native/community/lost-found/compose?e=photo_too_large");
    }
    if (!photoFile.type.startsWith("image/")) {
      redirect("/nex-native/community/lost-found/compose?e=photo_bad_mime");
    }
  }

  let cardId: string | null = null;
  try {
    const result = await createLostFoundCard({
      accountId,
      lostOrFound: lostOrFoundRaw as NexCommunityLostOrFound,
      subjectKind: subjectRaw as NexCommunityLostFoundSubject,
      title,
      body: body.length > 0 ? body : null,
      approximateAreaText: area.length > 0 ? area : null,
    });
    cardId = result.card.id;

    // Attach the photo if provided. Failure here does NOT roll back the
    // card — the author lands on the detail page without the photo and
    // can retry via a future upload affordance.
    if (photoFile) {
      try {
        const buf = Buffer.from(await photoFile.arrayBuffer());
        const processed = await uploadLostFoundPhoto({
          cardId: cardId,
          displayOrder: 0,
          file: { buffer: buf, mimeType: photoFile.type, sizeBytes: photoFile.size },
        });
        await attachLostFoundPhoto({
          accountId,
          cardId,
          storagePath: processed.storage_path,
          bytes: processed.bytes,
          widthPx: processed.width_px,
          heightPx: processed.height_px,
        });
      } catch (photoErr) {
        // Swallow the photo error · the card is created and visible.
        // The error surfaces to logs via the thrown-but-caught path.
        console.error("lost-found-compose · photo upload failed", photoErr);
      }
    }

    revalidatePath("/nex-native/community/lost-found");
    redirect(`/nex-native/community/lost-found/${cardId}`);
  } catch (err) {
    if (err instanceof NexCommunityMembershipRequiredError) {
      redirect("/nex-native/community/select?e=no_membership");
    }
    if (err instanceof NexCommunityRateLimitError) {
      redirect(`/nex-native/community/lost-found/compose?e=rate_limited`);
    }
    throw err;
  }
}

export async function appendLostFoundUpdateAction(
  formData: FormData,
): Promise<void> {
  const accountId = await requireAccountId();
  const cardId = String(formData.get("card_id") ?? "");
  const updateText = String(formData.get("update_text") ?? "").trim();
  const markResolved = String(formData.get("mark_resolved") ?? "") === "on";
  if (updateText.length === 0 || updateText.length > 1000) {
    redirect(`/nex-native/community/lost-found/${cardId}?e=bad_update`);
  }
  try {
    await appendLostFoundUpdate({
      accountId,
      cardId,
      updateText,
      markResolved,
      resolutionNote: null,
    });
    revalidatePath(`/nex-native/community/lost-found/${cardId}`);
    redirect(`/nex-native/community/lost-found/${cardId}`);
  } catch (err) {
    if (err instanceof NexCommunityRateLimitError) {
      redirect(`/nex-native/community/lost-found/${cardId}?e=rate_limited`);
    }
    throw err;
  }
}

export async function confirmLostFoundAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const cardId = String(formData.get("card_id") ?? "");
  try {
    await confirmLostFoundCard({ accountId, cardId });
    revalidatePath(`/nex-native/community/lost-found/${cardId}`);
    redirect(`/nex-native/community/lost-found/${cardId}?m=confirmed`);
  } catch (err) {
    if (err instanceof NexCommunityRateLimitError) {
      redirect(`/nex-native/community/lost-found/${cardId}?e=rate_limited`);
    }
    const msg = err instanceof Error ? err.message : "unknown";
    if (/author cannot confirm/i.test(msg)) {
      redirect(`/nex-native/community/lost-found/${cardId}?e=own_card`);
    }
    throw err;
  }
}

export async function reportLostFoundAction(formData: FormData): Promise<void> {
  const accountId = await requireAccountId();
  const cardId = String(formData.get("card_id") ?? "");
  const reasonRaw = String(formData.get("reason") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!(NEX_COMMUNITY_REPORT_REASONS as readonly string[]).includes(reasonRaw)) {
    redirect(`/nex-native/community/lost-found/${cardId}?e=bad_reason`);
  }
  if (note.length > 500) {
    redirect(`/nex-native/community/lost-found/${cardId}?e=bad_note`);
  }
  try {
    await reportLostFoundCard({
      reporterAccountId: accountId,
      cardId,
      reason: reasonRaw as NexCommunityReportReason,
      note: note.length > 0 ? note : null,
    });
    revalidatePath(`/nex-native/community/lost-found/${cardId}`);
    redirect(`/nex-native/community/lost-found/${cardId}?m=reported`);
  } catch (err) {
    if (err instanceof NexCommunityRateLimitError) {
      redirect(`/nex-native/community/lost-found/${cardId}?e=rate_limited`);
    }
    throw err;
  }
}
