// src/app/nex-native/create/upload-music/page.tsx
//
// Owner-authorised 2026-10-29 · DRAFT §14 S2.4.
// Server shell for the Create → Music journey. Resolves the session
// via dev impersonation so Hendra lands here as her real account.

import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listTracksByOwner, getOwnerStorageUsageBytes, getOwnerTrackCount } from "@/lib/nex-native/music/music-repository";
import { UploadMusicClient } from "./_upload-client";
import { MUSIC_UPLOAD_LIMITS } from "@/lib/nex-native/music/music-upload-validation";

export const metadata = {
  title: "Upload Music · NEX",
  description: "Add music to your NEX library.",
};

export default async function UploadMusicPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect(
      `/nex-native/sign-in?next=${encodeURIComponent("/nex-native/create/upload-music")}`,
    );
  }

  const [tracks, usedBytes, usedCount] = await Promise.all([
    listTracksByOwner(session.account.id),
    getOwnerStorageUsageBytes(session.account.id),
    getOwnerTrackCount(session.account.id),
  ]);

  return (
    <UploadMusicClient
      selfDisplayName={session.account.display_name ?? "You"}
      initialTracks={tracks}
      usedBytes={usedBytes}
      usedCount={usedCount}
      maxBytesPerAccount={500 * 1024 * 1024}
      maxTracksPerAccount={100}
      maxBytesPerUpload={MUSIC_UPLOAD_LIMITS.MAX_AUDIO_BYTES}
      maxCoverBytes={MUSIC_UPLOAD_LIMITS.MAX_COVER_BYTES}
      maxDurationMs={MUSIC_UPLOAD_LIMITS.MAX_DURATION_MS}
    />
  );
}
