// src/lib/nex-native/account-wall/server-actions.ts
//
// NEX Account Wall · Server Actions bound to the modal buttons.
// -------------------------------------------------------------
// Two actions:
//
//   · setPendingAndSignUpAction  · the "Create free account" button.
//       Writes the pending-wall cookie (action id + nextUrl + optional
//       payload) and redirects to /nex-native/sign-in?mode=signup
//       (per owner directive 2026-11-04 · the one-URL sign-in surface
//       hosts both signup and sign-in tabs; the retired
//       /nex-native/create-account route catches on the business-slug
//       not-found surface · Cycle 14 bug fix 2026-11-25).
//
//   · setPendingAndSignInAction · the "Already have one? Sign in" link.
//       Same cookie write, redirect to /nex-native/sign-in.
//
// Both actions validate every input before writing anything. A client
// cannot smuggle an open-redirect nextUrl or an unknown action id past
// these gates.

"use server";

import { redirect } from "next/navigation";
import {
  isAllowedNextUrl,
  setPendingAccountWall,
  clearPendingAccountWall,
} from "./pending-action";
import { isRegisteredAccountWallAction } from "./wall-copy";

function sanitise(formData: FormData): {
  action: string;
  nextUrl: string;
  payload: string | null;
} {
  const action = String(formData.get("action") ?? "");
  const nextUrl = String(formData.get("nextUrl") ?? "");
  const rawPayload = formData.get("payload");
  const payload =
    typeof rawPayload === "string" && rawPayload.length > 0
      ? rawPayload.slice(0, 200)
      : null;
  return { action, nextUrl, payload };
}

/** "Create free account" from inside an account wall. */
export async function setPendingAndSignUpAction(
  formData: FormData,
): Promise<void> {
  const { action, nextUrl, payload } = sanitise(formData);
  if (isRegisteredAccountWallAction(action) && isAllowedNextUrl(nextUrl)) {
    await setPendingAccountWall({ action, nextUrl, payload });
  } else {
    // Silently clear any stale state · still proceed to sign-up so the
    // user never sees a dead-end, they just land on a plain signup.
    await clearPendingAccountWall();
  }
  redirect("/nex-native/sign-in?mode=signup");
}

/** "Already have one? Sign in" from inside an account wall. */
export async function setPendingAndSignInAction(
  formData: FormData,
): Promise<void> {
  const { action, nextUrl, payload } = sanitise(formData);
  if (isRegisteredAccountWallAction(action) && isAllowedNextUrl(nextUrl)) {
    await setPendingAccountWall({ action, nextUrl, payload });
  } else {
    await clearPendingAccountWall();
  }
  redirect("/nex-native/sign-in");
}

/** "Keep looking" / dismiss affordance from inside the modal. Clears
 *  any pending state and redirects to a validated local path (the page
 *  the user was browsing when the modal opened). */
export async function dismissAccountWallAction(
  formData: FormData,
): Promise<void> {
  const returnTo = String(formData.get("returnTo") ?? "");
  await clearPendingAccountWall();
  const safe = isAllowedNextUrl(returnTo) ? returnTo : "/nex-native/home";
  redirect(safe);
}
