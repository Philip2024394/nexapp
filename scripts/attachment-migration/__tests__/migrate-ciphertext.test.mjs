// scripts/attachment-migration/__tests__/migrate-ciphertext.test.mjs
//
// Unit tests for the pure helpers in migrate-ciphertext.mjs.
// Owner-authorised 2026-11-08.
//
// Integration tests (against the sandbox DB + Storage) live in a
// separate file and are only run when SANDBOX_* env vars are present.

import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { writeFileSync, mkdtempSync, existsSync } from "node:fs";
import path from "node:path";

import {
  parseStoragePath,
  readLedger,
  sha256,
} from "../migrate-ciphertext.mjs";

describe("parseStoragePath", () => {
  it("extracts the path from a public-bucket URL", () => {
    const url =
      "https://xyz.supabase.co/storage/v1/object/public/nex-peer-chat-attachments/enc/11111111-1111-1111-1111-111111111111/1730000000-abc123.bin";
    const p = parseStoragePath(url, "nex-peer-chat-attachments");
    expect(p).toBe(
      "enc/11111111-1111-1111-1111-111111111111/1730000000-abc123.bin",
    );
  });

  it("strips query + fragment from the URL", () => {
    const url =
      "https://xyz.supabase.co/storage/v1/object/public/nex-peer-chat-attachments/enc/a/b.bin?token=xxx#frag";
    expect(parseStoragePath(url, "nex-peer-chat-attachments")).toBe(
      "enc/a/b.bin",
    );
  });

  it("returns null when the bucket name does not match", () => {
    const url =
      "https://xyz.supabase.co/storage/v1/object/public/other-bucket/enc/a.bin";
    expect(parseStoragePath(url, "nex-peer-chat-attachments")).toBeNull();
  });

  it("returns null on non-URL input", () => {
    expect(parseStoragePath(null, "x")).toBeNull();
    expect(parseStoragePath(undefined, "x")).toBeNull();
    expect(parseStoragePath("", "x")).toBeNull();
    expect(parseStoragePath("not-a-url", "x")).toBeNull();
  });

  it("returns null for a private-bucket URL (never auto-detect as public)", () => {
    const url =
      "https://xyz.supabase.co/storage/v1/object/public/nex-peer-chat-ciphertext/enc/a.bin";
    expect(parseStoragePath(url, "nex-peer-chat-attachments")).toBeNull();
  });
});

describe("sha256", () => {
  it("returns the known digest for a short input", () => {
    const b = new Uint8Array([0x61, 0x62, 0x63]); // 'abc'
    expect(sha256(b)).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("produces different hashes for different inputs", () => {
    expect(sha256(new Uint8Array([1, 2, 3]))).not.toBe(
      sha256(new Uint8Array([1, 2, 4])),
    );
  });
});

describe("readLedger", () => {
  function tempDir() {
    return mkdtempSync(path.join(tmpdir(), "nex-ledger-"));
  }

  it("returns empty map when the ledger file does not exist", () => {
    const dir = tempDir();
    const p = path.join(dir, "ledger.jsonl");
    expect(existsSync(p)).toBe(false);
    const m = readLedger(p);
    expect(m.size).toBe(0);
  });

  it("indexes only status=ok rows · skips fail/skip/corrupt lines", () => {
    const dir = tempDir();
    const p = path.join(dir, "ledger.jsonl");
    writeFileSync(
      p,
      [
        JSON.stringify({ at: "a", message_id: "ok-one", status: "ok" }),
        JSON.stringify({ at: "a", message_id: "ok-two", status: "ok" }),
        JSON.stringify({ at: "a", message_id: "x", status: "fail", stage: "download_public" }),
        JSON.stringify({ at: "a", message_id: "y", status: "skip", reason: "no_envelope_or_url" }),
        "{corrupt-line",
        "",
      ].join("\n") + "\n",
    );
    const m = readLedger(p);
    expect(m.size).toBe(2);
    expect(m.has("ok-one")).toBe(true);
    expect(m.has("ok-two")).toBe(true);
    expect(m.has("x")).toBe(false);
    expect(m.has("y")).toBe(false);
  });

  it("second-run resume semantics · an ok row suppresses re-processing", () => {
    const dir = tempDir();
    const p = path.join(dir, "ledger.jsonl");
    writeFileSync(
      p,
      JSON.stringify({ message_id: "resume-me", status: "ok" }) + "\n",
    );
    const m = readLedger(p);
    expect(m.has("resume-me")).toBe(true);
  });
});
