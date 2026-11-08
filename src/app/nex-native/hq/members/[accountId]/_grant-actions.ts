// src/app/nex-native/hq/members/[accountId]/_grant-actions.ts
//
// Server actions for the HQ admin-grant panel.
// Owner-sealed 2026-11-08 (round 2).

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
import {
  grantShopMonths,
  grantFreeTheme,
  AdminGrantError,
} from "@/lib/nex-native/admin-grant/admin-grant-service";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeAccountId(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  return UUID_SHAPE.test(raw) ? raw : null;
}

export async function grantShopMonthsAction(formData: FormData): Promise<void> {
  const accountId = safeAccountId(formData.get("account_id"));
  if (!accountId) redirect(`/nex-native/hq/members?error=invalid_target`);
  const monthsRaw = formData.get("months");
  const months =
    typeof monthsRaw === "string" ? Number.parseInt(monthsRaw, 10) : Number.NaN;
  if (!Number.isInteger(months) || months < 1 || months > 12) {
    redirect(
      `/nex-native/hq/members/${accountId}/message?grant_error=invalid_months`,
    );
  }
  const noteRaw = formData.get("note");
  const note =
    typeof noteRaw === "string" && noteRaw.trim().length > 0
      ? noteRaw.trim().slice(0, 400)
      : undefined;

  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) {
    redirect(`/nex-native/hq/members/${accountId}/message?grant_error=forbidden`);
  }

  try {
    const r = await grantShopMonths({
      accountId: accountId!,
      months,
      grantedBy: session.account.id,
      note,
    });
    if (!r.ok) {
      const code = r.skipped ?? r.error ?? "unknown";
      redirect(
        `/nex-native/hq/members/${accountId}/message?grant_error=${code}`,
      );
    }
    revalidatePath(`/nex-native/hq/members/${accountId}/message`);
    redirect(
      `/nex-native/hq/members/${accountId}/message?grant_ok=shop_${months}`,
    );
  } catch (e) {
    if (e instanceof AdminGrantError) {
      redirect(
        `/nex-native/hq/members/${accountId}/message?grant_error=${e.code}`,
      );
    }
    throw e;
  }
}

export async function grantFreeThemeAction(formData: FormData): Promise<void> {
  const accountId = safeAccountId(formData.get("account_id"));
  if (!accountId) redirect(`/nex-native/hq/members?error=invalid_target`);
  const themeRaw = formData.get("theme_id");
  const themeId =
    typeof themeRaw === "string" ? themeRaw.trim() : "";
  if (themeId.length < 1 || themeId.length > 128 || !/^[a-z0-9_-]+$/i.test(themeId)) {
    redirect(
      `/nex-native/hq/members/${accountId}/message?grant_error=invalid_theme_id`,
    );
  }
  const noteRaw = formData.get("note");
  const note =
    typeof noteRaw === "string" && noteRaw.trim().length > 0
      ? noteRaw.trim().slice(0, 400)
      : undefined;

  const session = await resolveSessionWithDevOverride();
  if (!session) redirect("/nex-native/sign-in");
  const authorised = await requireHqAdmin(session.account.id)
    .then(() => true)
    .catch(() => false);
  if (!authorised) {
    redirect(`/nex-native/hq/members/${accountId}/message?grant_error=forbidden`);
  }

  try {
    const r = await grantFreeTheme({
      accountId: accountId!,
      themeId,
      grantedBy: session.account.id,
      note,
    });
    if (!r.ok) {
      const code = r.skipped ?? r.error ?? "unknown";
      redirect(
        `/nex-native/hq/members/${accountId}/message?grant_error=${code}`,
      );
    }
    revalidatePath(`/nex-native/hq/members/${accountId}/message`);
    redirect(
      `/nex-native/hq/members/${accountId}/message?grant_ok=theme`,
    );
  } catch (e) {
    if (e instanceof AdminGrantError) {
      redirect(
        `/nex-native/hq/members/${accountId}/message?grant_error=${e.code}`,
      );
    }
    throw e;
  }
}
