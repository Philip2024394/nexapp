"use server";

// src/app/nex-native/hq/pages/_actions.ts
//
// Server actions backing the HQ Pages dashboard:
//   · readDeletionQueue   · list currently queued deletions
//   · queueDeletionAction · append a URL to the queue file
//   · unqueueDeletionAction · remove a URL from the queue
//   · countCallersAction  · run `git grep` to find external callers
//
// Owner-authorised 2026-11-06. The queue file is deliberately plain
// JSONL under `data/` so a human (or a follow-up "process queue"
// tool) can audit + apply the deletes outside of a hot path.

import {
  appendFile,
  mkdir,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";
// Owner directive 2026-11-07 · Item 3 · Fix 1 · the three reader
// functions + their constants + their types live in a non-"use server"
// sibling module so they are NOT exported as client-invocable Server
// Actions. Imported here only by same-file mutating actions that need
// to read current state before writing. External callers (hq/pages/
// page.tsx) must import from "./_queue-readers" directly · re-
// exporting from a "use server" file would turn the re-exports into
// Server Actions, defeating the point.
import {
  LOCK_OVERRIDES_FILE,
  QUEUE_FILE,
  RENAME_QUEUE_FILE,
  readDeletionQueue,
  readLockOverrides,
  type DeletionQueueEntry,
  type LockOverrides,
  type RenameQueueEntry,
} from "./_queue-readers";

// Re-export so `_client.tsx` can continue importing these types from
// `_actions.ts` alongside the action functions.  The types originate in
// `_queue-readers.ts`; re-exporting here keeps the client's import list
// focused on the action module without changing public type identity.
export type { DeletionQueueEntry, LockOverrides, RenameQueueEntry };

const execp = promisify(exec);

async function assertHqAdmin(): Promise<string> {
  const session = await resolveSessionWithDevOverride();
  if (!session) throw new Error("not-authenticated");
  await requireHqAdmin(session.account.id);
  return session.account.id;
}

export async function queueDeletionAction(
  url: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let actor: string;
  try {
    actor = await assertHqAdmin();
  } catch {
    return { ok: false, error: "not-authorised" };
  }
  await mkdir(path.dirname(QUEUE_FILE), { recursive: true });
  const entry: DeletionQueueEntry = {
    url,
    queuedAt: new Date().toISOString(),
    actorAccountId: actor,
    ...(reason ? { reason } : {}),
  };
  await appendFile(QUEUE_FILE, JSON.stringify(entry) + "\n", "utf8");
  return { ok: true };
}

export async function unqueueDeletionAction(
  url: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertHqAdmin();
  } catch {
    return { ok: false, error: "not-authorised" };
  }
  const existing = await readDeletionQueue();
  const filtered = existing.filter((e) => e.url !== url);
  const text =
    filtered.map((e) => JSON.stringify(e)).join("\n") +
    (filtered.length ? "\n" : "");
  await writeFile(QUEUE_FILE, text, "utf8");
  return { ok: true };
}

export interface CallerInfo {
  readonly count: number;
  readonly files: readonly string[];
  readonly truncated: boolean;
}

export interface RouteInspection {
  readonly ownFiles: readonly string[];
  readonly callers: CallerInfo;
}

/** Walks the route's folder (src/app${url}/) recursively and returns
 *  every file path · tells the founder exactly what Claude would
 *  remove from the repo if this route is deleted. Paths are rooted
 *  at the repo root (e.g. `src/app/nex-native/foo/page.tsx`). */
async function listRouteOwnFiles(url: string): Promise<string[]> {
  const segments = url.replace(/^\//, "").split("/");
  const root = path.join(process.cwd(), "src", "app", ...segments);
  const results: string[] = [];
  async function walk(dir: string, rel: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const r = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(full, r);
      } else {
        results.push(`src/app${r}`);
      }
    }
  }
  await walk(root, url);
  return results.sort();
}

// ─── Rename queue ─────────────────────────────────────────────────
// RenameQueueEntry + readRenameQueue + RENAME_QUEUE_FILE live in
// `_queue-readers.ts` per Item 3 · Fix 1.

/** Minimal validation · the final sanity check (collision, is-dynamic,
 *  is-file-system-legal) runs when Claude processes the queue. */
function validateNewUrl(newUrl: string): string | null {
  if (!newUrl.startsWith("/nex-native/")) {
    return "New URL must start with /nex-native/";
  }
  if (newUrl.length < "/nex-native/".length + 1) {
    return "New URL is empty after /nex-native/";
  }
  if (/\s/.test(newUrl)) return "URL contains whitespace";
  if (newUrl.endsWith("/")) return "Remove the trailing slash";
  return null;
}

export async function renameRouteAction(
  oldUrl: string,
  newUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let actor: string;
  try {
    actor = await assertHqAdmin();
  } catch {
    return { ok: false, error: "not-authorised" };
  }
  const trimmed = newUrl.trim();
  if (trimmed === oldUrl) {
    return { ok: false, error: "new URL is identical to old URL" };
  }
  const err = validateNewUrl(trimmed);
  if (err) return { ok: false, error: err };
  await mkdir(path.dirname(RENAME_QUEUE_FILE), { recursive: true });
  const entry: RenameQueueEntry = {
    oldUrl,
    newUrl: trimmed,
    queuedAt: new Date().toISOString(),
    actorAccountId: actor,
  };
  await appendFile(
    RENAME_QUEUE_FILE,
    JSON.stringify(entry) + "\n",
    "utf8",
  );
  return { ok: true };
}

// ─── Lock overrides ───────────────────────────────────────────────
// LockOverrides + readLockOverrides + LOCK_OVERRIDES_FILE live in
// `_queue-readers.ts` per Item 3 · Fix 1.

export async function toggleLockAction(
  url: string,
  locked: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertHqAdmin();
  } catch {
    return { ok: false, error: "not-authorised" };
  }
  const current = await readLockOverrides();
  const next: LockOverrides = { ...current, [url]: locked };
  await mkdir(path.dirname(LOCK_OVERRIDES_FILE), { recursive: true });
  await writeFile(
    LOCK_OVERRIDES_FILE,
    JSON.stringify(next, null, 2) + "\n",
    "utf8",
  );
  return { ok: true };
}

// ─── Route inspection ─────────────────────────────────────────────

/** Combined inspection for a route · own-folder files + external
 *  callers · used by the HQ Pages dashboard right-side panel to
 *  show the founder what Claude will delete vs. what Claude will
 *  edit on the next deletion run. */
export async function inspectRouteAction(url: string): Promise<RouteInspection> {
  try {
    await assertHqAdmin();
  } catch {
    return {
      ownFiles: [],
      callers: { count: 0, files: [], truncated: false },
    };
  }
  const [ownFiles, callers] = await Promise.all([
    listRouteOwnFiles(url),
    countCallersAction(url),
  ]);
  return { ownFiles, callers };
}

/** External-caller count for a route. Greps ts/tsx for the URL
 *  string (literal segment up to the first dynamic bracket). Excludes
 *  files that live inside the route's own folder. Result is bounded
 *  (first 50 files) so a widely-used route doesn't balloon the
 *  response. */
export async function countCallersAction(url: string): Promise<CallerInfo> {
  try {
    await assertHqAdmin();
  } catch {
    return { count: 0, files: [], truncated: false };
  }
  // Grep for the literal part of the URL up to any dynamic segment.
  const literal = url.split("[")[0].replace(/\/$/, "");
  const target = literal.length > "/nex-native/".length ? literal : url;
  // Escape double-quotes for the shell.
  const safeTarget = target.replace(/"/g, '\\"');
  try {
    const { stdout } = await execp(
      `git grep -l -- "${safeTarget}" -- "src/**/*.ts" "src/**/*.tsx" "src/**/*.css"`,
      { cwd: process.cwd(), maxBuffer: 4 * 1024 * 1024 },
    );
    const allFiles = stdout.split("\n").filter(Boolean);
    const ownFolder = `src/app${url.replace(/\[/g, "[").replace(/\]/g, "]")}/`;
    const external = allFiles.filter(
      (f) => !f.startsWith(ownFolder) && f !== `src/app${url}/page.tsx`,
    );
    const truncated = external.length > 50;
    return {
      count: external.length,
      files: external.slice(0, 50),
      truncated,
    };
  } catch {
    return { count: 0, files: [], truncated: false };
  }
}
