// src/lib/nex-native/mock-persona-presence.ts
//
// Owner directive 2026-10-26 · "mock profiles we need set that they
// are randomly online but 16 hours a day some sunday off · we need
// make it real looking so last online times appear where needed and
// shows they sleep and then online off for few hours".
//
// Pure, deterministic online-schedule generator for seeded mock
// personas. Zero DB · zero cron · same handle + same `now` → same
// output. Server + client safe (no node: imports).
//
// Schedule shape per persona (derived from a FNV-1a hash of the
// handle):
//   · wakeHour      · 5..9 (local hour the persona comes online)
//   · sundayOff     · ~1 in 3 personas take Sundays off entirely
//   · siestaStart   · 50% of personas take a 1-hour nap in the
//                     afternoon (hour wakeHour + 7)
// The awake window is a continuous 16 hours (wakeHour → wakeHour+16),
// with the siesta hour subtracted for those who take one. So most
// personas look like they're online in the morning, briefly go
// offline mid-afternoon, then come back until late evening.
//
// Edge rules honoured:
//   · If a persona has sundayOff and it is Sunday in the LOCAL
//     timezone (JS Date.getDay == 0), they are offline all day.
//     lastSeenAt = Saturday's bedtime.
//   · Timezone is the browser's local timezone when called in a
//     React component · the server renders with its own local time
//     during SSR. For a demo that's acceptable; the slight
//     SSR/client flicker on the online dot is a known trade-off.

/** Owner directive 2026-10-26 · aligned with the sealed contacts-
 *  profile convention (`_contact-row.tsx:38-40`): green=online ·
 *  orange=busy · dark red=offline (static dot). Busy = during the
 *  persona's siesta hour or the first/last 30 min of the awake
 *  window (ramp-up / wind-down). */
export type PresenceStatus = "online" | "busy" | "offline";

export interface PresenceState {
  readonly presence: PresenceStatus;
  /** Convenience · `presence === "online"`. Kept for existing
   *  call-sites that only need a boolean. */
  readonly isOnline: boolean;
  /** Timestamp of the most recent moment this persona was online.
   *  Equal to `now` when currently online. */
  readonly lastSeenAt: Date;
  /** Human-friendly "last seen X ago" string. `null` while online
   *  or busy (visibly available either way). */
  readonly lastSeenLabel: string | null;
  /** Internal schedule for debugging / UI display. */
  readonly schedule: {
    readonly wakeHour: number;
    readonly sleepHour: number;
    readonly sundayOff: boolean;
    readonly siestaHour: number | null;
  };
}

/** Fast FNV-1a 32-bit hash. Pure, no imports. */
function fnv1a(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function scheduleFor(handle: string): PresenceState["schedule"] {
  const h = fnv1a(`nex-mock-presence:v1:${handle}`);
  const wakeHour = 5 + (h % 5);              // 5..9
  const sleepHour = wakeHour + 16;           // same-day sleep hour (<24 always since 9+16=25 wraps)
  const sundayOff = ((h >>> 3) % 3) === 0;   // ~33% of personas
  const takesNap = ((h >>> 5) % 2) === 0;    // ~50% of personas
  const siestaHour = takesNap ? wakeHour + 7 : null;
  return { wakeHour, sleepHour, sundayOff, siestaHour };
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function withHour(now: Date, hour: number, dayOffset = 0): Date {
  const d = startOfToday(now);
  d.setDate(d.getDate() + dayOffset);
  // Normalise hours >= 24 by rolling the day forward.
  const addDays = Math.floor(hour / 24);
  const h = ((hour % 24) + 24) % 24;
  d.setDate(d.getDate() + addDays);
  d.setHours(h, 0, 0, 0);
  return d;
}

export function computePresence(
  handle: string,
  now: Date = new Date(),
): PresenceState {
  const schedule = scheduleFor(handle);
  const day = now.getDay(); // 0 = Sun
  const hour = now.getHours() + now.getMinutes() / 60;

  const isSundayOff = schedule.sundayOff && day === 0;
  const inAwakeWindow =
    hour >= schedule.wakeHour && hour < schedule.sleepHour;
  const inSiesta =
    schedule.siestaHour !== null &&
    hour >= schedule.siestaHour &&
    hour < schedule.siestaHour + 1;
  // Owner-aligned ramp · the first 30 min after waking and the last
  // 30 min before sleeping read as "busy" (just starting the day /
  // winding down). Keeps the online dot from flipping on the exact
  // instant someone wakes up · more natural rhythm.
  const inRampUp =
    inAwakeWindow && hour < schedule.wakeHour + 0.5;
  const inRampDown =
    inAwakeWindow && hour >= schedule.sleepHour - 0.5;

  let presence: PresenceStatus;
  if (isSundayOff || !inAwakeWindow) {
    presence = "offline";
  } else if (inSiesta || inRampUp || inRampDown) {
    presence = "busy";
  } else {
    presence = "online";
  }
  const isOnline = presence === "online";

  let lastSeenAt: Date;
  if (isOnline || presence === "busy") {
    lastSeenAt = now;
  } else if (isSundayOff) {
    // Last online = Saturday bedtime (yesterday)
    lastSeenAt = withHour(now, schedule.sleepHour, -1);
  } else if (inSiesta) {
    // Napping · last online = siesta start
    lastSeenAt = withHour(now, schedule.siestaHour as number);
  } else if (hour >= schedule.sleepHour) {
    // In bed for the night · last online = today's sleepHour
    lastSeenAt = withHour(now, schedule.sleepHour);
  } else {
    // Pre-wake · last online = yesterday's sleepHour
    lastSeenAt = withHour(now, schedule.sleepHour, -1);
  }

  let lastSeenLabel: string | null = null;
  if (presence === "offline") {
    const diffMs = Math.max(0, now.getTime() - lastSeenAt.getTime());
    const minutes = Math.floor(diffMs / 60_000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) lastSeenLabel = `last seen ${days}d ago`;
    else if (hours > 0) lastSeenLabel = `last seen ${hours}h ago`;
    else if (minutes > 0) lastSeenLabel = `last seen ${minutes}m ago`;
    else lastSeenLabel = `last seen just now`;
  }

  return { presence, isOnline, lastSeenAt, lastSeenLabel, schedule };
}
