// src/app/nex-native/settings/__tests__/_enforcement-anchors.test.ts
//
// R9/R10/R14 enforcement anchors · sealed 2026-10-15.
// --------------------------------------------------------------
// Owner directive 2026-10-15: "A UI toggle without enforcement is not
// completion." This test asserts the SEALED enforcement sites exist in
// source · each gate is a bounded addition to a sealed service file,
// and a regression (someone removing the gate or weakening it) would
// break the privacy contract.
//
// Vitest in this repo runs on structural + fs.readFileSync patterns
// (no @testing-library/react; no Supabase mock). Behavioural runtime
// verification of these gates requires authenticated Playwright with
// a provisioned test account · owner-performed (gated on
// tests/e2e/.auth/state.json which remains absent).

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
function read(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

// ─── R9 · Chat preferences enforcement ──────────────────────────────

describe("R9 · read-receipt enforcement at peer-message-service.markPeerMessagesRead", () => {
  const SRC = stripComments(read("src/lib/nex-native/peer-message-service.ts"));

  test("gate uses getChatPreferencesSafe (fail-closed)", () => {
    expect(SRC).toContain("getChatPreferencesSafe");
  });

  test("gate returns no-op when read_receipts_enabled is false", () => {
    expect(SRC).toMatch(/if\s*\(\s*!prefs\.read_receipts_enabled\s*\)/);
  });

  test("markPeerMessageDelivered accepts optional viewerAccountId", () => {
    expect(SRC).toMatch(/markPeerMessageDelivered\(\s*messageId:\s*NexUuid,\s*viewerAccountId\?:\s*NexUuid/);
  });
});

describe("R9 · read-receipt reciprocity filter at /since route", () => {
  const SRC = stripComments(
    read("src/app/api/nex-native/peer-message/since/route.ts"),
  );

  test("route imports getChatPreferencesSafe lazily", () => {
    // Lazy dynamic import · the opening `import(` and the module
    // specifier may sit on separate lines in the source. Match the
    // essential tokens regardless of newline formatting.
    expect(SRC).toContain("getChatPreferencesSafe");
    expect(SRC).toMatch(/import\s*\(\s*["']@\/lib\/nex-native\/chat-preferences-service["']/);
  });

  test("route strips read_at for viewer-sent messages when receipts disabled", () => {
    expect(SRC).toMatch(/stripViewerReadAt/);
    expect(SRC).toContain("!viewerPrefs.read_receipts_enabled");
  });
});

describe("R9 · delivered route passes session.account.id to service", () => {
  const SRC = stripComments(
    read("src/app/api/nex-native/peer-message/delivered/route.ts"),
  );

  test("route calls markPeerMessageDelivered with session.account.id", () => {
    expect(SRC).toMatch(/markPeerMessageDelivered\(\s*id,\s*session\.account\.id/);
  });
});

describe("R9 · typing-client honours typingEnabled prop", () => {
  const SRC = stripComments(
    read("src/app/nex-native/chat/peer/[accountId]/_typing-client.tsx"),
  );

  test("declares typingEnabled prop", () => {
    expect(SRC).toContain("typingEnabled?: boolean");
  });

  test("gates openTypingChannel on typingEnabled", () => {
    expect(SRC).toMatch(/if\s*\(\s*props\.disabled\s*\|\|\s*!typingEnabled\s*\)/);
  });

  test("input-listener attach also respects typingEnabled", () => {
    const inputMatches = SRC.match(/if \(props\.disabled \|\| !typingEnabled\) return/g) ?? [];
    expect(inputMatches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("R9 · presence-client honours publishPresence prop", () => {
  const SRC = stripComments(
    read("src/app/nex-native/chat/peer/[accountId]/_presence-client.tsx"),
  );

  test("declares publishPresence prop", () => {
    expect(SRC).toContain("publishPresence?: boolean");
  });

  test("initialKind flips to offline when publishPresence is false", () => {
    expect(SRC).toMatch(/initialKind:\s*publishPresence\s*\?\s*"online"\s*:\s*"offline"/);
  });
});

describe("R9 · peer-chat parent resolves chatPrefs and passes props", () => {
  const SRC = stripComments(
    read("src/app/nex-native/chat/peer/[accountId]/page.tsx"),
  );

  test("imports getChatPreferencesSafe", () => {
    expect(SRC).toContain("getChatPreferencesSafe");
  });

  test("resolves chatPrefs for the current session", () => {
    expect(SRC).toMatch(/const chatPrefs = await getChatPreferencesSafe\(\s*session\.account\.id\s*\)/);
  });

  test("passes typingEnabled from chatPrefs to PeerTypingClient", () => {
    expect(SRC).toContain("typingEnabled={chatPrefs.typing_indicator_enabled}");
  });

  test("passes publishPresence from chatPrefs to PeerPresenceClient", () => {
    expect(SRC).toContain('publishPresence={chatPrefs.online_status_visibility !== "nobody"}');
  });
});

// ─── R10 · Privacy enforcement ──────────────────────────────────────

describe("R10 · profile-visibility gate at /u/[handle]", () => {
  const SRC = stripComments(
    read("src/app/nex-native/u/[handle]/page.tsx"),
  );

  test("imports resolveProfileVisibilityForViewer", () => {
    expect(SRC).toContain("resolveProfileVisibilityForViewer");
  });

  test("gate runs AFTER the is_discoverable gate", () => {
    // Compare CALL-SITE positions, not the top-of-file import. The
    // import adds an occurrence that always precedes any gate.
    const discoverableIdx = SRC.indexOf("if (!isDiscoverable && !isSelf)");
    // The call site uses `await resolveProfileVisibilityForViewer(` ·
    // match that specifically to skip the import token.
    const callSiteIdx = SRC.indexOf("await resolveProfileVisibilityForViewer(");
    expect(discoverableIdx).toBeGreaterThan(-1);
    expect(callSiteIdx).toBeGreaterThan(-1);
    expect(callSiteIdx).toBeGreaterThan(discoverableIdx);
  });

  test("non-visible resolution triggers notFound() (404 for private · prevents enumeration)", () => {
    expect(SRC).toMatch(/if\s*\(\s*!visibility\.visible\s*\)\s*\{[\s\S]{0,80}notFound\(\)/);
  });

  test("owner (isSelf) bypasses the visibility gate", () => {
    expect(SRC).toMatch(/if\s*\(\s*!isSelf\s*\)\s*\{[\s\S]{0,500}resolveProfileVisibilityForViewer/);
  });
});

describe("R10 · peer-conversation-service exposes a gated wrapper", () => {
  const SRC = stripComments(
    read("src/lib/nex-native/peer-conversation-service.ts"),
  );

  test("exports getOrCreatePeerConversationAsSender", () => {
    expect(SRC).toContain("export async function getOrCreatePeerConversationAsSender");
  });

  test("gated wrapper consults canSenderInitiateConversation", () => {
    expect(SRC).toContain("canSenderInitiateConversation");
  });

  test("legacy symmetric creator preserved · documents the migration path", () => {
    expect(SRC).toContain("export async function getOrCreatePeerConversation");
  });
});

// ─── R14 · Data usage enforcement ───────────────────────────────────

describe("R14 · upload-quality compression at encrypted-attachment-upload", () => {
  const SRC = stripComments(
    read("src/lib/nex-native/crypto/encrypted-attachment-upload.ts"),
  );

  test("UploadEncryptedAttachmentOptions carries uploadQuality field", () => {
    expect(SRC).toMatch(/uploadQuality\?:\s*"standard"\s*\|\s*"hd"/);
  });

  test("compressImageIfStandard helper is defined", () => {
    expect(SRC).toContain("async function compressImageIfStandard");
  });

  test("standard tier skips videos and audio (browsers don't natively transcode video)", () => {
    expect(SRC).toMatch(/if\s*\(\s*!file\.type\.startsWith\(\s*"image\/"\s*\)\s*\)\s*return file/);
  });

  test("compression returns original if compressed is somehow larger (safety)", () => {
    expect(SRC).toMatch(/if\s*\(\s*blob\.size\s*>=\s*file\.size\s*\)\s*return file/);
  });

  test("default uploadQuality is 'standard' when caller omits the opt", () => {
    expect(SRC).toMatch(/opts\.uploadQuality\s*\?\?\s*"standard"/);
  });

  test("content-type + size reported from effectiveFile (not original) · recipients render delivered bytes", () => {
    expect(SRC).toContain("contentType: effectiveFile.type");
    expect(SRC).toContain("sizeBytes: effectiveFile.size");
  });
});

// ─── Service modules structural ──────────────────────────────────────

describe("R9/R10/R14 preference services expose fail-closed safe variants", () => {
  test("chat-preferences-service exports getChatPreferencesSafe + areContacts", () => {
    const SRC = stripComments(
      read("src/lib/nex-native/chat-preferences-service.ts"),
    );
    expect(SRC).toContain("export async function getChatPreferencesSafe");
    expect(SRC).toContain("export async function areContacts");
    expect(SRC).toContain("PRIVACY_MAXIMUM_PREFS");
  });

  test("privacy-preferences-service exports canSenderInitiateConversation + resolveProfileVisibilityForViewer", () => {
    const SRC = stripComments(
      read("src/lib/nex-native/privacy-preferences-service.ts"),
    );
    expect(SRC).toContain("export async function canSenderInitiateConversation");
    expect(SRC).toContain("export async function resolveProfileVisibilityForViewer");
    // 404 for private · owner directive 2026-10-15
    expect(SRC).toMatch(/response:\s*"404"/);
  });

  test("data-usage-preferences-service exports getDataUsagePreferencesSafe", () => {
    const SRC = stripComments(
      read("src/lib/nex-native/data-usage-preferences-service.ts"),
    );
    expect(SRC).toContain("export async function getDataUsagePreferencesSafe");
    expect(SRC).toContain("DEFAULT_DATA_USAGE_PREFS");
  });
});
