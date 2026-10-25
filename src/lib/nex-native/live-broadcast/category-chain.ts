// src/lib/nex-native/live-broadcast/category-chain.ts
//
// NEX Live · "related chain" playback for category discovery.
// -----------------------------------------------------------------------------
// Owner directive 2026-10-24:
//   "the live search category will play that category of video or
//    banner images and when completed will move to next category that
//    would be connected close to it · example · user selects temple
//    after viewing all they will see the next flow maybe for volcano
//    and if that finished we show next close to that beaches · and
//    same run if user looking for bike rental maybe after will show
//    car rental then bicycle rental etc"
//
// Shape:
//   · Each top-level grid category (one of the 12 tiles) has an
//     ordered list of SUB-TOPIC tags.
//   · Playback queue for a tapped category = concatenate all videos
//     tagged with the first topic, then the second, then the third …
//     until exhausted. Videos that don't carry any of the chain's
//     topics are excluded.
//   · The viewer's existing swipe-next uses the queue as the sibling
//     list, so the "advance to next related topic" is implicit in the
//     queue ordering · no new navigation logic is needed in the
//     viewer client.
//
// Non-claims:
//   · This file is UI-only placeholder data. The sealed Discovery
//     taxonomy from the migration-224 proposal is still pending owner
//     approval; when it lands, this file should import that catalogue
//     instead of carrying its own mapping.
//   · Topic tag strings here must match whatever upload authors on
//     videos. The dev manifest carries a small sample.

export interface CategoryChain {
  readonly slug: string;        // "travel"
  readonly label: string;       // "Travel"
  readonly topics: readonly string[]; // ordered chain of sub-topics
}

/** 12 chains · one per top-level grid tile. The topic order inside
 *  each chain is the "related sequence" · tap `Travel` and you flow
 *  through temples, then volcanoes, then beaches, etc. */
export const CATEGORY_CHAINS: ReadonlyMap<string, CategoryChain> = new Map([
  ["travel",     { slug: "travel",     label: "Travel",
    topics: ["temple", "volcano", "beach", "waterfall", "mountain", "island", "city"] }],
  ["transport",  { slug: "transport",  label: "Transport",
    topics: ["bike-rental", "car-rental", "bicycle-rental", "scooter-rental", "taxi", "ride-share"] }],
  ["food-drink", { slug: "food-drink", label: "Food & Drink",
    topics: ["restaurant", "cafe", "street-food", "dessert", "bakery", "coffee"] }],
  ["fashion",    { slug: "fashion",    label: "Fashion & Beauty",
    topics: ["clothing", "makeup", "salon", "jewelry"] }],
  ["stay",       { slug: "stay",       label: "Stay",
    topics: ["hotel", "villa", "homestay", "hostel", "resort"] }],
  ["services",   { slug: "services",   label: "Local Services",
    topics: ["repair", "cleaning", "mechanic", "laundry"] }],
  ["products",   { slug: "products",   label: "Products",
    topics: ["gadget", "retail", "crafts", "home-goods"] }],
  ["events",     { slug: "events",     label: "Events",
    topics: ["festival", "concert", "ceremony", "exhibition"] }],
  ["deals",      { slug: "deals",      label: "Deals",
    topics: ["discount", "promo", "flash-sale"] }],
  ["creators",   { slug: "creators",   label: "Creators",
    topics: ["musician", "dj", "dancer", "artist"] }],
  ["art",        { slug: "art",        label: "Art",
    topics: ["craft", "painting", "sculpture", "textile"] }],
  ["sports",     { slug: "sports",     label: "Sports",
    topics: ["fitness", "workout", "surf", "cycling", "football"] }],
]);

/** Lookup helper. Returns null for unknown slugs. */
export function getCategoryChain(slug: string): CategoryChain | null {
  return CATEGORY_CHAINS.get(slug) ?? null;
}

/** Minimal video shape the queue builder needs. */
export interface CategoryQueueVideoLike {
  readonly id: string;
  readonly topic_tags: readonly string[];
}

/** Build a FLAT ordered video-id queue for a given chain.
 *
 *   Grouping: all videos whose topic_tags include topic #1, in the
 *   order they appear in `videos` · then topic #2 · then #3 · etc.
 *
 *   A video appears AT MOST ONCE in the queue (dedup across topics).
 *   Videos with no overlap with any chain topic are excluded.
 *
 *   Tag matching is case-insensitive. */
export function buildCategoryQueue(
  chain: CategoryChain,
  videos: readonly CategoryQueueVideoLike[],
): string[] {
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const topic of chain.topics) {
    const target = topic.toLowerCase();
    for (const v of videos) {
      if (seen.has(v.id)) continue;
      if (v.topic_tags.some((t) => t.toLowerCase() === target)) {
        queue.push(v.id);
        seen.add(v.id);
      }
    }
  }
  return queue;
}

/** Resolve "which topic does this video belong to within THIS chain?"
 *  so the viewer can display an honest "You're watching · {topic}"
 *  label. Returns the FIRST chain topic that matches a video tag.
 *  Null when the video has no overlap. */
export function resolveCurrentTopic(
  chain: CategoryChain,
  video: CategoryQueueVideoLike,
): string | null {
  for (const topic of chain.topics) {
    const target = topic.toLowerCase();
    if (video.topic_tags.some((t) => t.toLowerCase() === target)) {
      return topic;
    }
  }
  return null;
}

/** Pretty-print a kebab-case topic as "Bike Rental", "Car Rental", etc. */
export function formatTopicLabel(topic: string): string {
  return topic
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
