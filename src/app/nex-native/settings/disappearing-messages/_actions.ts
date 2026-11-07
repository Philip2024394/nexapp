"use server";

// src/app/nex-native/settings/disappearing-messages/_actions.ts
//
// NEX Chat · disappearing-messages default · server actions.
// Owner-authorised 2026-11-07.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import {
  DISAPPEARING_PRESETS,
  setDisappearingDefault,
  type DisappearingSeconds,
} from "@/lib/nex-native/disappearing-messages-service";

const RETURN_PATH = "/nex-native/settings/disappearing-messages";

function redirectBack(status: string): never {
  const qs = new URLSearchParams({ s: status });
  redirect(`${RETURN_PATH}?${qs.toString()}`);
}

function narrowFromForm(raw: string): DisappearingSeconds | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  // Accept any preset value we expose in the UI.
  for (const p of DISAPPEARING_PRESETS) {
    if (p.value === n) return n as DisappearingSeconds;
  }
  return null;
}

export async function setDisappearingDefaultAction(
  formData: FormData,
): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=/nex-native/settings/disappearing-messages",
    );
  }
  const raw = String(formData.get("value") ?? "");
  const value = narrowFromForm(raw);
  if (value === null) {
    redirectBack("err_bad_value");
  }
  try {
    await setDisappearingDefault(session.account.id, value);
  } catch (e) {
    const msg = (e as Error).message ?? "update";
    // Column-absence is honest · surface "migration not applied" so the
    // owner can see the real blocker instead of a generic failure.
    if (/does not exist/i.test(msg)) {
      redirectBack("err_migration_282_unapplied");
    }
    redirectBack(`err_${(e as Error).name ?? "update"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack(`ok_${value}`);
}

export async function resetDisappearingDefaultAction(): Promise<never> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(
      "/nex-native/sign-in?next=/nex-native/settings/disappearing-messages",
    );
  }
  try {
    await setDisappearingDefault(session.account.id, 0);
  } catch (e) {
    const msg = (e as Error).message ?? "reset";
    if (/does not exist/i.test(msg)) {
      redirectBack("err_migration_282_unapplied");
    }
    redirectBack(`err_${(e as Error).name ?? "reset"}`);
  }
  revalidatePath(RETURN_PATH);
  redirectBack("ok_reset");
}
