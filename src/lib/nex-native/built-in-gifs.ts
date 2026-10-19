// src/lib/nex-native/built-in-gifs.ts
//
// Built-in GIF library · owner-authorised 2026-10-19.
// -----------------------------------------------------------------------------
// The complete NEX GIFs library · fully offline · served from
// /public/nex-chat/gif/. The chat picker's GIFS tab reads this list
// directly · there is no third-party network path. Each entry carries
// its real pixel dimensions (probed from the source file) so the
// picker and chat bubble can lay out at correct aspect ratio without
// a client-side probe.
//
// Search behaviour · each `labels` entry is a lowercase token the
// picker's search box matches against (substring match). Keep the
// vocabulary human: "flex" + "muscle" + "gym" instead of jargon.

export interface BuiltInGif {
  readonly id: string;         // "builtin:<slug>" to not clash with Giphy ids
  readonly slug: string;       // filename slug (no extension)
  readonly url: string;        // path under /public/
  readonly width: number;
  readonly height: number;
  readonly aspectRatio: number;
  readonly title: string;      // human title (shown as tooltip)
  readonly labels: readonly string[]; // lowercase search tokens
}

function entry(
  slug: string,
  width: number,
  height: number,
  title: string,
  labels: readonly string[],
): BuiltInGif {
  return {
    id: `builtin:${slug}`,
    slug,
    url: `/nex-chat/gif/${slug}.gif`,
    width,
    height,
    aspectRatio: width / height,
    title,
    labels,
  };
}

export const BUILT_IN_GIFS: readonly BuiltInGif[] = [
  entry(
    "steve-harvey-cracks-me-up",
    400,
    400,
    "Steve Harvey · cracks me up",
    ["laugh", "laughing", "lol", "funny", "cracks me up", "steve harvey"],
  ),
  entry(
    "stoned-fox-no-way-wow",
    480,
    414,
    "Stoned Fox · no way wow",
    ["wow", "no way", "shocked", "surprise", "fox", "stoned fox"],
  ),
  entry(
    "megan-lara-wave",
    384,
    480,
    "Megan Lara · wave",
    ["wave", "hi", "hello", "hey", "greeting", "megan lara"],
  ),
  entry(
    "emoji-expression",
    480,
    480,
    "Emoji expression",
    ["emoji", "expression", "happy", "smile", "face"],
  ),
  entry(
    "gymshark-bodybuilding",
    480,
    480,
    "Gymshark · bodybuilding",
    ["gym", "muscle", "flex", "workout", "bodybuilding", "gymshark", "athlete"],
  ),
  entry(
    "gymshark-gym-flex",
    480,
    480,
    "Gymshark · gym flex",
    ["gym", "flex", "muscle", "workout", "gymshark"],
  ),
  entry(
    "work-out-dog",
    480,
    480,
    "Work out dog",
    ["dog", "workout", "gym", "funny", "pet", "exercise"],
  ),
  entry(
    "despicable-me-dj",
    420,
    237,
    "Despicable Me · DJ",
    ["dj", "music", "dance", "minion", "despicable me", "party"],
  ),
  entry(
    "minions-cartoons",
    480,
    270,
    "Minions · cartoons",
    ["minion", "minions", "cartoon", "funny", "despicable me"],
  ),
  entry(
    "minions-kiss",
    480,
    270,
    "Minions · kiss",
    ["kiss", "love", "minion", "minions", "despicable me", "heart"],
  ),
  entry(
    "kisses-feel",
    250,
    280,
    "Kisses · feel",
    ["kiss", "kisses", "love", "feel", "heart"],
  ),
  entry(
    "peace-dont-talk-to-me",
    360,
    480,
    "Peace · don't talk to me",
    ["peace", "dont talk to me", "no", "leave me alone", "annoyed", "bye"],
  ),
  entry(
    "fight-ufc",
    410,
    480,
    "Fight · UFC",
    ["fight", "ufc", "punch", "mma", "angry"],
  ),
  entry(
    "sparring-paolo-costa-ufc",
    480,
    268,
    "Sparring · Paolo Costa · UFC",
    ["spar", "sparring", "fight", "ufc", "mma", "paolo costa", "boxing"],
  ),
  entry(
    "dog-no",
    500,
    500,
    "Dog · no",
    ["dog", "no", "nope", "funny", "pet", "head shake"],
  ),
  entry(
    "suspicious",
    342,
    480,
    "Suspicious",
    ["suspicious", "sus", "side eye", "doubt", "really"],
  ),
  entry(
    "suspicious-tyler-james-williams",
    480,
    480,
    "Suspicious look",
    ["suspicious", "sus", "side eye", "doubt", "really", "stare"],
  ),
  entry(
    "party-drink-bedlam-vodka",
    480,
    300,
    "Party drink",
    ["party", "drink", "vodka", "cheers", "celebrate", "bar"],
  ),
  entry(
    "holiday-cheers-absolut",
    480,
    270,
    "Holiday cheers",
    ["cheers", "holiday", "drink", "vodka", "toast", "celebrate"],
  ),
  entry(
    "drinks-cocktails-absolut",
    480,
    480,
    "Cocktails",
    ["drink", "drinks", "cocktail", "cocktails", "bar", "party", "vodka"],
  ),
  entry(
    "vodka-love",
    480,
    480,
    "Vodka love",
    ["vodka", "love", "drink", "cheers", "bar"],
  ),
  entry(
    "misc-gif-1",
    480,
    480,
    "Reaction",
    ["reaction", "funny", "mood"],
  ),
  entry(
    "misc-gif-2",
    480,
    272,
    "Reaction wide",
    ["reaction", "funny", "mood"],
  ),
  entry(
    "whiskey-drinking-buzzfeed",
    480,
    270,
    "Whiskey drinking",
    ["whiskey", "drink", "bar", "cheers", "shot"],
  ),
  entry(
    "stephen-king-halloween",
    480,
    480,
    "Stephen King · Halloween",
    ["halloween", "spooky", "scary", "horror", "stephen king", "whiskey"],
  ),
  entry(
    "night-out-drinking",
    480,
    270,
    "Night out drinking",
    ["night out", "drink", "drinking", "party", "bar", "cheers"],
  ),
  entry(
    "e-girls-dance-1",
    270,
    480,
    "Girls · dance",
    ["dance", "girl", "girls", "music", "party"],
  ),
  entry(
    "e-girls-dance-2",
    270,
    480,
    "Girls · dance 2",
    ["dance", "girl", "girls", "music", "party"],
  ),
  entry(
    "girl-asian-dance",
    270,
    480,
    "Girl · dance",
    ["dance", "girl", "cute", "k-pop", "j-pop", "music"],
  ),
  entry(
    "hungry-fun-zoo",
    384,
    480,
    "Hungry · zoo",
    ["hungry", "food", "zoo", "animal", "funny", "eat"],
  ),
  entry(
    "giraffe",
    384,
    480,
    "Giraffe",
    ["giraffe", "animal", "zoo", "tall", "funny"],
  ),
  entry(
    "ice-cream-cats",
    270,
    480,
    "Ice cream · cats",
    ["cat", "cats", "ice cream", "cute", "food", "pet", "kitten"],
  ),
  entry(
    "ice-cream-cat",
    320,
    369,
    "Ice cream · cat",
    ["cat", "ice cream", "cute", "food", "pet", "kitten"],
  ),
];

/** Case-insensitive substring match against labels + title. Returns a
 *  stable-ordered copy (preserves registry order). Empty query returns
 *  the full set so trending-style grids can prepend built-ins. */
export function searchBuiltInGifs(query: string): BuiltInGif[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [...BUILT_IN_GIFS];
  return BUILT_IN_GIFS.filter((g) => {
    if (g.title.toLowerCase().includes(q)) return true;
    return g.labels.some((label) => label.includes(q));
  });
}
