"use server";

// src/app/nex-native/call/preview/_invite-actions.ts
//
// Owner-authorised 2026-11-08 (round 22) · server action wrapper
// for the Call Center invite flow. Re-checks the viewer's session
// server-side before invoking the sealed inviteToCall service.

import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  inviteToCall,
  InviteCallError,
  type CallMediaType,
} from "@/lib/nex-native/calls/invite-service";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function inviteContactToCallAction(
  formData: FormData,
): Promise<void> {
  const inviteeAccountId = String(formData.get("invitee_account_id") ?? "").trim();
  const existingSessionIdRaw = String(formData.get("session_id") ?? "").trim();
  const mediaTypeRaw = String(formData.get("media_type") ?? "video").trim();

  if (!UUID_SHAPE.test(inviteeAccountId)) {
    redirect("/nex-native/call/preview?invite_error=bad_invitee");
  }
  const mediaType: CallMediaType =
    mediaTypeRaw === "audio" ? "audio" : "video";
  const existingSessionId =
    UUID_SHAPE.test(existingSessionIdRaw) ? existingSessionIdRaw : null;

  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) {
    redirect("/nex-native/sign-in?return_to=/nex-native/call/preview");
  }

  try {
    const r = await inviteToCall({
      selfAccountId: session!.account.id,
      inviteeAccountId,
      mediaType,
      existingSessionId,
    });
    if (!r.ok) {
      const code = r.skipped ?? r.error ?? "unknown";
      redirect(
        `/nex-native/call/preview?invite_error=${encodeURIComponent(code)}`,
      );
    }
    redirect(
      `/nex-native/call/preview?session=${encodeURIComponent(r.sessionId!)}&invited=1`,
    );
  } catch (e) {
    if (e instanceof InviteCallError) {
      redirect(
        `/nex-native/call/preview?invite_error=${encodeURIComponent(e.code)}`,
      );
    }
    throw e;
  }
}
