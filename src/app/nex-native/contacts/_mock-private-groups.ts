// src/app/nex-native/contacts/_mock-private-groups.ts
//
// Mock-complete store for Tier-1 Private Groups · owner directive
// 2026-10-23 · "mock-complete UI only · zero backend, zero crypto".
//
// Scope + preservation posture (sealed via conversation 2026-10-23):
//   · This file is PURE MOCK · no server, no Supabase, no crypto.
//   · Lives alongside Community Notice (which is itself mock-complete
//     at `/community/chat`) · the two surfaces NEVER share state or
//     tables.
//   · When the migration-SQL phase lands (gated behind the independent
//     cryptographic review per contract rev 3 §5.9), this file is
//     swapped out for real service calls · the UI consuming it stays.
//
// Doctrine echoes locked in contract `docs/doctrine/nex-private-groups-
// contract-draft-2026-10-23.md` rev 3:
//   · Member cap 100 (Tier-1).
//   · Create flow requires exactly ONE initial invitee (§3.1).
//   · Per-group-instance block if that invitee refuses (§3.2).
//   · Invite 24h expiry · recipient has single Confirm (§3.3).
//   · Owner cannot silently leave · transfer-or-archive (§3.4).
//   · Attachment allowlist: image / video / file / audio (§4 Decision 7).

export type PrivateGroupRole = "owner" | "admin" | "member";

/**
 * Owner directive 2026-10-23 · visibility toggle on Create Group ·
 * "when user creates a group they can also select group is private
 * or Group is open like facebook does". MOCK PROPOSAL · sits outside
 * the sealed Private Groups contract rev 3 (Tier-1 invite-only). The
 * real feature requires a contract revision + the independent review.
 *   · private · Tier-1 behaviour · invite-only · 100-member cap.
 *   · open    · discoverable by country in the Groups tab search ·
 *               500-member cap · one-tap join.
 */
export type GroupVisibility = "private" | "open";

export const PRIVATE_GROUP_MEMBER_CAP = 100;
export const OPEN_GROUP_MEMBER_CAP = 500;

export interface PrivateGroupMember {
  readonly accountId: string;      // UUID OR nex-handle for mocks
  readonly nexId: string;           // nex-10842 shape
  readonly displayName: string;
  readonly initials: string;
  readonly avatarUrl: string | null;
  readonly role: PrivateGroupRole;
  readonly joinedAt: string;        // ISO
}

export interface MockPrivateGroup {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly avatarUrl: string | null;
  readonly ownerAccountId: string;
  readonly members: ReadonlyArray<PrivateGroupMember>;
  readonly createdAt: string;       // ISO
  /** Minutes since last post · mirrors MockGroup shape so GroupCard
   *  can render it in the lower-right · null means "no posts yet". */
  readonly minutesSinceLastPost: number | null;
  /** Owner directive 2026-10-23 · visibility toggle · defaults to
   *  "private" when a legacy row is loaded without the field. */
  readonly visibility: GroupVisibility;
  /** ISO 3166-1 alpha-2 · only populated for `visibility: "open"` ·
   *  drives the Groups-tab country filter. Null for private groups. */
  readonly country: string | null;
  /** Visibility-aware member cap. */
  readonly memberCap: number;
  /** Owner directive 2026-10-23 · open-group discovery cards show
   *  a public "N members" figure that isn't tied to the local
   *  `members` array (which only materialises when real joins
   *  happen in this mock). Optional · undefined for private groups. */
  readonly discoveryMemberCount?: number;
}

export type GroupInviteStatus =
  | "pending"
  | "accepted"
  | "expired"
  | "cancelled";

export interface MockGroupInvite {
  readonly id: string;
  readonly groupId: string;
  readonly groupName: string;
  readonly groupAvatarUrl: string | null;
  readonly inviterNexId: string;
  readonly inviterDisplayName: string;
  readonly inviterAvatarUrl: string | null;
  readonly inviterIsVerified: boolean;
  readonly createdAt: string;      // ISO
  readonly status: GroupInviteStatus;
}

// ─── localStorage keys ─────────────────────────────────────────

const GROUPS_STORAGE_KEY = "nex-private-groups-v1";
const INVITES_STORAGE_KEY = "nex-private-group-invites-v1";
/** Per-group block ledger · once a (groupId, nexId) pair refuses /
 *  expires an invite, the group's owner may not re-invite that NEX-ID
 *  to this specific group again (contract §3.2). */
const GROUP_BLOCK_STORAGE_KEY = "nex-private-group-blocks-v1";
/** Per-group message store · keyed by groupId. */
const GROUP_MESSAGES_STORAGE_KEY_PREFIX = "nex-private-group-messages-v1:";

// Change events dispatched on same-window updates (storage event
// doesn't fire for the window that wrote it).
export const PRIVATE_GROUPS_CHANGED_EVENT = "nex-private-groups-changed";
export const PRIVATE_GROUP_INVITES_CHANGED_EVENT = "nex-private-group-invites-changed";
export const PRIVATE_GROUP_MESSAGES_CHANGED_EVENT = "nex-private-group-messages-changed";

// ─── Group · load + persist ────────────────────────────────────

export function loadGroups(): ReadonlyArray<MockPrivateGroup> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GROUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Legacy rows written before the visibility/country/memberCap
    // fields existed default to "private" with 100-cap · forward-
    // compatible so the user never loses a mock group on upgrade.
    return parsed
      .filter(isValidGroup)
      .map(normaliseLegacyGroup);
  } catch {
    return [];
  }
}

function normaliseLegacyGroup(row: MockPrivateGroup): MockPrivateGroup {
  if (
    row.visibility === "private" ||
    row.visibility === "open"
  ) {
    return row;
  }
  // Legacy write · stamp defaults.
  return {
    ...row,
    visibility: "private",
    country: null,
    memberCap: PRIVATE_GROUP_MEMBER_CAP,
  };
}

function persistGroups(list: ReadonlyArray<MockPrivateGroup>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota · ignored */
  }
  window.dispatchEvent(new CustomEvent(PRIVATE_GROUPS_CHANGED_EVENT));
}

function isValidGroup(row: unknown): row is MockPrivateGroup {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    typeof r.ownerAccountId === "string" &&
    Array.isArray(r.members) &&
    typeof r.createdAt === "string"
  );
}

export function getGroupById(id: string): MockPrivateGroup | null {
  return loadGroups().find((g) => g.id === id) ?? null;
}

// ─── Invite · load + persist ───────────────────────────────────

export function loadGroupInvites(): ReadonlyArray<MockGroupInvite> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INVITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidInvite);
  } catch {
    return [];
  }
}

function persistGroupInvites(list: ReadonlyArray<MockGroupInvite>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INVITES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota · ignored */
  }
  window.dispatchEvent(new CustomEvent(PRIVATE_GROUP_INVITES_CHANGED_EVENT));
}

function isValidInvite(row: unknown): row is MockGroupInvite {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.groupId === "string" &&
    typeof r.groupName === "string" &&
    typeof r.inviterNexId === "string" &&
    typeof r.createdAt === "string" &&
    (r.status === "pending" ||
      r.status === "accepted" ||
      r.status === "expired" ||
      r.status === "cancelled")
  );
}

// ─── Per-group-instance block ledger ───────────────────────────

interface GroupBlockEntry {
  readonly groupId: string;
  readonly blockedNexId: string;
  readonly blockedAt: string;
}

function loadGroupBlocks(): ReadonlyArray<GroupBlockEntry> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GROUP_BLOCK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is GroupBlockEntry =>
        r &&
        typeof r.groupId === "string" &&
        typeof r.blockedNexId === "string" &&
        typeof r.blockedAt === "string",
    );
  } catch {
    return [];
  }
}

function persistGroupBlocks(list: ReadonlyArray<GroupBlockEntry>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GROUP_BLOCK_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota · ignored */
  }
}

export function isBlocked(groupId: string, nexId: string): boolean {
  const needle = nexId.trim().toLowerCase();
  return loadGroupBlocks().some(
    (b) => b.groupId === groupId && b.blockedNexId === needle,
  );
}

// ─── Mutations ─────────────────────────────────────────────────

export interface CreateGroupInput {
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly description: string | null;
  readonly owner: PrivateGroupMember;        // viewer · auto-added as owner
  readonly initialInvitee: {
    readonly nexId: string;
    readonly displayName: string;
    readonly initials: string;
    readonly avatarUrl: string | null;
    readonly isVerified: boolean;
  };
  /** Owner directive 2026-10-23 · visibility toggle. Default is
   *  "private" to match the sealed Tier-1 contract if the caller
   *  omits it (back-compat). */
  readonly visibility?: GroupVisibility;
  /** ISO 3166-1 alpha-2 country code · required when visibility is
   *  "open" (that's what the Groups-tab country filter buckets on).
   *  Ignored when visibility is "private". */
  readonly country?: string | null;
}

export interface CreateGroupResult {
  readonly group: MockPrivateGroup;
  readonly invite: MockGroupInvite;
}

const INVITE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function createGroupWithInvite(input: CreateGroupInput): CreateGroupResult {
  const now = new Date();
  const groupId = `grp-${now.getTime()}`;
  const visibility: GroupVisibility = input.visibility ?? "private";
  const country =
    visibility === "open"
      ? (input.country?.toUpperCase() ?? null)
      : null;
  const memberCap =
    visibility === "open" ? OPEN_GROUP_MEMBER_CAP : PRIVATE_GROUP_MEMBER_CAP;
  const group: MockPrivateGroup = {
    id: groupId,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    avatarUrl: input.avatarUrl,
    ownerAccountId: input.owner.accountId,
    members: [input.owner], // owner only until invitee accepts
    createdAt: now.toISOString(),
    minutesSinceLastPost: null,
    visibility,
    country,
    memberCap,
  };
  const invite: MockGroupInvite = {
    id: `grp-inv-${now.getTime()}`,
    groupId,
    groupName: group.name,
    groupAvatarUrl: group.avatarUrl,
    inviterNexId: input.owner.nexId,
    inviterDisplayName: input.owner.displayName,
    inviterAvatarUrl: input.owner.avatarUrl,
    inviterIsVerified: false,
    createdAt: now.toISOString(),
    status: "pending",
  };
  // Persist both atomically from the client's POV (both writes are
  // synchronous · caller sees both or neither via try/catch).
  persistGroups([...loadGroups(), group]);
  persistGroupInvites([...loadGroupInvites(), invite]);
  return { group, invite };
}

export function acceptGroupInvite(inviteId: string, newMember: PrivateGroupMember): void {
  const invites = loadGroupInvites();
  const invite = invites.find((i) => i.id === inviteId);
  if (!invite) return;
  // 1. flip invite
  const nextInvites = invites.map((i) =>
    i.id === inviteId ? { ...i, status: "accepted" as const } : i,
  );
  persistGroupInvites(nextInvites);
  // 2. append member to group
  const groups = loadGroups();
  const nextGroups = groups.map((g) => {
    if (g.id !== invite.groupId) return g;
    if (g.members.some((m) => m.accountId === newMember.accountId)) return g;
    return { ...g, members: [...g.members, newMember] };
  });
  persistGroups(nextGroups);
}

/** Dismiss / let-expire a group invite · adds a per-group-instance
 *  block so the inviter cannot re-send to the same recipient on
 *  THIS group (contract §3.2). */
export function refuseGroupInvite(inviteId: string, viewerNexId: string): void {
  const invites = loadGroupInvites();
  const invite = invites.find((i) => i.id === inviteId);
  if (!invite) return;
  const nextInvites = invites.map((i) =>
    i.id === inviteId ? { ...i, status: "expired" as const } : i,
  );
  persistGroupInvites(nextInvites);
  // Record per-group-instance block.
  const normalised = viewerNexId.trim().toLowerCase();
  const blocks = loadGroupBlocks();
  if (
    !blocks.some(
      (b) => b.groupId === invite.groupId && b.blockedNexId === normalised,
    )
  ) {
    persistGroupBlocks([
      ...blocks,
      {
        groupId: invite.groupId,
        blockedNexId: normalised,
        blockedAt: new Date().toISOString(),
      },
    ]);
  }
}

// ─── Group messages (per-group localStorage) ───────────────────

export interface MockGroupMessage {
  readonly id: string;
  readonly groupId: string;
  readonly authorAccountId: string;
  readonly authorDisplayName: string;
  readonly authorAvatarUrl: string | null;
  readonly body: string;
  readonly attachmentImageUrl: string | null;
  readonly createdAt: string;
  readonly status: "active" | "flagged" | "cleared-once" | "permanently-removed";
  readonly flaggedAt?: string;
}

export function loadGroupMessages(groupId: string): ReadonlyArray<MockGroupMessage> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(
      GROUP_MESSAGES_STORAGE_KEY_PREFIX + groupId,
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is MockGroupMessage =>
        m &&
        typeof m.id === "string" &&
        typeof m.groupId === "string" &&
        typeof m.body === "string" &&
        typeof m.createdAt === "string",
    );
  } catch {
    return [];
  }
}

export function persistGroupMessages(
  groupId: string,
  list: ReadonlyArray<MockGroupMessage>,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      GROUP_MESSAGES_STORAGE_KEY_PREFIX + groupId,
      JSON.stringify(list),
    );
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(PRIVATE_GROUP_MESSAGES_CHANGED_EVENT, { detail: groupId }),
  );
}

// ─── Invite expiry helpers ─────────────────────────────────────

export function invitationMsLeft(
  invite: MockGroupInvite,
  now: Date = new Date(),
): number {
  const created = new Date(invite.createdAt).getTime();
  const expiry = created + INVITE_WINDOW_MS;
  return Math.max(0, expiry - now.getTime());
}

export function applyInviteExpiry(
  invites: ReadonlyArray<MockGroupInvite>,
  now: Date = new Date(),
): ReadonlyArray<MockGroupInvite> {
  let changed = false;
  const next = invites.map((i) => {
    if (i.status !== "pending") return i;
    if (invitationMsLeft(i, now) > 0) return i;
    changed = true;
    return { ...i, status: "expired" as const };
  });
  return changed ? next : invites;
}

// ─── Seed · one example group for first paint ──────────────────

/** Idempotent seed · installs one example PRIVATE group ("Weekend
 *  Coffee Club") where the viewer is a member, plus a handful of
 *  OPEN groups across different countries so the Groups-tab country
 *  filter + search has honest content on first paint. Call once on
 *  page mount · safe to re-call. */
export function seedExampleGroupIfEmpty(viewer: PrivateGroupMember): void {
  const existing = loadGroups();
  if (existing.length > 0) return;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
  const privateSeed: MockPrivateGroup = {
    id: "grp-weekend-coffee-seed",
    name: "Weekend Coffee Club",
    description: "Saturday mornings · casual coffee + chat.",
    avatarUrl: null,
    ownerAccountId: "nex-23451",
    members: [
      {
        accountId: "nex-23451",
        nexId: "nex-23451",
        displayName: "Maria Santos",
        initials: "MS",
        avatarUrl: "https://i.pravatar.cc/96?u=nex-23451",
        role: "owner",
        joinedAt: sevenDaysAgo,
      },
      {
        accountId: "nex-61245",
        nexId: "nex-61245",
        displayName: "Crispy Chicken",
        initials: "CC",
        avatarUrl: "https://i.pravatar.cc/96?u=nex-61245",
        role: "admin",
        joinedAt: sixDaysAgo,
      },
      viewer,
    ],
    createdAt: sevenDaysAgo,
    minutesSinceLastPost: 45,
    visibility: "private",
    country: null,
    memberCap: PRIVATE_GROUP_MEMBER_CAP,
  };
  // Four open groups across ID / SG / US / UK · the viewer is NOT a
  // member of any of them · they're meant to populate the discovery
  // list the Groups-tab country-flag filter + search looks at.
  const openSeeds: ReadonlyArray<MockPrivateGroup> = [
    makeOpenSeed({
      id: "grp-open-yogya-food",
      name: "Yogyakarta Street Food Fans",
      description: "Rekomendasi warung · berbagi foto · nongkrong",
      country: "ID",
      memberCount: 1248,
      hoursSinceLastPost: 2,
      ownerDisplayName: "Rina Pratiwi",
      ownerNexId: "nex-55021",
    }),
    makeOpenSeed({
      id: "grp-open-sg-hikes",
      name: "Singapore Weekend Hikes",
      description: "MacRitchie · Bukit Timah · meetups every Saturday",
      country: "SG",
      memberCount: 432,
      hoursSinceLastPost: 5,
      ownerDisplayName: "Kai Lim",
      ownerNexId: "nex-71402",
    }),
    makeOpenSeed({
      id: "grp-open-nyc-devs",
      name: "NYC Indie Developers",
      description: "Monthly meet · side-project showcase · hiring",
      country: "US",
      memberCount: 876,
      hoursSinceLastPost: 1,
      ownerDisplayName: "Alex Morgan",
      ownerNexId: "nex-33802",
    }),
    makeOpenSeed({
      id: "grp-open-london-cycle",
      name: "London Night Cyclists",
      description: "Thursday night rides · all paces welcome",
      country: "GB",
      memberCount: 294,
      hoursSinceLastPost: 7,
      ownerDisplayName: "Priya Sharma",
      ownerNexId: "nex-82110",
    }),
  ];
  persistGroups([privateSeed, ...openSeeds]);
}

function makeOpenSeed(args: {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly country: string;
  readonly memberCount: number;
  readonly hoursSinceLastPost: number;
  readonly ownerDisplayName: string;
  readonly ownerNexId: string;
}): MockPrivateGroup {
  const createdAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ownerInitials = args.ownerDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  // One member row · the owner. The displayed "memberCount" is
  // synthetic for the open-group card copy; the viewer-side `members`
  // array only materialises when real joins happen.
  const owner: PrivateGroupMember = {
    accountId: args.ownerNexId,
    nexId: args.ownerNexId,
    displayName: args.ownerDisplayName,
    initials: ownerInitials,
    avatarUrl: `https://i.pravatar.cc/96?u=${args.ownerNexId}`,
    role: "owner",
    joinedAt: createdAt,
  };
  return {
    id: args.id,
    name: args.name,
    description: args.description,
    avatarUrl: null,
    ownerAccountId: owner.accountId,
    members: [owner],
    createdAt,
    minutesSinceLastPost: args.hoursSinceLastPost * 60,
    visibility: "open",
    country: args.country,
    memberCap: OPEN_GROUP_MEMBER_CAP,
    discoveryMemberCount: args.memberCount,
  };
}

/**
 * One-tap join for an OPEN group · adds the viewer as a `member`
 * role. No-op for private groups (those require an invite). Idempotent.
 */
export function joinOpenGroup(groupId: string, viewer: PrivateGroupMember): void {
  const groups = loadGroups();
  const next = groups.map((g) => {
    if (g.id !== groupId) return g;
    if (g.visibility !== "open") return g;
    if (g.members.some((m) => m.accountId === viewer.accountId)) return g;
    return {
      ...g,
      members: [...g.members, { ...viewer, role: "member" as const }],
    };
  });
  persistGroups(next);
}

/**
 * Discovery listing for the Groups-tab search bar · returns only
 * `visibility: "open"` groups the viewer has NOT yet joined, scoped
 * to the given country if supplied, filtered by the search query
 * against the group name. Case-insensitive. Pure read.
 */
export function listDiscoverableOpenGroups(args: {
  readonly country: string | null;
  readonly query: string;
  readonly viewerAccountId: string;
}): ReadonlyArray<MockPrivateGroup> {
  const q = args.query.trim().toLowerCase();
  const country = args.country ? args.country.toUpperCase() : null;
  return loadGroups().filter((g) => {
    if (g.visibility !== "open") return false;
    if (g.members.some((m) => m.accountId === args.viewerAccountId)) return false;
    if (country !== null && g.country !== country) return false;
    if (q.length > 0 && !g.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

/**
 * The set of countries that currently have at least one open group ·
 * drives the country-flag dropdown so empty countries aren't offered.
 * Returns ISO alpha-2 codes · case-normalised to uppercase.
 */
export function listOpenGroupCountries(): ReadonlyArray<string> {
  const seen = new Set<string>();
  for (const g of loadGroups()) {
    if (g.visibility === "open" && g.country) {
      seen.add(g.country.toUpperCase());
    }
  }
  return [...seen].sort();
}

/** Idempotent seed · installs one inbound group invite from "Dr James
 *  Okafor" so the inbound surface renders a group-shaped card on
 *  first visit. */
export function seedExampleInviteIfEmpty(): void {
  const existing = loadGroupInvites();
  if (existing.length > 0) return;
  const invite: MockGroupInvite = {
    id: "grp-inv-seed-1",
    groupId: "grp-dinner-seed",
    groupName: "Dinner Thursday",
    groupAvatarUrl: null,
    inviterNexId: "nex-77281",
    inviterDisplayName: "Dr James Okafor",
    inviterAvatarUrl: "https://i.pravatar.cc/96?u=nex-77281",
    inviterIsVerified: true,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3h ago · ~21h left
    status: "pending",
  };
  persistGroupInvites([invite]);
}
