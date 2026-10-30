// src/lib/nex-native/music/music-duration-probe.ts
//
// Owner-authorised 2026-10-31 (music-upload-audit · finding #10) ·
// server-side duration probe.
//
// Before this: `duration_ms` was taken verbatim from the client's
// `new Audio().duration` reading, submitted via multipart form, and
// trusted. A malicious or buggy client could send duration_ms=1 or
// duration_ms=999999999 — the server accepted whatever came in.
//
// After this: the server parses the audio bytes with `music-metadata`
// (pure-JS, no native bindings, serverless-safe) and extracts the
// real duration from the file's frame headers / mp4 header. The
// client value is ignored.
//
// Scope · dev + prod · the probe runs on the server-side upload path
// regardless of storage adapter.

import "server-only";
import { parseBuffer } from "music-metadata";
import type { NexMusicMimeType } from "./types";

export interface ProbeResult {
  readonly ok: true;
  readonly durationMs: number;
  readonly bitrateKbps: number | null;
}

export interface ProbeFailure {
  readonly ok: false;
  readonly reason:
    | "parse-failed"
    | "no-duration-in-metadata"
    | "duration-non-finite"
    | "duration-not-positive";
  readonly detail: string;
}

/** Probe duration (and bitrate when available) from the audio bytes.
 *
 *  Pure, synchronous-feel (returns a Promise but no I/O beyond the
 *  in-memory parse). Fails closed · caller MUST reject the upload
 *  when `ok === false`. Never falls back to a client-reported value;
 *  the whole point of this helper is to remove client trust. */
export async function probeAudioDuration(
  bytes: Buffer,
  mime: NexMusicMimeType,
): Promise<ProbeResult | ProbeFailure> {
  try {
    const metadata = await parseBuffer(
      bytes,
      { mimeType: mime, size: bytes.length },
      { duration: true, skipCovers: true, skipPostHeaders: true },
    );
    const seconds = metadata.format.duration;
    if (seconds === undefined || seconds === null) {
      return {
        ok: false,
        reason: "no-duration-in-metadata",
        detail: "music-metadata did not return a duration field",
      };
    }
    if (!Number.isFinite(seconds)) {
      return {
        ok: false,
        reason: "duration-non-finite",
        detail: `metadata.format.duration = ${String(seconds)}`,
      };
    }
    if (seconds <= 0) {
      return {
        ok: false,
        reason: "duration-not-positive",
        detail: `metadata.format.duration = ${seconds}`,
      };
    }
    const durationMs = Math.round(seconds * 1000);
    const bitrateKbps =
      typeof metadata.format.bitrate === "number" &&
      Number.isFinite(metadata.format.bitrate) &&
      metadata.format.bitrate > 0
        ? Math.round(metadata.format.bitrate / 1000)
        : null;
    return { ok: true, durationMs, bitrateKbps };
  } catch (err) {
    return {
      ok: false,
      reason: "parse-failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
