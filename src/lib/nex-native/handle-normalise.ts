// src/lib/nex-native/handle-normalise.ts
//
// NEX chosen-handle normalisation + validation · single canonical module.
//
// v12 validator pipeline (ordering MATTERS):
//
//   Phase 1 · Reject forbidden categories on RAW input (before NFC)
//              · Cc control, Cf format, Cs surrogate, Co private-use,
//                Cn unassigned, non-U+0020 whitespace
//   Phase 2 · Reject emoji presentation on RAW input (before NFC)
//              · Extended_Pictographic, regional indicators, skin-tone,
//                variation selectors (both ranges), combining enclosing
//   Phase 3 · NFC normalise
//   Phase 4 · Trim and collapse U+0020 (ASCII space) ONLY
//   Phase 5 · Code-point cap: ≤ 160 Unicode scalars
//   Phase 6 · Positive allowlist: [\p{L}\p{N}\p{M} \-_'.]
//   Phase 7 · Grapheme count: 3 ≤ graphemes ≤ 32
//   Phase 8 · Per-grapheme marks ≤ 4; no marks-only grapheme;
//              first and last graphemes must contain a letter or number
//   Phase 9 · Reserved-name reject
//
// Forbidden characters are rejected on raw input so the validator never
// silently transforms disallowed input into accepted input.
//
// Allowed:
//   · \p{L}  Unicode letters (any script)
//   · \p{N}  Unicode numbers (any script)
//   · \p{M}  Combining marks (capped at 4 per grapheme)
//   · U+0020 ASCII space (interior single space only · leading/trailing trimmed)
//   · U+002D hyphen-minus
//   · U+005F underscore
//   · U+0027 apostrophe
//   · U+002E period
//
// Rejected (each with specific telemetry reason):
//   · Controls, formats, surrogate halves, private-use, unassigned
//   · \p{Extended_Pictographic}, regional indicators, skin-tone modifiers,
//     variation selectors (U+FE00-U+FE0F and U+E0100-U+E01EF),
//     combining enclosing marks (U+20DD-U+20E4)
//   · Non-U+0020 whitespace (tabs, newlines, NBSP, line separators)
//   · > 160 code points
//   · < 3 or > 32 graphemes
//   · > 4 combining marks on any grapheme
//   · Marks-only graphemes
//   · First or last grapheme without a letter or number
//   · Reserved names
//
// NOT a security boundary against direct Supabase service-role writes.
// The PostgreSQL CHECK constraint in migration 204 is a byte-level
// structural backstop only · see migration 204 header for the
// enforcement model and operational controls.
//
// Runtime: Node 20+ (Next.js 16 on Vercel). All regex features used
// (/u flag, \p{Property}, \u{XXXXXX}, Intl.Segmenter) are stable in
// Node 20. The /v flag is NOT used (not required; keeps compat with
// older Node 20 patch levels).
//
// Emoji policy is complete for the characters this validator was
// adversarially tested against on the deployed Node's ICU version.
// Future Unicode releases may add emoji-presentation sequences not
// covered by the current rules. CI must re-verify when Node/ICU
// updates (see scripts/verify-icu.mjs).

declare const ValidatedChosenHandleBrand: unique symbol;
/** A chosen-handle value that has passed validateChosenHandle. Compile-
 *  time hint only · not a security boundary. The service layer re-asserts
 *  at runtime via assertValidChosenHandle(). */
export type ValidatedChosenHandle = string & {
  readonly [ValidatedChosenHandleBrand]: true;
};

export type ChosenHandleRejectionReason =
  | "empty"
  | "too_short"
  | "too_long"
  | "too_many_codepoints"
  | "too_many_marks_per_grapheme"
  | "contains_control"
  | "contains_format"
  | "contains_emoji"
  | "contains_whitespace"
  | "invalid_chars"
  | "reserved";

export type ChosenHandleValidation =
  | { ok: true; normalised: ValidatedChosenHandle }
  | { ok: false; reason: ChosenHandleRejectionReason };

export const CHOSEN_HANDLE_MIN_GRAPHEMES = 3;
export const CHOSEN_HANDLE_MAX_GRAPHEMES = 32;
export const CHOSEN_HANDLE_MAX_CODEPOINTS = 160;
export const CHOSEN_HANDLE_MAX_MARKS_PER_GRAPHEME = 4;

// Phase 1 reject patterns (on raw input, before NFC).
const CONTROL_RE = /\p{Cc}/u;
const FORMAT_RE = /\p{Cf}/u;
const SURROGATE_RE = /\p{Cs}/u;
const PRIVATE_USE_RE = /\p{Co}/u;
const UNASSIGNED_RE = /\p{Cn}/u;
// Non-U+0020 whitespace: tab, newline, VT, FF, CR, NEXT LINE, NBSP,
// ogham mark, en/em quad through hair space, line sep, para sep,
// narrow NBSP, medium math space, ideographic space. Explicit
// alternation (no /v flag).
const FORBIDDEN_WHITESPACE_RE =
  /[\t\n\v\f\r\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/u;

// Phase 2 reject patterns.
const EMOJI_PICTOGRAPHIC_RE = /\p{Extended_Pictographic}/u;
const EMOJI_REGIONAL_INDICATOR_RE = /[\u{1F1E6}-\u{1F1FF}]/u;
const EMOJI_SKIN_TONE_RE = /[\u{1F3FB}-\u{1F3FF}]/u;
const EMOJI_VARIATION_SELECTOR_RE =
  /[\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}]/u;
const EMOJI_COMBINING_ENCLOSING_RE = /[\u{20DD}-\u{20E4}]/u;

// Phase 6 positive allowlist. Everything in the normalised string
// must match this.
const ALLOWED_RE = /^[\p{L}\p{N}\p{M} \-_'.]+$/u;

// Grapheme segmenter cached at module scope.
const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** NFC normalise + trim ASCII-space + collapse U+0020 runs. ONLY touches
 *  U+0020 characters; never silently converts other whitespace. */
export function normaliseChosenHandle(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/^ +| +$/gu, "")
    .replace(/ {2,}/gu, " ");
}

function graphemes(s: string): string[] {
  const out: string[] = [];
  for (const { segment } of SEGMENTER.segment(s)) out.push(segment);
  return out;
}

function graphemeMarkCount(g: string): number {
  let n = 0;
  for (const cp of g) if (/\p{M}/u.test(cp)) n++;
  return n;
}

function graphemeIsOnlyMarks(g: string): boolean {
  return g.length > 0 && /^\p{M}+$/u.test(g);
}

function graphemeHasLetterOrNumber(g: string): boolean {
  return /[\p{L}\p{N}]/u.test(g);
}

/** The authoritative chosen-handle validator. Shared by client-side
 *  feedback (_nex-name-field.tsx, _chosen-handle-field.tsx), server
 *  actions (createNexAccountAction, updateChosenHandleAction), and the
 *  account-service runtime guard (assertValidChosenHandle). */
export function validateChosenHandle(
  raw: string,
  isReserved: (lowercasedNormalised: string) => boolean,
): ChosenHandleValidation {
  // Phase 1 · forbidden categories on RAW input (before any transform).
  if (CONTROL_RE.test(raw)) return { ok: false, reason: "contains_control" };
  if (FORMAT_RE.test(raw)) return { ok: false, reason: "contains_format" };
  if (SURROGATE_RE.test(raw)) return { ok: false, reason: "invalid_chars" };
  if (PRIVATE_USE_RE.test(raw)) return { ok: false, reason: "invalid_chars" };
  if (UNASSIGNED_RE.test(raw)) return { ok: false, reason: "invalid_chars" };
  if (FORBIDDEN_WHITESPACE_RE.test(raw)) {
    return { ok: false, reason: "contains_whitespace" };
  }

  // Phase 2 · emoji-presentation reject on RAW input.
  if (EMOJI_PICTOGRAPHIC_RE.test(raw)) return { ok: false, reason: "contains_emoji" };
  if (EMOJI_REGIONAL_INDICATOR_RE.test(raw)) return { ok: false, reason: "contains_emoji" };
  if (EMOJI_SKIN_TONE_RE.test(raw)) return { ok: false, reason: "contains_emoji" };
  if (EMOJI_VARIATION_SELECTOR_RE.test(raw)) return { ok: false, reason: "contains_emoji" };
  if (EMOJI_COMBINING_ENCLOSING_RE.test(raw)) return { ok: false, reason: "contains_emoji" };

  // Phase 3 + 4 · NFC + ASCII-space-only trim/collapse.
  const n = normaliseChosenHandle(raw);

  if (n.length === 0) return { ok: false, reason: "empty" };

  // Phase 5 · code-point cap. Measured in Unicode scalars.
  const codepointLength = [...n].length;
  if (codepointLength > CHOSEN_HANDLE_MAX_CODEPOINTS) {
    return { ok: false, reason: "too_many_codepoints" };
  }

  // Phase 6 · positive allowlist on normalised value.
  if (!ALLOWED_RE.test(n)) return { ok: false, reason: "invalid_chars" };

  // Phase 7 · grapheme-count bounds.
  const gs = graphemes(n);
  if (gs.length < CHOSEN_HANDLE_MIN_GRAPHEMES) {
    return { ok: false, reason: "too_short" };
  }
  if (gs.length > CHOSEN_HANDLE_MAX_GRAPHEMES) {
    return { ok: false, reason: "too_long" };
  }

  // Phase 8 · per-grapheme structural rules.
  for (const g of gs) {
    if (graphemeMarkCount(g) > CHOSEN_HANDLE_MAX_MARKS_PER_GRAPHEME) {
      return { ok: false, reason: "too_many_marks_per_grapheme" };
    }
    if (graphemeIsOnlyMarks(g)) {
      return { ok: false, reason: "invalid_chars" };
    }
  }
  if (!graphemeHasLetterOrNumber(gs[0]!)) {
    return { ok: false, reason: "invalid_chars" };
  }
  if (!graphemeHasLetterOrNumber(gs[gs.length - 1]!)) {
    return { ok: false, reason: "invalid_chars" };
  }

  // Phase 9 · reserved-name reject.
  if (isReserved(n.toLowerCase())) {
    return { ok: false, reason: "reserved" };
  }

  return { ok: true, normalised: n as ValidatedChosenHandle };
}

/** Runtime guard · service-layer defence-in-depth. Throws if the input
 *  is not a valid chosen handle under the full policy. Services call
 *  this to catch `as any` casts, untyped JavaScript callers, and any
 *  bypass of the compile-time ValidatedChosenHandle brand. Not a
 *  guarantee against direct Supabase service-role writes · see Path A
 *  limitation in migration 204. */
export function assertValidChosenHandle(
  handle: string | null,
  isReserved: (lc: string) => boolean,
): asserts handle is ValidatedChosenHandle | null {
  if (handle === null) return;
  const v = validateChosenHandle(handle, isReserved);
  if (!v.ok) {
    throw new Error(
      `assertValidChosenHandle: input rejected · reason=${v.reason}`,
    );
  }
  if (v.normalised !== handle) {
    throw new Error(
      "assertValidChosenHandle: input was not pre-normalised · expected NFC + trim + collapse",
    );
  }
}

/** User-facing text for a rejection reason. Imported by inline-feedback
 *  UI (client components) and by redirect-with-error flows in actions. */
export function describeValidationReason(
  reason: ChosenHandleRejectionReason,
): string {
  switch (reason) {
    case "empty":
      return "Enter a name";
    case "too_short":
      return "At least 3 characters";
    case "too_long":
      return "32 characters or fewer";
    case "too_many_codepoints":
      return "Too long · reduce combining marks or shorten the name";
    case "too_many_marks_per_grapheme":
      return "Too many combining marks on one character";
    case "contains_control":
      return "Contains invalid control characters";
    case "contains_format":
      return "Contains invisible formatting characters";
    case "contains_emoji":
      return "No emojis in display names";
    case "contains_whitespace":
      return "Use regular spaces only · not tabs or special whitespace";
    case "invalid_chars":
      return "Only letters, numbers, spaces, hyphens, underscores, apostrophes, and periods";
    case "reserved":
      return "That name is reserved · pick another";
  }
}
