// src/app/nex-native/create/upload-video/page.tsx
//
// Owner-authorised 2026-11-05 iter 24 · world-class ship · server
// shell for the Create → Video journey. Resolves the session via
// dev-impersonation so Hendra / founder personas land here as their
// real account. Guests bounce to /sign-in.
//
// Scope v1 (minimal, functional):
//   · One-shot file picker · <= 20 seconds · <= 100 MB.
//   · Title (required) · caption (optional).
//   · Rights declaration defaults to owner_content (viewer-confirmed
//     before submit via a required checkbox).
//   · Country of origin defaults to IE (Ireland world launch target).
//   · Uploads the file to Supabase storage bucket `nex-live-uploaded`
//     then calls publishUploadedVideo · redirects to /nex-feed on
//     success.
//
// Not in v1 (follow-up authorised):
//   · Library of previous uploads (music has this · video defers).
//   · Trimmer / crop UI.
//   · Topic tags beyond a single input (comma-separated string for now).
//   · Thumbnail poster selection.
//   · AI-generation disclosure checkbox (defaults false; owner can
//     flip post-upload via admin).

import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { UploadVideoClient } from "./_upload-client";
import { SHOP_VIDEO_MAX_SECONDS } from "@/lib/nex-native/billing/enforcement";

export const metadata = {
  title: "Upload Video · NEX",
  description: "Add a short video to NEX Live.",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES_PER_UPLOAD = 100 * 1024 * 1024; // 100 MB

export default async function UploadVideoPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride().catch(() => null);
  if (!session) {
    redirect(
      `/nex-native/sign-in?next=${encodeURIComponent("/nex-native/create/upload-video")}`,
    );
  }

  return (
    <UploadVideoClient
      selfDisplayName={session.account.display_name ?? "You"}
      maxBytesPerUpload={MAX_BYTES_PER_UPLOAD}
      maxDurationSeconds={SHOP_VIDEO_MAX_SECONDS}
    />
  );
}
