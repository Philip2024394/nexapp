// src/lib/nex-native/__tests__/handle-normalise.fixtures.ts
//
// Grapheme-count fixtures. All non-ASCII name strings are composed via
// explicit \uXXXX / \u{XXXXXX} escape sequences so this file is
// pure-ASCII and immune to editor/clipboard transforms.
//
// The test setup asserts [...name].map(c => codepoint) === codepoints
// BEFORE any behaviour test runs. Any corruption fails the self-check.
//
// Expected grapheme counts come from Intl.Segmenter on Node 24.18.0 /
// ICU 78.3. Vercel runs Node 20.x / ICU 73+; segmentation for the
// scripts here has been stable since ICU 70. scripts/verify-icu.mjs is
// the CI enforcement point.

export interface GraphemeFixture {
  readonly label: string;
  readonly name: string;
  readonly codepoints: readonly string[];
  readonly expectedGraphemes: number;
  readonly script: string;
  readonly notes?: string;
}

export const POSITIVE_FIXTURES: readonly GraphemeFixture[] = [
  {
    label: 'ASCII abc',
    name: "\u0061\u0062\u0063",
    codepoints: ["U+0061", "U+0062", "U+0063"],
    expectedGraphemes: 3,
    script: 'latin',
  },
  {
    label: 'ASCII John Smith',
    name: "\u004a\u006f\u0068\u006e\u0020\u0053\u006d\u0069\u0074\u0068",
    codepoints: ["U+004A", "U+006F", "U+0068", "U+006E", "U+0020", "U+0053", "U+006D", "U+0069", "U+0074", "U+0068"],
    expectedGraphemes: 10,
    script: 'latin',
  },
  {
    label: 'Latin precomposed Jose + e-acute',
    name: "\u004a\u006f\u0073\u00e9",
    codepoints: ["U+004A", "U+006F", "U+0073", "U+00E9"],
    expectedGraphemes: 4,
    script: 'latin-extended',
  },
  {
    label: 'Latin decomposed Jose + U+0301',
    name: "\u004a\u006f\u0073\u0065\u0301",
    codepoints: ["U+004A", "U+006F", "U+0073", "U+0065", "U+0301"],
    expectedGraphemes: 4,
    script: 'latin-extended',
    notes: 'NFC-normalises to precomposed Jose',
  },
  {
    label: 'Japanese 4 CJK (Tanaka Taro)',
    name: "\u7530\u4e2d\u592a\u90ce",
    codepoints: ["U+7530", "U+4E2D", "U+592A", "U+90CE"],
    expectedGraphemes: 4,
    script: 'cjk',
  },
  {
    label: 'Chinese 3 CJK (Li Xiao Ming)',
    name: "\u674e\u5c0f\u660e",
    codepoints: ["U+674E", "U+5C0F", "U+660E"],
    expectedGraphemes: 3,
    script: 'cjk',
    notes: 'min-length CJK',
  },
  {
    label: 'Arabic Muhammad (no diacritics)',
    name: "\u0645\u062d\u0645\u062f",
    codepoints: ["U+0645", "U+062D", "U+0645", "U+062F"],
    expectedGraphemes: 4,
    script: 'arabic',
    notes: 'MEEM HAH MEEM DAL - conventional logical order',
  },
  {
    label: 'Arabic Ali (no diacritics)',
    name: "\u0639\u0644\u064a",
    codepoints: ["U+0639", "U+0644", "U+064A"],
    expectedGraphemes: 3,
    script: 'arabic',
    notes: 'AIN LAM YEH - conventional logical order',
  },
  {
    label: 'Arabic Ali (with harakat)',
    name: "\u0639\u064e\u0644\u0650\u064a",
    codepoints: ["U+0639", "U+064E", "U+0644", "U+0650", "U+064A"],
    expectedGraphemes: 3,
    script: 'arabic',
    notes: 'FATHA and KASRA attach to preceding letter',
  },
  {
    label: 'Devanagari Kamal',
    name: "\u0915\u092e\u0932",
    codepoints: ["U+0915", "U+092E", "U+0932"],
    expectedGraphemes: 3,
    script: 'devanagari',
    notes: 'Three bare consonants',
  },
  {
    label: 'Devanagari Rajesh',
    name: "\u0930\u093e\u091c\u0947\u0936",
    codepoints: ["U+0930", "U+093E", "U+091C", "U+0947", "U+0936"],
    expectedGraphemes: 3,
    script: 'devanagari',
    notes: 'RA+AA, JA+E, SHA - marks attach to produce 3 clusters',
  },
  {
    label: 'Thai (plain)',
    name: "\u0e44\u0e17\u0e22",
    codepoints: ["U+0E44", "U+0E17", "U+0E22"],
    expectedGraphemes: 3,
    script: 'thai',
  },
  {
    label: 'ASCII O-apostrophe-Brien',
    name: "\u004f\u0027\u0042\u0072\u0069\u0065\u006e",
    codepoints: ["U+004F", "U+0027", "U+0042", "U+0072", "U+0069", "U+0065", "U+006E"],
    expectedGraphemes: 7,
    script: 'latin',
  },
  {
    label: 'ASCII Jean-Luc',
    name: "\u004a\u0065\u0061\u006e\u002d\u004c\u0075\u0063",
    codepoints: ["U+004A", "U+0065", "U+0061", "U+006E", "U+002D", "U+004C", "U+0075", "U+0063"],
    expectedGraphemes: 8,
    script: 'latin',
  },
  {
    label: 'ASCII Dr. Smith',
    name: "\u0044\u0072\u002e\u0020\u0053\u006d\u0069\u0074\u0068",
    codepoints: ["U+0044", "U+0072", "U+002E", "U+0020", "U+0053", "U+006D", "U+0069", "U+0074", "U+0068"],
    expectedGraphemes: 9,
    script: 'latin',
  },
  {
    label: 'Business name Hammerex Products',
    name: "\u0048\u0061\u006d\u006d\u0065\u0072\u0065\u0078\u0020\u0050\u0072\u006f\u0064\u0075\u0063\u0074\u0073",
    codepoints: ["U+0048", "U+0061", "U+006D", "U+006D", "U+0065", "U+0072", "U+0065", "U+0078", "U+0020", "U+0050", "U+0072", "U+006F", "U+0064", "U+0075", "U+0063", "U+0074", "U+0073"],
    expectedGraphemes: 17,
    script: 'latin',
  },
];

export const NEGATIVE_FIXTURES = [
  {
    label: 'too short (2 ASCII)',
    raw: "\u0061\u0062",
    reason: 'too_short',
  },
  {
    label: 'too long (33 ASCII)',
    raw: "\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061\u0061",
    reason: 'too_long',
  },
  {
    label: 'excessive marks on one grapheme',
    raw: "\u0061\u0062\u0063\u0061\u0301\u0301\u0301\u0301\u0301\u0301",
    reason: 'too_many_marks_per_grapheme',
  },
  {
    label: 'null byte',
    raw: "\u0041\u0000\u0042",
    reason: 'contains_control',
  },
  {
    label: 'tab',
    raw: "\u0041\u0009\u0042",
    reason: 'contains_control',
  },
  {
    label: 'newline (LF)',
    raw: "\u0041\u000a\u0042",
    reason: 'contains_control',
  },
  {
    label: 'carriage return',
    raw: "\u0041\u000d\u0042",
    reason: 'contains_control',
  },
  {
    label: 'non-breaking space U+00A0',
    raw: "\u0041\u00a0\u0042",
    reason: 'contains_whitespace',
  },
  {
    label: 'ideographic space U+3000',
    raw: "\u0041\u3000\u0042",
    reason: 'contains_whitespace',
  },
  {
    label: 'line separator U+2028',
    raw: "\u0041\u2028\u0042",
    reason: 'contains_whitespace',
  },
  {
    label: 'zero-width joiner U+200D',
    raw: "\u0041\u200d\u0042",
    reason: 'contains_format',
  },
  {
    label: 'left-to-right mark U+200E',
    raw: "\u0041\u200e\u0042",
    reason: 'contains_format',
  },
  {
    label: 'red heart + VS16',
    raw: "\u004c\u0075\u006c\u0075\u0020\u2764\ufe0f",
    reason: 'contains_emoji',
  },
  {
    label: 'flag GB (regional indicators)',
    raw: "\u004c\u0075\u006c\u0075\u0020\u{1f1ec}\u{1f1e7}",
    reason: 'contains_emoji',
  },
  {
    label: 'wave + skin tone',
    raw: "\u0048\u0065\u0079\u0020\u{1f44b}\u{1f3fd}",
    reason: 'contains_emoji',
  },
  {
    label: 'keycap 1 (U+0031 + U+20E3)',
    raw: "\u0041\u0031\u20e3",
    reason: 'contains_emoji',
  },
  {
    label: 'supplementary variation selector',
    raw: "\u0041\u{e0100}\u0042",
    reason: 'contains_emoji',
  },
  {
    label: 'combining enclosing circle U+20DD',
    raw: "\u0041\u20dd\u0042",
    reason: 'contains_emoji',
  },
  {
    label: 'snowflake pictographic U+2744',
    raw: "\u0063\u006f\u006c\u0064\u0020\u2744",
    reason: 'contains_emoji',
  },
  {
    label: 'sun pictographic U+2600',
    raw: "\u0073\u0075\u006e\u0020\u2600",
    reason: 'contains_emoji',
  },
  {
    label: 'exclamation mark',
    raw: "\u0048\u0065\u006c\u006c\u006f\u0021",
    reason: 'invalid_chars',
  },
  {
    label: 'at symbol',
    raw: "\u0061\u0040\u0062",
    reason: 'invalid_chars',
  },
  {
    label: 'slash',
    raw: "\u0061\u002f\u0062",
    reason: 'invalid_chars',
  },
  {
    label: 'only hyphens',
    raw: "\u002d\u002d\u002d",
    reason: 'invalid_chars',
  },
  {
    label: 'only apostrophes',
    raw: "\u0027\u0027\u0027",
    reason: 'invalid_chars',
  },
  {
    label: 'trailing period',
    raw: "\u004a\u002e\u0052\u002e\u0052\u002e",
    reason: 'invalid_chars',
  },
  {
    label: 'leading period',
    raw: "\u002e\u0061\u0062\u0063",
    reason: 'invalid_chars',
  },
  {
    label: 'reserved admin case-insensitive',
    raw: "\u0041\u0064\u006d\u0069\u006e",
    reason: 'reserved',
  },
  {
    label: 'reserved NEX',
    raw: "\u004e\u0045\u0058",
    reason: 'reserved',
  },
  {
    label: 'reserved nex admin',
    raw: "\u006e\u0065\u0078\u0020\u0061\u0064\u006d\u0069\u006e",
    reason: 'reserved',
  },
] as const;

// Reversed-order Arabic diagnostic strings. The test suite asserts no
// POSITIVE fixture matches any of these.
export const ARABIC_REVERSED_SAMPLES = {
  reversedMuhammad: "\u062f\u0645\u062d\u0645",
  reversedAli: "\u064a\u0644\u0650\u0639\u064e",
} as const;
