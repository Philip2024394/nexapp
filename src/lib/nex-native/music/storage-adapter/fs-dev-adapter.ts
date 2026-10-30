// src/lib/nex-native/music/storage-adapter/fs-dev-adapter.ts
//
// Owner-authorised 2026-10-29 · DRAFT §5 — "clearly isolated
// development-only adapter". Local filesystem store under
// `.dev-music-data/audio/{ownerAccountId}/{objectKey}`.
//
// Honest limits:
//   · Dev-only. Multi-device playback requires a production provider.
//   · "Signed URL" here is an in-process signed path consumed by a
//     NEX API route that validates the signature + ownership before
//     streaming bytes. Signatures use HMAC-SHA256 with
//     NEX_MUSIC_DEV_SIGN_KEY (dev-generated if absent).
//   · The adapter never writes under `public/` · bytes are reachable
//     only through the authenticated API route.

import "server-only";
import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  MusicMediaStorage,
  PutObjectArgs,
  SignedReadUrlArgs,
  SignedReadUrlResult,
} from "./types";

const ROOT = path.resolve(process.cwd(), ".dev-music-data", "audio");

// Owner-authorised 2026-10-31 (music-upload-audit · finding #12):
// defence-in-depth guard. The adapter factory also refuses in prod,
// but a direct import of fsMusicDevAdapter would bypass that. Hard-
// throw at first use so a prod runtime cannot silently write bytes
// to an ephemeral serverless disk and lose them seconds later.
function assertDevOnly(op: string): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `nex-music fs-dev-adapter.${op}: cannot run in production. ` +
        "The filesystem dev adapter is explicitly scoped to NODE_ENV !== 'production'. " +
        "Blocked by sealed memory 2026-10-30 · H2 (production storage adapter) unsealed.",
    );
  }
}

function devSignKey(): string {
  const fromEnv = process.env.NEX_MUSIC_DEV_SIGN_KEY;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  // Dev fallback · if the operator did not set a key we derive a
  // stable per-install key from the cwd. Not a secret · dev-only.
  return crypto
    .createHash("sha256")
    .update(`nex-music-dev-fallback::${process.cwd()}`)
    .digest("hex");
}

function sanitiseKeyPart(part: string): string {
  return part.replace(/[^A-Za-z0-9._-]/g, "_");
}

function referenceFor(ownerAccountId: string, objectKey: string): string {
  return `fs://${sanitiseKeyPart(ownerAccountId)}/${sanitiseKeyPart(objectKey)}`;
}

function pathFor(ref: string): string | null {
  if (!ref.startsWith("fs://")) return null;
  const rest = ref.slice(5);
  const [owner, key, ...rest2] = rest.split("/");
  if (!owner || !key || rest2.length > 0) return null;
  // sanitiseKeyPart is idempotent · still re-apply to defend against
  // a tampered ref that slipped through.
  return path.join(ROOT, sanitiseKeyPart(owner), sanitiseKeyPart(key));
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export const fsMusicDevAdapter: MusicMediaStorage = {
  async putObject(args: PutObjectArgs): Promise<{ reference: string }> {
    assertDevOnly("putObject");
    const ownerDir = path.join(ROOT, sanitiseKeyPart(args.ownerAccountId));
    await ensureDir(ownerDir);
    const dest = path.join(ownerDir, sanitiseKeyPart(args.objectKey));
    await fs.writeFile(dest, args.bytes);
    return { reference: referenceFor(args.ownerAccountId, args.objectKey) };
  },

  async getSignedReadUrl(
    args: SignedReadUrlArgs,
  ): Promise<SignedReadUrlResult> {
    assertDevOnly("getSignedReadUrl");
    const expiresAt = new Date(
      Date.now() + Math.min(Math.max(args.expiresInSeconds, 1), 3600) * 1000,
    );
    const payload = `${args.reference}|${args.ownerAccountId}|${expiresAt.getTime()}`;
    const sig = crypto
      .createHmac("sha256", devSignKey())
      .update(payload)
      .digest("hex");
    const encodedRef = encodeURIComponent(args.reference);
    const encodedOwner = encodeURIComponent(args.ownerAccountId);
    const signedUrl = `/api/nex-native/music/stream?ref=${encodedRef}&owner=${encodedOwner}&exp=${expiresAt.getTime()}&sig=${sig}`;
    return { signedUrl, expiresAt };
  },

  async deleteObject(args: { reference: string }): Promise<{
    deleted: boolean;
  }> {
    assertDevOnly("deleteObject");
    const abs = pathFor(args.reference);
    if (!abs) return { deleted: false };
    try {
      await fs.unlink(abs);
      return { deleted: true };
    } catch {
      return { deleted: false };
    }
  },

  async objectExists(args: {
    reference: string;
  }): Promise<{ exists: boolean; byteLength?: number }> {
    assertDevOnly("objectExists");
    const abs = pathFor(args.reference);
    if (!abs) return { exists: false };
    try {
      const st = await fs.stat(abs);
      return { exists: true, byteLength: st.size };
    } catch {
      return { exists: false };
    }
  },
};

/** Server-side verification of a signed URL produced by this adapter.
 *  Used by the `/api/nex-native/music/stream` route. */
export function verifyFsSignedReadUrl(args: {
  reference: string;
  ownerAccountId: string;
  expiresAtMs: number;
  signature: string;
}): { ok: true; absolutePath: string } | { ok: false; reason: string } {
  if (Date.now() > args.expiresAtMs) {
    return { ok: false, reason: "expired" };
  }
  const payload = `${args.reference}|${args.ownerAccountId}|${args.expiresAtMs}`;
  const expected = crypto
    .createHmac("sha256", devSignKey())
    .update(payload)
    .digest("hex");
  // Timing-safe compare.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(args.signature, "hex");
  if (a.length !== b.length) return { ok: false, reason: "bad signature" };
  if (!crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad signature" };
  }
  const abs = pathFor(args.reference);
  if (!abs) return { ok: false, reason: "bad reference" };
  return { ok: true, absolutePath: abs };
}
