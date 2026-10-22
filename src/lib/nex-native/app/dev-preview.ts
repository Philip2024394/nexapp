// src/lib/nex-native/app/dev-preview.ts
//
// Owner directive 2026-10-22 (afternoon) · dev-only bypass for the
// "signed-in users get redirected away from auth / guest surfaces"
// gates. Lets the owner inspect sign-in, create-account, free-chat
// picker, etc. in a signed-in browser without logging out.
//
// Guard: production requests NEVER bypass. The query param is only
// honoured on non-production builds (localhost dev). This keeps the
// escape hatch surgical to the dev loop.
//
// Usage from a server page:
//   const sp = (await searchParams) ?? {};
//   if (session && !devPreviewOn(sp)) redirect("/nex-native/contacts");

export function devPreviewOn(
  searchParams:
    | Record<string, string | string[] | undefined>
    | undefined,
): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const raw = searchParams?.preview;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "1";
}
