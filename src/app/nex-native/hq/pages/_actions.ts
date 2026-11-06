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

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { requireHqAdmin } from "@/lib/nex-native/hq-authorization";

const execp = promisify(exec);
const QUEUE_FILE = path.join(process.cwd(), "data", "hq-deletion-queue.jsonl");

export interface DeletionQueueEntry {
  readonly url: string;
  readonly queuedAt: string;
  readonly actorAccountId: string;
  readonly reason?: string;
}

async function assertHqAdmin(): Promise<string> {
  const session = await resolveSessionWithDevOverride();
  if (!session) throw new Error("not-authenticated");
  await requireHqAdmin(session.account.id);
  return session.account.id;
}

export async function readDeletionQueue(): Promise<DeletionQueueEntry[]> {
  try {
    const text = await readFile(QUEUE_FILE, "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as DeletionQueueEntry;
        } catch {
          return null;
        }
      })
      .filter((x): x is DeletionQueueEntry => x !== null);
  } catch {
    return [];
  }
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
