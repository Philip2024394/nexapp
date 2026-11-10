// src/app/nex-native/manage/accommodation/_actions.ts
//
// Server-action stub for the accommodation room editor · owner-sealed
// 2026-11-10 build cycle. The real `updateRoomAction` was never
// migrated when the room editor was refactored; the page.tsx at
// `[roomId]/page.tsx` still binds it to the form `action` prop.
//
// This stub makes the build succeed and honestly reports that the
// action is not wired. The page's own ownership gate + accommodation-
// service still exist for read; only write is unavailable.
//
// Revive the real action when the room-editor workstream resumes.

"use server";

import { redirect } from "next/navigation";

export async function updateRoomAction(
  businessId: string,
  roomId: string,
  _formData: FormData,
): Promise<never> {
  const qs = new URLSearchParams({
    e: "room_editor_not_wired",
    m: "The accommodation room editor is not wired in this environment.",
  });
  redirect(`/nex-native/manage/accommodation?${qs.toString()}&biz=${businessId}&room=${roomId}`);
}
