"use server";

// src/app/nex-native/settings/profile/edit/_avatar-actions.ts
//
// NEX Ireland · profile avatar upload + delete server actions.
// Owner-authorised 2026-11-04.
// --------------------------------------------------------
// Writes to the nex-avatars Supabase Storage bucket (migration 045 ·
// public read, service-role write) at path `{accountId}/avatar.{ext}`.
// Updates nex_account_profile.avatar_url to the resolved public URL.
// Delete removes the row's avatar_url + deletes the stored object.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
// Owner directive 2026-11-12 · use the dev-override resolver so
// Nex-99901 (and other dev-impersonated personas) can upload avatars
// against the local dev build. In production dev-impersonation is
// disabled and this helper falls back to the real session resolver
// automatically · no runtime difference.
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { NEX_AVATAR_BUCKET } from "@/lib/nex-native/account-profile-service";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extForContentType(ct: string): string {
  if (ct === "image/jpeg") return "jpg";
  if (ct === "image/png") return "png";
  if (ct === "image/webp") return "webp";
  if (ct === "image/gif") return "gif";
  return "bin";
}

export async function uploadAvatarAction(formData: FormData): Promise<void> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");
  const accountId = session.account.id;

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/nex-native/settings/profile/edit?e=avatar_no_file");
  }
  const uploadFile = file as File;
  if (uploadFile.size > MAX_BYTES) {
    redirect("/nex-native/settings/profile/edit?e=avatar_too_large");
  }
  if (!ALLOWED_TYPES.has(uploadFile.type)) {
    redirect("/nex-native/settings/profile/edit?e=avatar_bad_type");
  }

  const ext = extForContentType(uploadFile.type);
  const path = `${accountId}/avatar.${ext}`;
  const bytes = new Uint8Array(await uploadFile.arrayBuffer());

  const { error: uploadErr } = await nexSupabaseAdmin.storage
    .from(NEX_AVATAR_BUCKET)
    .upload(path, bytes, {
      upsert: true,
      contentType: uploadFile.type,
      cacheControl: "3600",
    });
  if (uploadErr) {
    console.error("[avatar-upload] storage upload failed", uploadErr);
    redirect("/nex-native/settings/profile/edit?e=avatar_upload_failed");
  }

  const { data: pub } = nexSupabaseAdmin.storage
    .from(NEX_AVATAR_BUCKET)
    .getPublicUrl(path);
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: profileErr } = await nexSupabaseAdmin
    .from("nex_account_profile")
    .upsert(
      { account_id: accountId, avatar_url: publicUrl },
      { onConflict: "account_id" },
    );
  if (profileErr) {
    console.error("[avatar-upload] profile upsert failed", profileErr);
    redirect("/nex-native/settings/profile/edit?e=avatar_persist_failed");
  }

  revalidatePath("/nex-native/settings/profile/edit");
  revalidatePath("/nex-native/profile/me");
}

// Owner directive 2026-11-12 · optional "hero image" (profile banner)
// upload on the Edit Profile page. Writes to nex_account_profile.
// cover_image_url (migration 205) via the same nex-avatars bucket as
// avatars, using a `{accountId}/cover.{ext}` path so each owner has
// exactly one cover slot. Profile view already renders the cover when
// non-null and falls back to a gradient when null · this action
// simply flips that signal.
export async function uploadHeroCoverAction(formData: FormData): Promise<void> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");
  const accountId = session.account.id;

  const file = formData.get("cover");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/nex-native/settings/profile/edit?e=cover_no_file");
  }
  const uploadFile = file as File;
  if (uploadFile.size > MAX_BYTES) {
    redirect("/nex-native/settings/profile/edit?e=cover_too_large");
  }
  if (!ALLOWED_TYPES.has(uploadFile.type)) {
    redirect("/nex-native/settings/profile/edit?e=cover_bad_type");
  }

  const ext = extForContentType(uploadFile.type);
  const path = `${accountId}/cover.${ext}`;
  const bytes = new Uint8Array(await uploadFile.arrayBuffer());

  const { error: uploadErr } = await nexSupabaseAdmin.storage
    .from(NEX_AVATAR_BUCKET)
    .upload(path, bytes, {
      upsert: true,
      contentType: uploadFile.type,
      cacheControl: "3600",
    });
  if (uploadErr) {
    console.error("[cover-upload] storage upload failed", uploadErr);
    redirect("/nex-native/settings/profile/edit?e=cover_upload_failed");
  }

  const { data: pub } = nexSupabaseAdmin.storage
    .from(NEX_AVATAR_BUCKET)
    .getPublicUrl(path);
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: profileErr } = await nexSupabaseAdmin
    .from("nex_account_profile")
    .upsert(
      { account_id: accountId, cover_image_url: publicUrl },
      { onConflict: "account_id" },
    );
  if (profileErr) {
    // Migration 205 may not be applied in some envs · surface a soft
    // message instead of a 500. Avatar + other fields continue to
    // work regardless of this write's outcome.
    console.error("[cover-upload] profile upsert failed", profileErr);
    redirect("/nex-native/settings/profile/edit?e=cover_persist_failed");
  }

  revalidatePath("/nex-native/settings/profile/edit");
  revalidatePath("/nex-native/profile/me");
}

export async function deleteHeroCoverAction(): Promise<void> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");
  const accountId = session.account.id;

  const { data: list } = await nexSupabaseAdmin.storage
    .from(NEX_AVATAR_BUCKET)
    .list(accountId);
  const paths =
    list?.map((o) => `${accountId}/${o.name}`).filter((p) => p.includes("/cover.")) ?? [];
  if (paths.length > 0) {
    await nexSupabaseAdmin.storage.from(NEX_AVATAR_BUCKET).remove(paths);
  }

  const { error } = await nexSupabaseAdmin
    .from("nex_account_profile")
    .upsert(
      { account_id: accountId, cover_image_url: null },
      { onConflict: "account_id" },
    );
  if (error) {
    console.error("[cover-delete] profile upsert failed", error);
    redirect("/nex-native/settings/profile/edit?e=cover_delete_failed");
  }

  revalidatePath("/nex-native/settings/profile/edit");
  revalidatePath("/nex-native/profile/me");
}

export async function deleteAvatarAction(): Promise<void> {
  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");
  const accountId = session.account.id;

  const { data: list } = await nexSupabaseAdmin.storage
    .from(NEX_AVATAR_BUCKET)
    .list(accountId);
  const paths =
    list?.map((o) => `${accountId}/${o.name}`).filter((p) => p.includes("/avatar.")) ?? [];
  if (paths.length > 0) {
    await nexSupabaseAdmin.storage.from(NEX_AVATAR_BUCKET).remove(paths);
  }

  const { error } = await nexSupabaseAdmin
    .from("nex_account_profile")
    .upsert(
      { account_id: accountId, avatar_url: null },
      { onConflict: "account_id" },
    );
  if (error) {
    console.error("[avatar-delete] profile upsert failed", error);
    redirect("/nex-native/settings/profile/edit?e=avatar_delete_failed");
  }

  revalidatePath("/nex-native/settings/profile/edit");
  revalidatePath("/nex-native/profile/me");
}
