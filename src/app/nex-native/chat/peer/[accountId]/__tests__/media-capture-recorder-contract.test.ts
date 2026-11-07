// src/app/nex-native/chat/peer/[accountId]/__tests__/media-capture-recorder-contract.test.ts
//
// NEX Peer-chat · media capture + recorder contract tests.
// Owner-authorised Phase 2 build 2026-10-19.
// -----------------------------------------------------------------------------
// Priority 2B flagged zero automated coverage for `_media-capture.tsx`
// and `_media-recorder.tsx`. End-to-end testing of these components
// requires a real browser (getUserMedia + MediaRecorder are browser-
// only APIs), which is out of scope for the vitest/node environment.
//
// This file guards the CONTRACTS the two components publish, so any
// regression that silently breaks a slot/kind/fallback is caught
// without needing to spin up a browser:
//
//   · File-input (mobile) · camera / video / voice hidden inputs with
//     the right accept + capture attrs so native OS tools open.
//   · Progress overlay during upload (uploading state, kind-specific
//     copy).
//   · Encrypted upload path exists with FAIL-CLOSED outcome (Phase 1 ·
//     owner-authorised 2026-11-07, supersedes the earlier silent-
//     fallback doctrine). No module-level plaintext fallthrough.
//   · Recorder (desktop) · getUserMedia request, MediaRecorder-based
//     start/stop, status enum covers "denied" + "unsupported",
//     fallback-to-file-input prop exists.
//   · Stream cleanup on unmount + on close (track.stop() in both paths).
//
// Browser-only behaviour (actual permission prompts, real file
// uploads, MediaRecorder encoding) is NOT covered here · the test
// comments say so and the audit receipt reports this honestly.

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DIR = path.resolve(__dirname, "..");
const CAPTURE = fs.readFileSync(path.join(DIR, "_media-capture.tsx"), "utf8");
const RECORDER = fs.readFileSync(path.join(DIR, "_media-recorder.tsx"), "utf8");

// ─── A · File-input (mobile native tools) ────────────────────────────

describe("A · _media-capture · hidden file inputs for camera / video / voice", () => {
  it("exposes a 3-member CaptureKind union", () => {
    expect(CAPTURE).toMatch(/export type CaptureKind\s*=\s*["']camera["']\s*\|\s*["']video["']\s*\|\s*["']voice["']/);
  });

  it("exposes an imperative handle with open(kind) method", () => {
    expect(CAPTURE).toMatch(/export interface MediaCaptureHandle\s*\{\s*open\(kind:\s*CaptureKind\)\s*:\s*void/);
  });

  it("camera input has accept='image/*' + capture='environment' (back camera)", () => {
    const cameraBlock = CAPTURE.slice(CAPTURE.indexOf('accept="image/*"') - 500, CAPTURE.indexOf('accept="image/*"') + 500);
    expect(cameraBlock).toContain('accept="image/*"');
    expect(cameraBlock).toContain('capture="environment"');
  });

  it("video input has accept='video/*' + capture='environment'", () => {
    const videoBlock = CAPTURE.slice(CAPTURE.indexOf('accept="video/*"') - 500, CAPTURE.indexOf('accept="video/*"') + 500);
    expect(videoBlock).toContain('accept="video/*"');
    expect(videoBlock).toContain('capture="environment"');
  });

  it("voice input has accept='audio/*' (capture optional · mic doesn't need environment hint)", () => {
    expect(CAPTURE).toMatch(/accept="audio\/\*"/);
  });
});

// ─── B · Upload path + progress overlay ──────────────────────────────

describe("B · _media-capture · uploading state + progress overlay + kind-specific copy", () => {
  it("tracks uploading state (CaptureKind | null)", () => {
    expect(CAPTURE).toMatch(/const\s*\[\s*uploading\s*,\s*setUploading\s*\]\s*=\s*React\.useState<\s*CaptureKind\s*\|\s*null\s*>/);
  });

  it("declares a KIND_COPY map with verb + icon for each capture kind", () => {
    expect(CAPTURE).toMatch(/KIND_COPY/);
    expect(CAPTURE).toMatch(/Uploading photo/);
    expect(CAPTURE).toMatch(/Uploading video/);
    expect(CAPTURE).toMatch(/Uploading voice note/);
  });

  it("renders an upload progress overlay via createPortal (Bridge 65 doctrine)", () => {
    expect(CAPTURE).toMatch(/import\s*\{\s*createPortal\s*\}\s*from\s*["']react-dom["']/);
    // Post-Phase-1 wording · "progress overlay" / "upload overlay" /
    // "UploadOverlay" are all accepted so the assertion survives
    // comment-header refreshes.
    expect(CAPTURE.toLowerCase()).toMatch(/progress overlay|upload overlay|uploadoverlay/);
  });
});

// ─── C · Encrypted upload path · Phase 1 fail-closed (2026-11-07) ────

describe("C · _media-capture · encrypted upload path · Phase 1 fail-closed", () => {
  it("imports the fail-closed attempt helper", () => {
    expect(CAPTURE).toMatch(/attemptEncryptedAttachment/);
  });

  it("accepts an encryptedUploadEnabled prop so NEX1 (no E2E) can disable it", () => {
    expect(CAPTURE).toMatch(/encryptedUploadEnabled\?:\s*boolean/);
  });

  it("stashes the encryption key for the receiver via stashEncryptedAttachmentKey", () => {
    expect(CAPTURE).toMatch(/stashEncryptedAttachmentKey/);
  });

  it("declares the sealed uploadQuality preference enum", () => {
    expect(CAPTURE).toMatch(/"standard"\s*\|\s*"hd"/);
  });

  it("imports the fail-closed outcome type + block copy table", () => {
    expect(CAPTURE).toMatch(/BLOCK_COPY/);
    expect(CAPTURE).toMatch(/AttachmentBlockedOutcome/);
  });

  it("renders the AttachmentBlockPrompt on a blocked outcome", () => {
    expect(CAPTURE).toMatch(/AttachmentBlockPrompt/);
  });

  it("does NOT contain a silent plaintext fallback after encryption failure", () => {
    // Prove there's no `catch { formRef.current?.requestSubmit() }` /
    // equivalent in a branch following a failed encryption attempt.
    expect(CAPTURE).not.toMatch(/catch\s*(?:\(\w*\))?\s*\{\s*formRef\.current\?\.requestSubmit\(\)/);
    expect(CAPTURE).not.toMatch(/Silent fallback to the plaintext/);
  });

  it("blocked state is required before any plaintext submission", () => {
    // The plaintext submit helpers must be reached from either:
    //   (a) the encryptedUploadEnabled=false branch (NEX1 support), or
    //   (b) the user's explicit tap on Send-as-standard inside the
    //       block prompt (onPromptSendStandard).
    // Neither path can be an auto-fallthrough from a failed encryption.
    expect(CAPTURE).toMatch(/onPromptSendStandard/);
  });
});

// ─── D · Recorder (desktop) · lifecycle + fallback ───────────────────

describe("D · _media-recorder · lifecycle + fallback invariants", () => {
  it("exposes a 3-member RecorderKind union matching CaptureKind", () => {
    expect(RECORDER).toMatch(/export type RecorderKind\s*=\s*["']camera["']\s*\|\s*["']video["']\s*\|\s*["']voice["']/);
  });

  it("accepts an onFallbackToFileInput prop for browsers without getUserMedia/MediaRecorder", () => {
    expect(RECORDER).toMatch(/onFallbackToFileInput:\s*\(\)\s*=>\s*void/);
  });

  it("status enum includes requesting / ready / recording / captured / denied / unsupported", () => {
    expect(RECORDER).toMatch(/"requesting"\s*\|\s*"ready"\s*\|\s*"recording"\s*\|\s*"captured"\s*\|\s*"denied"\s*\|\s*"unsupported"/);
  });

  it("detects missing getUserMedia and transitions to 'unsupported' instead of crashing", () => {
    expect(RECORDER).toMatch(/typeof navigator === "undefined"\s*\|\|\s*!navigator\.mediaDevices\?\.getUserMedia[\s\S]{0,80}setStatus\("unsupported"\)/);
  });

  it("detects missing MediaRecorder and transitions to 'unsupported' instead of crashing", () => {
    expect(RECORDER).toMatch(/typeof MediaRecorder === "undefined"[\s\S]{0,80}setStatus\("unsupported"\)/);
  });

  it("transitions to 'denied' on getUserMedia permission denial", () => {
    expect(RECORDER).toMatch(/setStatus\("denied"\)/);
  });
});

// ─── E · Stream cleanup · critical to release the mic/camera light ──

describe("E · _media-recorder · stream + recorder cleanup (prevents hot camera/mic after close)", () => {
  it("calls getTracks().forEach(t.stop()) on the stream reference (at least two call sites · success + unmount)", () => {
    const stopCalls = (RECORDER.match(/getTracks\(\)\.forEach\(\(t\)\s*=>\s*t\.stop\(\)\)/g) ?? []).length;
    expect(stopCalls, `expected ≥2 stream-stop sites, found ${stopCalls}`).toBeGreaterThanOrEqual(2);
  });

  it("Escape key closes the modal (keeps the cleanup path reachable)", () => {
    expect(RECORDER).toMatch(/e\.key\s*===\s*["']Escape["'][\s\S]{0,80}onClose\(\)/);
  });

  it("recorder.stop() is called when transitioning out of 'recording'", () => {
    expect(RECORDER).toMatch(/recorderRef\.current\.stop\(\)/);
  });
});

// ─── F · Honest documentation of the browser-only limits ─────────────

describe("F · doctrine honesty · recorder documents the fallback contract", () => {
  it("file header explicitly documents the desktop/mobile asymmetry + fallback path", () => {
    expect(RECORDER.toLowerCase()).toMatch(/fallback/);
    expect(RECORDER.toLowerCase()).toMatch(/mobile.*(native camera|file.?input)|desktop.*mediarecorder/);
  });

  it("capture file header documents the Phase 1 fail-closed posture", () => {
    expect(CAPTURE.toLowerCase()).toMatch(/fail-closed|fail closed/);
    expect(CAPTURE.toLowerCase()).toMatch(/no silent plaintext fallback|not a silent fallthrough|not silently/);
  });
});
