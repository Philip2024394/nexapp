// src/app/nex-native/hq/pages/_queue-readers.ts
//
// HQ Pages · read-only file readers for the three queue / override
// files on disk. Owner directive 2026-11-07 · Item 3 · Fix 1 ·
// extracted out of `_actions.ts` so these reader functions are NOT
// exported as client-invocable Server Actions.
// -----------------------------------------------------------------------------
// Rationale · in Next.js 16 every function exported from a file that
// carries the `"use server"` pragma becomes an HTTP-reachable Server
// Action with a stable id. Readers that only ever run inside server
// components do not need that surface. Keeping them in this module ·
// which does NOT have `"use server"` but IS marked `"server-only"` ·
// prevents both (a) a future accidental client-component import from
// exposing them and (b) their inclusion in the Server Action id
// catalogue at build time.
//
// Same return shapes + behaviour as before the move. The three action
// files that need the readers at runtime (`queueDeletionAction`,
// `unqueueDeletionAction`, `toggleLockAction`) and `page.tsx` import
// from here.

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const QUEUE_FILE = path.join(
  process.cwd(),
  "data",
  "hq-deletion-queue.jsonl",
);
export const RENAME_QUEUE_FILE = path.join(
  process.cwd(),
  "data",
  "hq-rename-queue.jsonl",
);
export const LOCK_OVERRIDES_FILE = path.join(
  process.cwd(),
  "data",
  "hq-lock-overrides.json",
);

// ─── Deletion queue ──────────────────────────────────────────────────

export interface DeletionQueueEntry {
  readonly url: string;
  readonly queuedAt: string;
  readonly actorAccountId: string;
  readonly reason?: string;
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

// ─── Rename queue ────────────────────────────────────────────────────

export interface RenameQueueEntry {
  readonly oldUrl: string;
  readonly newUrl: string;
  readonly queuedAt: string;
  readonly actorAccountId: string;
}

export async function readRenameQueue(): Promise<RenameQueueEntry[]> {
  try {
    const text = await readFile(RENAME_QUEUE_FILE, "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as RenameQueueEntry;
        } catch {
          return null;
        }
      })
      .filter((x): x is RenameQueueEntry => x !== null);
  } catch {
    return [];
  }
}

// ─── Lock overrides ──────────────────────────────────────────────────

export type LockOverrides = Record<string, boolean>;

export async function readLockOverrides(): Promise<LockOverrides> {
  try {
    const text = await readFile(LOCK_OVERRIDES_FILE, "utf8");
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const result: LockOverrides = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === "boolean") result[k] = v;
      }
      return result;
    }
  } catch {
    /* fall through */
  }
  return {};
}
