"use server";

// src/app/nex-native/hq/chat-themes/_actions.ts
//
// HQ · rename a chat theme row. Owner-authorised 2026-11-03.
// Gated behind requireHqAdmin so only accounts with hq_role='admin'
// can touch theme names.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { requireHqAdmin, HqAuthorizationError } from "@/lib/nex-native/hq-authorization";
import { updateTheme } from "@/lib/nex-native/chat-theme-service";

export async function hqRenameChatThemeAction(formData: FormData): Promise<void> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  try {
    await requireHqAdmin(session.account.id);
  } catch (err) {
    if (err instanceof HqAuthorizationError) redirect("/nex-native?e=not_hq");
    throw err;
  }

  const themeId = String(formData.get("theme_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  // Optional · tagline update in the same form (keeps the rename UI tight).
  const taglineRaw = formData.get("tagline");
  const tagline =
    typeof taglineRaw === "string" ? taglineRaw.trim() : null;

  if (!themeId || !name) {
    redirect("/nex-native/hq/chat-themes?e=bad_input");
  }
  if (name.length < 1 || name.length > 60) {
    redirect("/nex-native/hq/chat-themes?e=name_length");
  }
  if (tagline && tagline.length > 200) {
    redirect("/nex-native/hq/chat-themes?e=tagline_length");
  }

  try {
    await updateTheme(themeId, {
      name,
      // Only touch tagline if the field was present + non-empty · an
      // empty submission leaves the existing tagline alone (so a blank
      // tagline doesn't accidentally wipe meaningful copy).
      ...(tagline !== null && tagline.length > 0 ? { tagline } : {}),
    });
  } catch (err) {
    console.error(
      `[hq-chat-themes] rename ${themeId} failed · ${err instanceof Error ? err.message : "unknown"}`,
    );
    redirect("/nex-native/hq/chat-themes?e=db_error");
  }

  revalidatePath("/nex-native/hq/chat-themes");
  revalidatePath("/nex-native/chat-themes-library");
  redirect(`/nex-native/hq/chat-themes?m=renamed&id=${themeId}`);
}
