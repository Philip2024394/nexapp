// scripts/mock-personas/persona-manifest.mjs
//
// Owner-approved 2026-10-26 · 24 seed personas (22 Indonesian + 2
// ambiguous Asian faces from the global grid, all presented as
// Indonesian · 90% Indo rule honoured). Each entry carries:
//   · id           · deterministic UUIDv5-ish synthesised from
//                    SHA-256(handle); same handle → same id forever.
//   · handle       · lowercase, kebab-case, unique.
//   · displayName  · what viewers see in chat / contacts / Live.
//   · city         · Indonesian city for locale realism.
//   · locale       · ISO locale (all 'id-ID').
//   · sourceCrop   · which crop file in tests/_persona-crops/ is
//                    the avatar for this persona.
//   · avatarFile   · the filename to use in the Supabase bucket.
//
// Change the id generation at your peril · stable ids are what makes
// Slice 3 (divert / impersonation) resumable across restarts.

import { createHash } from "node:crypto";

function deterministicUuid(seed) {
  // Hash the seed, format first 32 hex chars as a v4-shaped UUID.
  // Not a real v5 (would need a registered namespace) but behaves
  // the same way: same input → same UUID.
  const h = createHash("sha256").update(`nex-mock-persona:${seed}`).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,
    `8${h.slice(17, 20)}`,
    h.slice(20, 32),
  ].join("-");
}

/** @typedef {{
 *   id: string,
 *   handle: string,
 *   displayName: string,
 *   city: string,
 *   locale: string,
 *   sourceCrop: string,
 *   avatarFile: string,
 * }} Persona */

/** @type {ReadonlyArray<Persona>} */
export const PERSONAS = [
  { handle: "dewi",    displayName: "Dewi Anggraini",   city: "Jakarta",     sourceCrop: "diverse-se-asian/row1-col1.png" },
  { handle: "rizky",   displayName: "Rizky Pratama",    city: "Surabaya",    sourceCrop: "diverse-se-asian/row1-col2.png" },
  { handle: "nurul",   displayName: "Nurul Hidayah",    city: "Bandung",     sourceCrop: "diverse-se-asian/row1-col3.png" },
  { handle: "agus",    displayName: "Agus Wijaya",      city: "Semarang",    sourceCrop: "diverse-se-asian/row1-col4.png" },
  { handle: "siti",    displayName: "Siti Rahayu",      city: "Yogyakarta",  sourceCrop: "diverse-se-asian/row1-col5.png" },
  { handle: "dimas",   displayName: "Dimas Nugroho",    city: "Medan",       sourceCrop: "diverse-se-asian/row1-col6.png" },
  { handle: "bayu",    displayName: "Bayu Santoso",     city: "Denpasar",    sourceCrop: "diverse-se-asian/row2-col1.png" },
  { handle: "melati",  displayName: "Melati Kusuma",    city: "Jakarta",     sourceCrop: "diverse-se-asian/row2-col2.png" },
  { handle: "made",    displayName: "Made Wijaya",      city: "Ubud",        sourceCrop: "diverse-se-asian/row2-col3.png" },
  { handle: "putri",   displayName: "Putri Maharani",   city: "Malang",      sourceCrop: "diverse-se-asian/row2-col4.png" },
  { handle: "yudi",    displayName: "Yudi Hartono",     city: "Palembang",   sourceCrop: "diverse-se-asian/row2-col5.png" },
  { handle: "sari",    displayName: "Sari Permata",     city: "Makassar",    sourceCrop: "diverse-se-asian/row2-col6.png" },
  { handle: "fatimah", displayName: "Fatimah Zahra",    city: "Padang",      sourceCrop: "diverse-se-asian/row3-col1.png" },
  { handle: "hendra",  displayName: "Hendra Gunawan",   city: "Bogor",       sourceCrop: "diverse-se-asian/row3-col2.png" },
  { handle: "aulia",   displayName: "Aulia Rahma",      city: "Solo",        sourceCrop: "diverse-se-asian/row3-col3.png" },
  { handle: "rangga",  displayName: "Rangga Pradipta",  city: "Bekasi",      sourceCrop: "diverse-se-asian/row3-col4.png" },
  { handle: "indah",   displayName: "Indah Lestari",    city: "Tangerang",   sourceCrop: "diverse-se-asian/row3-col5.png" },
  { handle: "haikal",  displayName: "Haikal Firmansyah", city: "Depok",      sourceCrop: "diverse-se-asian/row3-col6.png" },
  { handle: "rahman",  displayName: "Rahman Saputra",   city: "Pekanbaru",   sourceCrop: "diverse-se-asian/row4-col1.png" },
  { handle: "kirana",  displayName: "Kirana Dewi",      city: "Jakarta",     sourceCrop: "diverse-se-asian/row4-col2.png" },
  { handle: "ketut",   displayName: "Ketut Suryawan",   city: "Denpasar",    sourceCrop: "diverse-se-asian/row4-col3.png" },
  { handle: "anisa",   displayName: "Anisa Fitria",     city: "Balikpapan",  sourceCrop: "diverse-se-asian/row4-col4.png" },
  { handle: "laila",   displayName: "Lailatul Wulandari", city: "Surabaya",  sourceCrop: "diverse-global/row2-col2.png" },
  { handle: "nabila",  displayName: "Nabila Permata",   city: "Jakarta",     sourceCrop: "diverse-global/row4-col4.png" },
].map((p, i) => ({
  ...p,
  id: deterministicUuid(p.handle),
  locale: "id",
  avatarFile: `${p.handle}.png`,
  // Owner-sealed `nex_account_handle_format` check constraint
  // requires `^nex-\d{5,}$`. We assign 50001..50024 for the first
  // seed batch · deterministic + never collides with real signups
  // because real-user handles live in a different numeric range
  // (reserved via `handle-reserved-names.ts`). The ALPHA `handle`
  // above stays as the human-friendly key for emails + filenames.
  nexHandle: `nex-${50001 + i}`,
}));

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  for (const p of PERSONAS) {
    console.log(`${p.id}  nex-${p.handle.padEnd(10)} "${p.displayName.padEnd(22)}"  ${p.city}  ${p.sourceCrop}`);
  }
  console.log(`total: ${PERSONAS.length}`);
}
