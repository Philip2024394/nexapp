// src/app/nex-native/welcome/_welcome-intent.ts
//
// NEX welcome · intent constants and pure helpers.
// -----------------------------------------------------------------------------
// Plain module (NOT "use server") so it can be imported from both
// server components (welcome/page.tsx · pick-theme/page.tsx) AND
// the vitest intent-persistence suite.
//
// The "use server" module _remember-intent-action.ts imports from
// this file to use the token list + guard inside its async action.
//
// Owner-authorised intent persistence · 2026-10-15.

/** The three intent tokens that match the welcome card keys. The
 *  array is exported so a new intent can only be added by extending
 *  this canonical list. */
export const WELCOME_INTENT_TOKENS = [
  "themes",
  "shop",
  "personalised",
] as const;

export type WelcomeIntent = (typeof WELCOME_INTENT_TOKENS)[number];

/** Cookie key · stable string so pick-theme reads the same name. */
export const WELCOME_INTENT_COOKIE = "nex_welcome_intent";

/** Guard · narrows arbitrary strings to the WelcomeIntent union. */
export function isWelcomeIntent(
  value: string | null | undefined,
): value is WelcomeIntent {
  return (
    typeof value === "string" &&
    (WELCOME_INTENT_TOKENS as readonly string[]).includes(value)
  );
}

/** Human-friendly label per welcome-intent token · surfaces the user's
 *  earlier card tap on the welcome page. Pure mapping · consumed by
 *  pick-theme/page.tsx and pinned by the intent-persistence vitest. */
export function pickThemeIntentCopy(intent: WelcomeIntent): string {
  switch (intent) {
    case "themes":
      return "Based on your interest in Chat Themes · start with one of the free NEX looks below. You can browse the full library any time.";
    case "shop":
      return "Based on your interest in the Chat Themes Shop · start with one of the free NEX looks below, then try any premium theme free for 7 days inside the library.";
    case "personalised":
      return "Based on your interest in Personalised Chat · start with one of the free NEX looks below. Every theme shows live when you open your chat.";
  }
}
