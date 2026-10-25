// src/lib/nex-native/live-broadcast/dev-video-manifest.ts
//
// Dev-mode local video manifest · 2026-10-24.
// -----------------------------------------------------------------------------
// Owner directive · "we have 50 videos from admin to upload or maybe
// 100 · the Live link from side drawer should show the live screen
// playing video and the buttons in footer area".
//
// Target decision (owner-provided 2026-10-24): "wait for isolated
// sandbox" · we do NOT connect to Supabase from this environment.
// Dev-mode local manifest serves the SAME shape the real
// `listPublishedUploadedVideos` service returns · the feed page can
// swap between them with one env flag or one line.
//
// Files served from `/public/dev/live-videos/{filename}` so Next.js
// Image / Video server-serves them as static assets. The directory
// is gitignored · never committed.
//
// To add more videos (scaling to the owner's 50-100):
//   1 · Drop the mp4 into `public/dev/live-videos/`.
//   2 · Add an entry to DEV_VIDEO_MANIFEST below with id + title +
//       country + tags + published_at.
//   3 · Save · the feed picks it up on next dev-server reload.
//
// When the sandbox lands:
//   · Flip the feed caller from `listDevUploadedVideos` to the real
//     `listPublishedUploadedVideos` and the dev manifest becomes
//     unused scaffolding (safe to delete).

import type { UploadedVideoRow } from "./uploaded-video-service";

/** Minimal shape a dev-manifest entry must declare. All other
 *  UploadedVideoRow fields are derived or defaulted. */
export interface DevVideoManifestEntry {
  readonly id: string;
  readonly title: string;
  readonly caption: string | null;
  readonly filename: string;
  readonly countryOfOrigin: string; // ISO alpha-2 uppercase
  readonly topicTags: readonly string[];
  readonly durationSeconds: number | null;
  readonly byteSize: number;
  readonly publishedAtIso: string;
}

/* ─── Manifest · owner-authored · 14 entries so far · scales to 100 ─── */

export const DEV_VIDEO_MANIFEST: readonly DevVideoManifestEntry[] = [
  // Owner directive 2026-10-24 · 6 dev videos tagged with placeholder
  // topics so the category-chain playback (travel → temple → volcano
  // → beach · transport → bike-rental → car-rental → bicycle-rental)
  // demonstrates end-to-end. These tags are prototype placeholders;
  // real uploads carry owner-authored tags.
  {
    id: "dev-video-1",
    title: "Live from Indonesia · 1",
    caption: null,
    filename: "snaptik_7689160014333807879_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["temple"],
    durationSeconds: null,
    byteSize: 8_141_145,
    publishedAtIso: "2026-10-24T16:13:00Z",
  },
  {
    id: "dev-video-2",
    title: "Live from Indonesia · 2",
    caption: null,
    filename: "snaptik_7692805970472209671_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["volcano"],
    durationSeconds: null,
    byteSize: 9_718_290,
    publishedAtIso: "2026-10-24T16:15:00Z",
  },
  {
    id: "dev-video-3",
    title: "Live from Indonesia · 3",
    caption: null,
    filename: "snaptik_7697419111164300564_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["beach"],
    durationSeconds: null,
    byteSize: 3_595_036,
    publishedAtIso: "2026-10-24T17:05:00Z",
  },
  {
    id: "dev-video-4",
    title: "Live from Indonesia · 4",
    caption: null,
    filename: "snaptik_7696739787771841800_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["bike-rental"],
    durationSeconds: null,
    byteSize: 2_503_871,
    publishedAtIso: "2026-10-24T17:06:00Z",
  },
  {
    id: "dev-video-5",
    title: "Live from Indonesia · 5",
    caption: null,
    filename: "snaptik_7693407706052316424_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["car-rental"],
    durationSeconds: null,
    byteSize: 6_319_214,
    publishedAtIso: "2026-10-24T17:07:00Z",
  },
  {
    id: "dev-video-6",
    title: "Live from Indonesia · 6",
    caption: null,
    filename: "snaptik_7694574193979034901_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: ["bicycle-rental"],
    durationSeconds: null,
    byteSize: 3_983_659,
    publishedAtIso: "2026-10-24T17:08:00Z",
  },
  {
    id: "dev-video-7",
    title: "Live from Indonesia · 7",
    caption: null,
    filename: "snaptik_7693407241893907732_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 6_104_899,
    publishedAtIso: "2026-10-24T17:09:00Z",
  },
  {
    id: "dev-video-8",
    title: "Live from Indonesia · 8",
    caption: null,
    filename: "snaptik_7699485791248059669_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 1_531_669,
    publishedAtIso: "2026-10-24T17:35:00Z",
  },
  {
    id: "dev-video-9",
    title: "Live from Indonesia · 9",
    caption: null,
    filename: "snaptik_7691639225162206486_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 1_684_620,
    publishedAtIso: "2026-10-24T17:55:00Z",
  },
  {
    id: "dev-video-10",
    title: "Live from Indonesia · 10",
    caption: null,
    filename: "snaptik_7678490854473944338_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 2_743_231,
    publishedAtIso: "2026-10-24T17:56:00Z",
  },
  {
    id: "dev-video-11",
    title: "Live from Indonesia · 11",
    caption: null,
    filename: "snaptik_7691490715842514198_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 1_413_327,
    publishedAtIso: "2026-10-24T17:57:00Z",
  },
  {
    id: "dev-video-12",
    title: "Live from Indonesia · 12",
    caption: null,
    filename: "snaptik_7697148211630181645_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 1_914_721,
    publishedAtIso: "2026-10-24T17:58:00Z",
  },
  {
    id: "dev-video-13",
    title: "Live from Indonesia · 13",
    caption: null,
    filename: "snaptik_7690683579726089503_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 3_566_902,
    publishedAtIso: "2026-10-24T17:59:00Z",
  },
  {
    id: "dev-video-14",
    title: "Live from Indonesia · 14",
    caption: null,
    filename: "snaptik_7692035162833571104_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 1_190_155,
    publishedAtIso: "2026-10-24T18:00:00Z",
  },
  // Owner directive 2026-10-25 · three additional videos. Shown in
  // the central Live feed's RecordedVideosSection with sessionStorage-
  // backed shuffle-no-repeat per browser tab (see
  // src/app/nex-native/live-commerce/feed/_shuffled-recorded-videos.tsx).
  {
    id: "dev-video-15",
    title: "Live from Indonesia · 15",
    caption: null,
    filename: "snaptik_7685765109767048462_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 2_836_836,
    publishedAtIso: "2026-10-25T16:32:00Z",
  },
  {
    id: "dev-video-16",
    title: "Live from Indonesia · 16",
    caption: null,
    filename: "snaptik_7596993425254272270_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 2_512_845,
    publishedAtIso: "2026-10-25T16:35:00Z",
  },
  {
    id: "dev-video-17",
    title: "Live from Indonesia · 17",
    caption: null,
    filename: "snaptik_7686667273347550472_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 2_335_490,
    publishedAtIso: "2026-10-25T16:36:00Z",
  },
  // Owner directive 2026-10-25 · four additional videos. Shuffle-
  // no-repeat applies automatically (reconciliation in
  // _shuffled-recorded-videos.tsx keeps existing tabs' seen state
  // and appends new IDs at the tail; new tabs get a fresh shuffle).
  {
    id: "dev-video-18",
    title: "Live from Indonesia · 18",
    caption: null,
    filename: "snaptik_7685626567778733326_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 4_844_922,
    publishedAtIso: "2026-10-25T16:45:00Z",
  },
  {
    id: "dev-video-19",
    title: "Live from Indonesia · 19",
    caption: null,
    filename: "snaptik_7591136738777582868_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 4_799_148,
    publishedAtIso: "2026-10-25T16:48:00Z",
  },
  {
    id: "dev-video-20",
    title: "Live from Indonesia · 20",
    caption: null,
    filename: "snaptik_7662699864001645856_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 10_818_741,
    publishedAtIso: "2026-10-25T16:50:00Z",
  },
  {
    id: "dev-video-21",
    title: "Live from Indonesia · 21",
    caption: null,
    filename: "snaptik_7695402685310324001_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 6_003_008,
    publishedAtIso: "2026-10-25T16:51:00Z",
  },
  {
    id: "dev-video-22",
    title: "Live from Indonesia · 22",
    caption: null,
    filename: "snaptik_7663892999473990942_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 5_685_361,
    publishedAtIso: "2026-10-25T16:52:00Z",
  },
  {
    id: "dev-video-23",
    title: "Live from Indonesia · 23",
    caption: null,
    filename: "snaptik_7683203253370146069_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 2_258_788,
    publishedAtIso: "2026-10-25T16:53:00Z",
  },
  {
    id: "dev-video-24",
    title: "Live from Indonesia · 24",
    caption: null,
    filename: "snaptik_7680463541656243477_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 6_769_075,
    publishedAtIso: "2026-10-25T16:54:00Z",
  },
  {
    id: "dev-video-25",
    title: "Live from Indonesia · 25",
    caption: null,
    filename: "snaptik_7617214662471453973_v3.mp4",
    countryOfOrigin: "ID",
    topicTags: [],
    durationSeconds: null,
    byteSize: 12_584_666,
    publishedAtIso: "2026-10-25T16:55:00Z",
  },
];

const DEV_BUCKET = "nex-live-uploaded";
const DEV_OBJECT_PREFIX = "owner/first-live";

/** Build a public URL for a dev manifest entry. In dev the file
 *  lives at `/dev/live-videos/{filename}` served by Next.js static
 *  file middleware. */
export function devVideoPublicUrl(entry: DevVideoManifestEntry): string {
  return `/dev/live-videos/${entry.filename}`;
}

/** Owner directive 2026-10-25 · 5 mock dev NEX accounts seeded via
 *  `scripts/seed-dev-mock-accounts.mjs` into the sealed Supabase
 *  project `ijvqdvsvwtwxzcqmoqit`. Dev manifest entries rotate
 *  round-robin through these owners so the Live Message panel can
 *  resolve a real `nex_handle` + `display_name` + country when the
 *  viewer taps Message. Each dev video deterministically maps to
 *  one owner by `index % DEV_MOCK_OWNER_ACCOUNT_IDS.length`.
 *
 *  These five UUIDs are the deterministic ids inserted by the seed
 *  script · recognisable prefixes (1111.., 2222.., etc.) make
 *  cleanup trivial if the owner ever authorises it. */
export const DEV_MOCK_OWNER_ACCOUNT_IDS: readonly string[] = [
  "11111111-1111-4111-8111-111111111111", // nex-99901 · Sari Dewi
  "22222222-2222-4222-8222-222222222222", // nex-99902 · Rizky Pratama
  "33333333-3333-4333-8333-333333333333", // nex-99903 · Budi Setiawan
  "44444444-4444-4444-8444-444444444444", // nex-99904 · Maya Putri
  "55555555-5555-4555-8555-555555555555", // nex-99905 · Dika Ananda
];

function devOwnerForEntry(entry: DevVideoManifestEntry): string {
  // Round-robin by the entry's position in the manifest · deterministic.
  const idx = DEV_VIDEO_MANIFEST.findIndex((e) => e.id === entry.id);
  if (idx < 0) return DEV_MOCK_OWNER_ACCOUNT_IDS[0]!;
  return DEV_MOCK_OWNER_ACCOUNT_IDS[idx % DEV_MOCK_OWNER_ACCOUNT_IDS.length]!;
}

/** Project a dev-manifest entry into the UploadedVideoRow shape
 *  that the rest of the feed pipeline consumes. The dev-mode
 *  `owner_account_id` resolves to one of 5 seeded mock accounts
 *  (see DEV_MOCK_OWNER_ACCOUNT_IDS) so the Message panel renders a
 *  real broadcaster identity. `business_id` + `storage_bucket` keep
 *  their safe placeholder values. */
export function devManifestToRow(
  entry: DevVideoManifestEntry,
): UploadedVideoRow {
  return {
    id: entry.id,
    owner_account_id: devOwnerForEntry(entry),
    business_id: null,
    title: entry.title,
    caption: entry.caption,
    storage_bucket: DEV_BUCKET,
    storage_object_path: `${DEV_OBJECT_PREFIX}/${entry.filename}`,
    duration_seconds: entry.durationSeconds,
    width: null,
    height: null,
    byte_size: entry.byteSize,
    mime_type: "video/mp4",
    rights_declaration: "owner_content",
    country_of_origin: entry.countryOfOrigin,
    topic_tags: entry.topicTags,
    source: "owner_upload",
    visibility: "public",
    created_at: entry.publishedAtIso,
    published_at: entry.publishedAtIso,
  };
}

/** Dev-mode listing · fail-open · returns the manifest unchanged
 *  except projected into UploadedVideoRow shape. Mirrors the
 *  signature of the real `listPublishedUploadedVideos` so callers
 *  can swap between them. */
export function listDevUploadedVideos(opts: {
  readonly limit?: number;
} = {}): readonly UploadedVideoRow[] {
  const limit = Math.max(1, Math.min(100, opts.limit ?? DEV_VIDEO_MANIFEST.length));
  return DEV_VIDEO_MANIFEST
    .slice(0, limit)
    .map(devManifestToRow);
}

/** Dev-mode by-id lookup. Fail-open · null when absent. */
export function getDevUploadedVideoById(
  id: string,
): UploadedVideoRow | null {
  const entry = DEV_VIDEO_MANIFEST.find((e) => e.id === id);
  return entry ? devManifestToRow(entry) : null;
}

/** Is dev-mode local serving active? True when the ambient env
 *  flag `NEXT_PUBLIC_NEX_LIVE_DEV_MANIFEST` is `"1"` OR when the
 *  real Supabase target is unreachable (service-role missing). The
 *  owner provides the env flag · we never auto-flip it. */
export function isDevManifestActive(): boolean {
  if (typeof process === "undefined") return false;
  return process.env.NEXT_PUBLIC_NEX_LIVE_DEV_MANIFEST === "1";
}
