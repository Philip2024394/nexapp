// src/lib/nex-native/status-storage/store.ts
//
// NEX Status · device-local IndexedDB wrapper.
//
// Scope (strict):
//   · Browser-only persistence. IndexedDB stores Blobs natively, so the
//     mediaBlob field survives structured cloning end-to-end.
//   · All exported functions return Promises · raw IDBRequest callbacks
//     are never exposed · failure modes surface as `StatusStorageError`.
//   · SSR / Safari private-mode safe · functions that would otherwise
//     touch indexedDB throw a typed STORAGE_UNAVAILABLE error so
//     callers can fall back cleanly (e.g. an empty "My statuses" list).
//
// Non-scope:
//   · No encryption · see crypto-at-rest.ts · v1 is plaintext.
//   · No Supabase sync · the module is strictly device-local.
//   · No multi-device replication · future.
//   · No quota prompts · `getTotalStorageUsedBytes` returns raw bytes
//     and leaves UI to decide what to warn.

import type { StoredStatus } from "./types";

// ---------------------------------------------------------------------------
// Database identity
// ---------------------------------------------------------------------------

const DB_NAME = "nex-status-v1";
const DB_VERSION = 1;
const STORE = "statuses";
const INDEX_BY_OWNER = "by_owner";
const INDEX_BY_EXPIRES = "by_expires";

// ---------------------------------------------------------------------------
// Typed error surface
// ---------------------------------------------------------------------------

export type StatusStorageErrorCode =
  | "STORAGE_UNAVAILABLE"
  | "OPEN_FAILED"
  | "TRANSACTION_FAILED"
  | "RECORD_INVALID";

export class StatusStorageError extends Error {
  public readonly code: StatusStorageErrorCode;
  public readonly cause?: unknown;

  constructor(code: StatusStorageErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "StatusStorageError";
    this.code = code;
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Internal plumbing
// ---------------------------------------------------------------------------

function getIndexedDB(): IDBFactory {
  // SSR guard · typeof window === "undefined" also catches node without
  // a browser-like global. We also check indexedDB specifically because
  // fake-indexeddb and jsdom can install one or the other.
  const g: unknown = (globalThis as { indexedDB?: unknown }).indexedDB;
  if (!g) {
    throw new StatusStorageError(
      "STORAGE_UNAVAILABLE",
      "indexedDB is not available in this environment",
    );
  }
  return g as IDBFactory;
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(
        new StatusStorageError(
          "TRANSACTION_FAILED",
          `IndexedDB request failed: ${req.error?.message ?? "unknown"}`,
          req.error,
        ),
      );
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(
        new StatusStorageError(
          "TRANSACTION_FAILED",
          `IndexedDB transaction aborted: ${tx.error?.message ?? "unknown"}`,
          tx.error,
        ),
      );
    tx.onerror = () =>
      reject(
        new StatusStorageError(
          "TRANSACTION_FAILED",
          `IndexedDB transaction error: ${tx.error?.message ?? "unknown"}`,
          tx.error,
        ),
      );
  });
}

/**
 * Open the status store database. Idempotent · callers may invoke on
 * every operation · IndexedDB handles the pooling internally.
 *
 * Creates the DB + object store + indexes if missing.
 *
 * Throws `StatusStorageError("STORAGE_UNAVAILABLE")` when indexedDB
 * is not available (SSR, Safari private mode, etc.). Throws
 * `StatusStorageError("OPEN_FAILED")` on any other open-time failure.
 */
export function openStatusStore(): Promise<IDBDatabase> {
  let factory: IDBFactory;
  try {
    factory = getIndexedDB();
  } catch (err) {
    return Promise.reject(err);
  }
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex(INDEX_BY_OWNER, "ownerAccountId", { unique: false });
        store.createIndex(INDEX_BY_EXPIRES, "expiresAtMs", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(
        new StatusStorageError(
          "OPEN_FAILED",
          `Failed to open ${DB_NAME}: ${req.error?.message ?? "unknown"}`,
          req.error,
        ),
      );
    req.onblocked = () =>
      reject(
        new StatusStorageError(
          "OPEN_FAILED",
          `Opening ${DB_NAME} was blocked by another connection`,
        ),
      );
  });
}

function validateStatus(status: StoredStatus): void {
  if (!status || typeof status !== "object") {
    throw new StatusStorageError("RECORD_INVALID", "status must be an object");
  }
  if (typeof status.id !== "string" || status.id.length === 0) {
    throw new StatusStorageError("RECORD_INVALID", "status.id must be a non-empty string");
  }
  if (typeof status.ownerAccountId !== "string" || status.ownerAccountId.length === 0) {
    throw new StatusStorageError(
      "RECORD_INVALID",
      "status.ownerAccountId must be a non-empty string",
    );
  }
  if (status.kind !== "image" && status.kind !== "video") {
    throw new StatusStorageError("RECORD_INVALID", "status.kind must be 'image' or 'video'");
  }
  if (!(status.mediaBlob instanceof Blob)) {
    throw new StatusStorageError("RECORD_INVALID", "status.mediaBlob must be a Blob");
  }
  if (typeof status.mediaSizeBytes !== "number" || status.mediaSizeBytes < 0) {
    throw new StatusStorageError(
      "RECORD_INVALID",
      "status.mediaSizeBytes must be a non-negative number",
    );
  }
  if (typeof status.postedAtMs !== "number" || !Number.isFinite(status.postedAtMs)) {
    throw new StatusStorageError("RECORD_INVALID", "status.postedAtMs must be a finite number");
  }
  if (typeof status.expiresAtMs !== "number" || !Number.isFinite(status.expiresAtMs)) {
    throw new StatusStorageError(
      "RECORD_INVALID",
      "status.expiresAtMs must be a finite number",
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist a status record. Overwrites any existing row with the same id.
 */
export async function saveStatus(status: StoredStatus): Promise<void> {
  validateStatus(status);
  const db = await openStatusStore();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put(status);
    await promisifyTransaction(tx);
  } finally {
    db.close();
  }
}

/**
 * List active (non-expired) statuses for a given owner, newest-first.
 *
 * "Active" means `expiresAtMs >= Date.now()` at call time · callers
 * who need stricter semantics should call `sweepExpired()` first.
 */
export async function listMyStatuses(ownerAccountId: string): Promise<StoredStatus[]> {
  if (typeof ownerAccountId !== "string" || ownerAccountId.length === 0) {
    return [];
  }
  const db = await openStatusStore();
  try {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const index = store.index(INDEX_BY_OWNER);
    const req = index.getAll(IDBKeyRange.only(ownerAccountId));
    const rows = (await promisifyRequest(req)) as StoredStatus[];
    await promisifyTransaction(tx);
    const now = Date.now();
    return rows
      .filter((row) => row.expiresAtMs >= now)
      .sort((a, b) => b.postedAtMs - a.postedAtMs);
  } finally {
    db.close();
  }
}

/**
 * Fetch a single status by id · returns null if absent.
 *
 * Does NOT filter expired · callers who care about expiry should
 * check `expiresAtMs` themselves or call `sweepExpired()` beforehand.
 */
export async function getStatus(id: string): Promise<StoredStatus | null> {
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }
  const db = await openStatusStore();
  try {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    const row = (await promisifyRequest(req)) as StoredStatus | undefined;
    await promisifyTransaction(tx);
    return row ?? null;
  } finally {
    db.close();
  }
}

/**
 * Delete a status by id. Idempotent · deleting a non-existent id
 * resolves without error.
 */
export async function deleteStatus(id: string): Promise<void> {
  if (typeof id !== "string" || id.length === 0) {
    return;
  }
  const db = await openStatusStore();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.delete(id);
    await promisifyTransaction(tx);
  } finally {
    db.close();
  }
}

/**
 * Sweep all expired statuses · returns the number of rows deleted.
 *
 * Idempotent · safe to call on every app mount. Uses the expiresAtMs
 * index with a bounded cursor so even large stores sweep in one tx.
 */
export async function sweepExpired(): Promise<number> {
  const db = await openStatusStore();
  try {
    const now = Date.now();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const index = store.index(INDEX_BY_EXPIRES);
    // Range: everything strictly less than `now` is expired.
    const range = IDBKeyRange.upperBound(now, true);
    let deleted = 0;
    const cursorReq = index.openCursor(range);
    await new Promise<void>((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        deleted += 1;
        cursor.continue();
      };
      cursorReq.onerror = () =>
        reject(
          new StatusStorageError(
            "TRANSACTION_FAILED",
            `sweepExpired cursor failed: ${cursorReq.error?.message ?? "unknown"}`,
            cursorReq.error,
          ),
        );
    });
    await promisifyTransaction(tx);
    return deleted;
  } finally {
    db.close();
  }
}

/**
 * Sum of mediaSizeBytes across every active (non-expired) status row.
 *
 * Intended for quota-awareness UI · DO NOT treat as authoritative
 * device storage usage · users may have other apps consuming quota.
 */
export async function getTotalStorageUsedBytes(): Promise<number> {
  const db = await openStatusStore();
  try {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    const rows = (await promisifyRequest(req)) as StoredStatus[];
    await promisifyTransaction(tx);
    const now = Date.now();
    let total = 0;
    for (const row of rows) {
      if (row.expiresAtMs >= now) {
        total += row.mediaSizeBytes;
      }
    }
    return total;
  } finally {
    db.close();
  }
}
