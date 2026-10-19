// src/app/nex-native/chat/peer/[accountId]/__tests__/add-to-call-wiring.test.ts
//
// NEX Peer-call Add-to-Call · upgrade-flow wiring + guard tests.
// Owner-authorised Phase 2 build 2026-10-19.
// -----------------------------------------------------------------------------
// Verifies the end-to-end 1:1 → group upgrade chain the Priority 2B
// audit found had zero automated coverage:
//
//   _call-launcher.tsx::inviteAdd (state-guarded trigger)
//     → <AddToCallModal onPick(c)> (duplicate-submit guard via busyId)
//       → inviteToGroupCallAction({ currentPeer, invitee, mediaType })
//         → createGroupCallSession({ host, mediaType, inviteeAccountIds[2] })
//         → sendPeerMessage(invite to each · soft-fail)
//       → onInvited(sessionId, inviteeName)
//     → launcher.hangup() + router.push(/call/g/{sessionId})
//
// Honesty invariant (sealed in _add-to-call-action.ts header):
//   "This does NOT magically teleport the current peer across signalling
//    layers · WebRTC's 1:1 and the group mesh use different channels.
//    The honest flow is 'end the 1:1, offer everyone the group room.'"
//
// The tests enforce this doctrine · a developer who short-circuits the
// hangup or re-routes the current peer directly into the mesh breaks
// the sealed semantics and triggers these assertions.

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DIR = path.resolve(__dirname, "..");
const LAUNCHER = fs.readFileSync(path.join(DIR, "_call-launcher.tsx"), "utf8");
const MODAL = fs.readFileSync(path.join(DIR, "_add-to-call-modal.tsx"), "utf8");
const ACTION = fs.readFileSync(path.join(DIR, "_add-to-call-action.ts"), "utf8");
const LIST_ACTION = fs.readFileSync(path.join(DIR, "_list-contacts-for-add-action.ts"), "utf8");

// ─── A · Launcher trigger (modal has a real user-facing entry) ────────

describe("A · _call-launcher mounts AddToCallModal with a state-guarded trigger", () => {
  it("imports AddToCallModal", () => {
    expect(LAUNCHER).toMatch(/import\s*\{\s*AddToCallModal\s*\}\s*from\s*["'`]\.\/_add-to-call-modal["'`]/);
  });

  it("declares addPickerOpen state + inviteAdd trigger that only fires during an active call", () => {
    expect(LAUNCHER).toMatch(/const\s*\[\s*addPickerOpen\s*,\s*setAddPickerOpen\s*\]\s*=\s*React\.useState/);
    expect(LAUNCHER).toMatch(/const\s+inviteAdd\s*=\s*\(\)\s*=>/);
    // Guards: only open the picker when there IS a call to upgrade.
    expect(LAUNCHER).toMatch(/inviteAdd[\s\S]{0,300}state\s*!==\s*["'`]connected["'`][\s\S]{0,80}state\s*!==\s*["'`]dialing["'`]/);
  });

  it("mounts <AddToCallModal> conditionally on addPickerOpen with onInvited + onClose props", () => {
    expect(LAUNCHER).toMatch(/\{addPickerOpen\s*&&\s*\(\s*<AddToCallModal/);
    expect(LAUNCHER).toMatch(/<AddToCallModal[\s\S]{0,400}onInvited=\{\s*onInvited\s*\}/);
    expect(LAUNCHER).toMatch(/<AddToCallModal[\s\S]{0,400}onClose=\{\s*\(\)\s*=>\s*setAddPickerOpen\(false\)\s*\}/);
  });

  it("onInvited CLOSES the picker, calls hangup on the current 1:1, then routes to the group room", () => {
    // Sealed ordering: close modal → set toast → hang up 1:1 → setTimeout 220ms → push group URL.
    // The hangup MUST fire · a regression that routes to the group room
    // without ending the 1:1 would leave the local peer still ringing.
    expect(LAUNCHER).toMatch(
      /const\s+onInvited\s*=[\s\S]{0,400}setAddPickerOpen\(false\)[\s\S]{0,400}callRef\.current\?\.hangup\(\)[\s\S]{0,400}router\.push\s*\(\s*`\/nex-native\/call\/g\/\$\{sessionId\}`/,
    );
  });
});

// ─── B · Modal duplicate-submit + failure-handling guards ────────────

describe("B · AddToCallModal onPick guards duplicate submits + preserves 1:1 on failure", () => {
  it("declares busyId state and short-circuits onPick when a submission is in flight", () => {
    expect(MODAL).toMatch(/busyId/);
    expect(MODAL).toMatch(/async function\s+onPick[\s\S]{0,200}if\s*\(\s*busyId\s*\)\s*return/);
  });

  it("onPick calls inviteToGroupCallAction with the exact 3-field arg shape", () => {
    expect(MODAL).toMatch(
      /inviteToGroupCallAction\(\{[\s\S]{0,200}currentPeerAccountId:[\s\S]{0,80}inviteeAccountId:[\s\S]{0,80}mediaType:/,
    );
  });

  it("on failure the modal clears busyId + sets error + DOES NOT call onInvited (so the 1:1 is not torn down)", () => {
    expect(MODAL).toMatch(
      /if\s*\(\s*!r\.ok\s*\)\s*\{[\s\S]{0,200}setBusyId\(null\)[\s\S]{0,200}setErr\(r\.reason\)[\s\S]{0,80}return/,
    );
    // The onInvited call MUST be AFTER the ok-check return. If a dev
    // reorders this the launcher will fire hangup on failed invites.
    const okOrder = MODAL.indexOf("if (!r.ok)");
    const invitedOrder = MODAL.indexOf("props.onInvited(r.sessionId");
    expect(okOrder).toBeGreaterThan(-1);
    expect(invitedOrder).toBeGreaterThan(okOrder);
  });

  it("modal is a dialog with the sealed 'Add to call' aria-label (accessibility guard)", () => {
    expect(MODAL).toMatch(/role=["']dialog["']/);
    expect(MODAL).toMatch(/aria-modal=["']true["']/);
    expect(MODAL).toMatch(/aria-label=["']Add to call["']/);
  });

  it("Escape key closes the modal (accessibility · documented keydown handler)", () => {
    expect(MODAL).toMatch(/e\.key\s*===\s*["']Escape["'][\s\S]{0,80}props\.onClose\(\)/);
  });
});

// ─── C · Server-action guards (contract) ─────────────────────────────

describe("C · inviteToGroupCallAction server contract", () => {
  it("declares 'use server' directive", () => {
    expect(ACTION).toMatch(/^"use server";/m);
  });

  it("export shape · InviteToGroupCallArgs + InviteToGroupCallResult", () => {
    expect(ACTION).toMatch(/export interface InviteToGroupCallArgs/);
    expect(ACTION).toMatch(/export interface InviteToGroupCallResult/);
    expect(ACTION).toMatch(/currentPeerAccountId:\s*string/);
    expect(ACTION).toMatch(/inviteeAccountId:\s*string/);
    expect(ACTION).toMatch(/mediaType:\s*["']audio["']\s*\|\s*["']video["']/);
  });

  it("returns {ok:false, reason:'unauthenticated'} when no session", () => {
    expect(ACTION).toMatch(/if\s*\(\s*!session\s*\)\s*return\s*\{\s*ok:\s*false,\s*reason:\s*["']unauthenticated["']\s*\}/);
  });

  it("rejects self-invite + invitee-equals-current-peer with reason 'pick a different contact'", () => {
    expect(ACTION).toMatch(/args\.inviteeAccountId\s*===\s*session\.account\.id/);
    expect(ACTION).toMatch(/args\.inviteeAccountId\s*===\s*args\.currentPeerAccountId/);
    expect(ACTION).toMatch(/pick a different contact/);
  });

  it("fails with 'contact not found' when invitee lookup returns null", () => {
    expect(ACTION).toMatch(/if\s*\(\s*!invitee\s*\)\s*return\s*\{\s*ok:\s*false,\s*reason:\s*["']contact not found["']\s*\}/);
  });

  it("creates the group session via createGroupCallSession with BOTH participants pre-invited", () => {
    expect(ACTION).toMatch(/createGroupCallSession\(\{[\s\S]{0,200}hostAccountId:\s*session\.account\.id[\s\S]{0,80}mediaType:\s*args\.mediaType[\s\S]{0,200}inviteeAccountIds:\s*\[\s*args\.currentPeerAccountId,\s*args\.inviteeAccountId\s*\]/);
  });

  it("composes a joinUrl from request headers (host + proto)", () => {
    expect(ACTION).toMatch(/\$\{proto\}:\/\/\$\{host\}\/nex-native\/call\/g\/\$\{groupSession\.id\}/);
  });

  it("sends an invite chat message to BOTH the current peer and the new invitee (soft-fail)", () => {
    // Soft-fail · try/catch inside sendInvite · the honest doctrine
    // comment acknowledges message send is best-effort. The viewer
    // still gets routed into the group room.
    expect(ACTION).toMatch(/const\s+sendInvite\s*=\s*async\s*\(\s*otherId:\s*string\s*\)/);
    expect(ACTION).toMatch(/try\s*\{[\s\S]{0,200}getOrCreatePeerConversation[\s\S]{0,200}sendPeerMessage/);
    expect(ACTION).toMatch(/if\s*\(currentPeer\)\s*await\s+sendInvite\(args\.currentPeerAccountId\)/);
    expect(ACTION).toMatch(/await\s+sendInvite\(args\.inviteeAccountId\)/);
  });

  it("returns {ok:true, sessionId, joinUrl, inviteeDisplayName} on success", () => {
    expect(ACTION).toMatch(/return\s*\{[\s\S]{0,200}ok:\s*true[\s\S]{0,80}sessionId:\s*groupSession\.id[\s\S]{0,80}joinUrl[\s\S]{0,80}inviteeDisplayName/);
  });

  it("catches any exception and returns {ok:false, reason} (no uncaught throw)", () => {
    expect(ACTION).toMatch(/catch\s*\(\s*e\s*\)\s*\{[\s\S]{0,200}return\s*\{\s*ok:\s*false,\s*reason:\s*\(e as Error\)\.message/);
  });
});

// ─── D · Contact-list action excludes current peer + self ───────────

describe("D · listContactsForAddAction filters out current peer AND self", () => {
  it("declares 'use server'", () => {
    expect(LIST_ACTION).toMatch(/^"use server";/m);
  });

  it("excludes BOTH the current peer and the viewer themselves from the picker list", () => {
    expect(LIST_ACTION).toMatch(/id\s*!==\s*excludeAccountId\s*&&\s*id\s*!==\s*session\.account\.id/);
  });

  it("returns [] when there is no session (unauthenticated · honest empty state)", () => {
    expect(LIST_ACTION).toMatch(/if\s*\(\s*!session\s*\)\s*return\s*\[\s*\]/);
  });

  it("sorts the picker list alphabetically by displayName", () => {
    expect(LIST_ACTION).toMatch(/\.sort\(\(\s*a,\s*b\s*\)\s*=>\s*a\.displayName\.localeCompare\(b\.displayName\)\)/);
  });

  it("exposes the sealed AddPickContact shape with the required fields", () => {
    expect(LIST_ACTION).toMatch(/export interface AddPickContact/);
    for (const field of ["id", "displayName", "avatarUrl", "profession", "headline", "locationLabel", "handle"]) {
      expect(LIST_ACTION, `AddPickContact must declare ${field}`).toMatch(new RegExp(`${field}:\\s*(string|null)`));
    }
  });
});

// ─── E · Doctrine honesty · no "teleport the current peer" semantics ─

describe("E · doctrine · the upgrade flow does not promise to transfer the live 1:1 peer", () => {
  it("server action header carries the honest doctrine comment", () => {
    expect(ACTION.toLowerCase()).toMatch(/does not magically teleport/);
  });

  it("launcher's onInvited explicitly hangs up the 1:1 (hangup → wait 220ms → navigate · documented order)", () => {
    // Honest flow: tear down 1:1 BEFORE navigating to the group room,
    // with a brief tick so the bye signal reaches the peer. Catches
    // a regression that routes without hanging up or inverts the order.
    const hangup = LAUNCHER.indexOf("callRef.current?.hangup()");
    const navigate = LAUNCHER.indexOf("router.push(`/nex-native/call/g/${sessionId}`)");
    expect(hangup).toBeGreaterThan(-1);
    expect(navigate).toBeGreaterThan(hangup);
    expect(LAUNCHER).toMatch(/setTimeout\(\(\)\s*=>\s*\{[\s\S]{0,200}router\.push\s*\(\s*`\/nex-native\/call\/g\//);
  });
});
