// tests/e2e/_identify-session-account.spec.ts
//
// Read-only probe · identify which NEX account the saved Playwright
// session belongs to, without touching cookies, tokens, or storage-
// state file contents.
//
// What this probe does:
//   · Loads the Playwright context with the sealed storageState path
//     (handled by the sibling config file).
//   · Navigates to /nex-native/settings/profile (a signed-in-only page
//     that renders the viewer's own public nex-handle via Bridge 80's
//     NexIdShare component).
//   · Reads the DOM text of the data-testid='nex-handle' element.
//   · Prints ONLY that handle string. nex_handle is public identity by
//     sealed migration-013 doctrine · safe to disclose.
//
// What this probe explicitly does NOT do:
//   · Never reads tests/e2e/.auth/state.json contents.
//   · Never calls page.context().cookies() or similar.
//   · Never reads document.cookie.
//   · Never prints display_name, email, phone, address, or any
//     private field.
//   · Never writes to the database.
//   · Never navigates further (no deep-link follow-through).
//
// This file is self-contained · delete after use if desired.

import { test, expect } from "@playwright/test";

test("identify session · print only the public nex_handle", async ({ page }) => {
  await page.goto("/nex-native/settings/profile", {
    waitUntil: "domcontentloaded",
  });

  // Bridge 80 · _nex-id-share.tsx renders the viewer's handle via
  // data-testid='nex-handle'. If that attribute isn't present on this
  // build, fall back to _copy-handle-button's data-nex-id. Either way
  // we read PUBLIC identity text only · no cookies, no tokens.
  const primary = page.getByTestId("nex-handle");
  const primaryCount = await primary.count();

  let handle: string | null = null;
  if (primaryCount > 0) {
    const txt = (await primary.first().textContent())?.trim() ?? "";
    if (/^nex-[0-9]{5,}$/i.test(txt)) handle = txt;
  }

  if (!handle) {
    // Fallback · scan the whole settings profile for the nex-NNNNN
    // pattern. Public identity by sealed doctrine · safe to extract.
    const body = (await page.locator("body").textContent()) ?? "";
    const m = body.match(/\bnex-[0-9]{5,}\b/i);
    if (m) handle = m[0];
  }

  if (handle) {
    // eslint-disable-next-line no-console
    console.log(`SESSION_IDENTITY_HANDLE: ${handle}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`SESSION_IDENTITY_HANDLE: <not_found · session may be signed-out or page markup changed>`);
  }

  expect(handle, "nex_handle should be readable from the signed-in profile page").toBeTruthy();
});
