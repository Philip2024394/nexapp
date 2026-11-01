"use client";

// src/app/nex-native/contacts/_pending-invites-section.tsx
//
// Owner directive 2026-10-23 · "build ship connect all four and make
// contacts page fully operational live ready for user" · mock-complete
// track. Covers:
//
//   1. Connect by NEX-ID (sender creates an outbound pending invite)
//   2. Outbound Waiting section (sender tracks their pending invites)
//   3. Outbound Expired row (sender sees "Invitation expired" when a
//      pending invite ages past 24h · never leaking decline vs timeout)
//   4. Inbound Invitations section (viewer sees invites they've
//      received · Accept + Pass buttons · recipient's "Pass" resolves
//      to "Expired" on the sender's screen, same terminal state)
//   5. localStorage persistence (state survives page refresh)
//
// All state is client-side mock · no DB, no server actions, no cross-
// device sync. When the real `nex_friend_request` schema + service
// land, swap the three handlers (connect / accept / pass-or-cancel)
// for server-action calls · the UI shape stays.
//
// Sealed Socials invite doctrine (2026-10-07) enforced here:
//   · 24h expiry from CREATION (not from recipient notice)
//   · Sender NEVER sees explicit "declined" · timeout + Pass both
//     resolve to the single "Invitation expired" terminal state
//   · Recipient identity hidden pre-accept · only NEX-ID shows on
//     outbound rows AND inbound rows alike

import * as React from "react";
import { addAccepted } from "./_mock-accepted-contacts";
import {
  loadGroupInvites,
  applyInviteExpiry as applyGroupInviteExpiry,
  invitationMsLeft as groupInvitationMsLeft,
  acceptGroupInvite,
  refuseGroupInvite,
  PRIVATE_GROUP_INVITES_CHANGED_EVENT,
  type MockGroupInvite,
  type PrivateGroupMember,
} from "./_mock-private-groups";
import {
  MOCK_PENDING_INVITE_SEEDS,
  hydrateSeedToInvite,
  loadPersistedInvites,
  persistInvites,
  applyExpiry,
  reconcileWithSeeds,
  // `isExpiredCardVisible` import retired · expired outbound rows
  // now render nothing (owner directive 2026-10-23 · "we agreed the
  // invite card disappears"). The helper stays in the mock module
  // as dead code · bring it back by re-adding this import if a
  // visibility window ever returns.
  cooldownMsLeft,
  formatCooldownRemaining,
  type PendingInvite,
  formatCompactTimeRemaining,
  invitationMsLeft,
  invitationElapsedPercent,
  isValidNexIdShape,
  normaliseNexId,
  DEFAULT_INVITE_NOTE,
  sanitiseInviteNote,
} from "./_pending-invites-mock";

const NEX = {
  bgNavy: "var(--nex-world-drawer-bg, #050F1E)",
  bgPanel: "rgba(2,9,20,0.92)",
  text: "#F2F5F8",
  textMute: "#7D9BC0",
  unreadRed: "#B30000",
  cyan: "var(--nex-world-secondary, #00AFFF)",
  // Accept-green token · same hex as the sealed online-presence
  // green used in the picker card. Inbound Accept CTA + chip stroke.
  acceptGreen: "#16D66B",
};

interface PendingInvitesSectionProps {
  readonly accentHex: string;
  /**
   * Owner directive 2026-10-23 · merged inbox per Private Groups
   * contract rev 3 §4 Decision 6. The viewer identity is needed by
   * `acceptGroupInvite()` to materialise the new member row inside
   * the target group. Defaults are safe no-ops · if the parent
   * doesn't pass them yet, group-invite rows still render but accept
   * is a no-op (defensive, not promised).
   */
  readonly viewerDisplayName?: string;
  readonly viewerNexHandle?: string;
}

export function PendingInvitesSection({
  accentHex,
  viewerDisplayName,
  viewerNexHandle,
}: PendingInvitesSectionProps): React.ReactElement {
  // Full invite list · outbound + inbound · all directions together
  // so sorting / expiry / persistence all share one state. Starts
  // empty on both server and client · populated in the mount effect
  // from localStorage (if present) or the seed set.
  const [invites, setInvites] = React.useState<ReadonlyArray<PendingInvite>>([]);
  const [now, setNow] = React.useState<Date | null>(null);
  const [input, setInput] = React.useState("");
  // Owner directive 2026-10-24 · Contact Connect intro-note draft ·
  // sender writes an optional "Say hi" line. Blank note falls back
  // to DEFAULT_INVITE_NOTE on submit so the recipient always sees
  // at least one friendly line of context. Emoji flow via the
  // native OS keyboard (iOS + Android ship with emoji pickers) ·
  // no duplicate NEX-side sticker UI.
  const [noteDraft, setNoteDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [recentActionId, setRecentActionId] = React.useState<string | null>(null);
  // Owner directive 2026-10-23 · "when the user select the confirm
  // button they will see pop up asking then which category to save
  // their new contact to - Contacts - Business". Confirm no longer
  // accepts immediately · it opens a category modal · the chosen
  // category then finalises the accept. Null when no modal open.
  const [confirmingInvite, setConfirmingInvite] =
    React.useState<PendingInvite | null>(null);

  // Owner directive 2026-10-23 · merged inbox per Private Groups
  // contract rev 3 §4 Decision 6 · inbound group invites sit under
  // the same "Invitations" header as friend invites. Separate state
  // because the shape + the accept/refuse behaviour differ · unified
  // only in the UI layer.
  const [groupInvites, setGroupInvites] = React.useState<
    ReadonlyArray<MockGroupInvite>
  >([]);

  React.useEffect(() => {
    const n = new Date();
    setNow(n);
    const persisted = loadPersistedInvites();
    if (persisted !== null) {
      // Restore from last-known state · still re-apply expiry in
      // case the tab was closed for >24h · AND reconcile with the
      // current seed shape to backfill any identity fields that
      // were added after this record was persisted (self-healing).
      setInvites(reconcileWithSeeds(applyExpiry(persisted, n)));
    } else {
      // First visit · hydrate seeds + flip any already-past-window
      // seed to "expired" so the sender sees the Expired chrome
      // from paint 0.
      const seeded = MOCK_PENDING_INVITE_SEEDS.map((seed) =>
        hydrateSeedToInvite(seed, n),
      );
      setInvites(applyExpiry(seeded, n));
    }
    // Owner directive 2026-10-23 · hydrate inbound group invites too ·
    // same shared tick drives their expiry refresh (24h window ·
    // sealed in contract rev 3 §3.3).
    setGroupInvites(applyGroupInviteExpiry(loadGroupInvites(), n));
    // 60s tick · refresh `now` so countdowns + expiry flips re-render
    // without rAF overhead.
    const id = window.setInterval(() => {
      const nowTick = new Date();
      setNow(nowTick);
      setInvites((prev) => applyExpiry(prev, nowTick));
      setGroupInvites((prev) => applyGroupInviteExpiry(prev, nowTick));
    }, 60_000);
    // Owner directive 2026-10-23 · same-window change listener so a
    // Create-Group action in `_my-private-groups-list.tsx` immediately
    // surfaces the resulting invite card for the recipient simulated
    // in dev mode (viewer = sender in the mock · the seeded Dr James
    // Okafor row is their one inbound).
    const onGroupInvitesChange = () => {
      setGroupInvites(applyGroupInviteExpiry(loadGroupInvites(), new Date()));
    };
    window.addEventListener(PRIVATE_GROUP_INVITES_CHANGED_EVENT, onGroupInvitesChange);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(
        PRIVATE_GROUP_INVITES_CHANGED_EVENT,
        onGroupInvitesChange,
      );
    };
  }, []);

  // Persist on every state change · deferred to effect so we don't
  // write during render.
  React.useEffect(() => {
    if (now === null) return;
    persistInvites(invites);
  }, [invites, now]);

  // Clear "recent action" highlight after a short beat.
  React.useEffect(() => {
    if (recentActionId === null) return;
    const t = window.setTimeout(() => setRecentActionId(null), 1800);
    return () => window.clearTimeout(t);
  }, [recentActionId]);

  // ─── Buckets ────────────────────────────────────────────────
  const inboundPending = React.useMemo(() => {
    if (now === null) return [] as ReadonlyArray<PendingInvite>;
    return invites.filter(
      (i) => i.direction === "inbound" && i.status === "pending" && invitationMsLeft(i, now) > 0,
    );
  }, [invites, now]);

  // Owner directive 2026-10-23 · pending inbound group invites · same
  // 24h window as friend invites · surfaces alongside them in the
  // merged "Invitations" header count.
  const inboundGroupPending = React.useMemo(() => {
    if (now === null) return [] as ReadonlyArray<MockGroupInvite>;
    return groupInvites.filter(
      (i) => i.status === "pending" && groupInvitationMsLeft(i, now) > 0,
    );
  }, [groupInvites, now]);

  const outboundVisible = React.useMemo(() => {
    if (now === null) return [] as ReadonlyArray<PendingInvite>;
    // Owner directive 2026-10-23 (revised) · "we agreed the invite
    // card disappears" · expired outbound invites render NOTHING on
    // the sender's side · the sealed Socials doctrine "sender never
    // sees explicit decline vs timeout" is strongest here · zero
    // information leak. The invite record itself stays in storage
    // for 72h so re-invite checks still fire · the Connect-form
    // error surfaces the cooldown honestly when the sender tries
    // to re-invite the same NEX-ID.
    return invites.filter(
      (i) => i.direction === "outbound" && i.status === "pending",
    );
  }, [invites, now]);

  // ─── Mutations ──────────────────────────────────────────────
  const handleConnect = (e: React.FormEvent): void => {
    e.preventDefault();
    const raw = input.trim();
    if (raw.length === 0) {
      setError("Enter a NEX-ID to connect.");
      return;
    }
    if (!isValidNexIdShape(raw)) {
      setError("Format must be nex-00000 (digits).");
      return;
    }
    const normalised = normaliseNexId(raw);
    if (now === null) {
      setError("Please wait a moment and try again.");
      return;
    }
    // Already-pending check · same NEX-ID with a live outbound.
    const existingPending = invites.find(
      (i) =>
        i.direction === "outbound" &&
        normaliseNexId(i.nexId) === normalised &&
        i.status === "pending" &&
        invitationMsLeft(i, now) > 0,
    );
    if (existingPending) {
      setError("You already have a pending invite to this NEX-ID.");
      return;
    }
    // Owner directive 2026-10-23 · 72h cooldown · if the sender
    // recently expired an invite to this NEX-ID, block the re-invite
    // and surface the remaining cooldown time honestly · never a
    // vague "failed", never a leak of decline-vs-timeout.
    const cooldownInvite = invites.find(
      (i) =>
        i.direction === "outbound" &&
        normaliseNexId(i.nexId) === normalised &&
        i.status === "expired" &&
        cooldownMsLeft(i, now) > 0,
    );
    if (cooldownInvite) {
      const remaining = cooldownMsLeft(cooldownInvite, now);
      setError(
        `You recently invited this NEX-ID. You can try again in ${formatCooldownRemaining(remaining)}.`,
      );
      return;
    }
    const id = `out-${Date.now()}`;
    setInvites((prev) => [
      ...prev,
      {
        id,
        nexId: normalised,
        createdAt: new Date().toISOString(),
        status: "pending",
        direction: "outbound",
        // Owner directive 2026-10-24 · attach the sender's intro
        // note to the outbound invite. Blank note falls back to
        // the sealed DEFAULT_INVITE_NOTE so the recipient card
        // always carries at least one honest line of context.
        // Sanitiser clamps to 160 chars + strips newlines. Emoji
        // flow via the native OS keyboard inside the note itself.
        note:
          sanitiseInviteNote(noteDraft) ?? DEFAULT_INVITE_NOTE,
        sticker: null,
      },
    ]);
    setRecentActionId(id);
    setInput("");
    setNoteDraft("");
    setError(null);
  };

  const handleDismissOutbound = (id: string): void => {
    setInvites((prev) => prev.filter((i) => i.id !== id));
  };

  // Owner directive 2026-10-23 · Confirm is now a two-step flow:
  // tap Confirm → open the "Save as..." modal → user picks a
  // category → finalise. `openConfirmModal` stashes the invite in
  // local state so the modal has its context. `finaliseConfirm`
  // runs on category selection and performs the actual accept.
  const openConfirmModal = (invite: PendingInvite): void => {
    setConfirmingInvite(invite);
  };
  const finaliseConfirm = (category: "friends" | "business"): void => {
    const invite = confirmingInvite;
    if (invite === null) return;
    // Mock-complete · remove the pending invite + ALSO persist a
    // new accepted contact in the shared mock store so ContactsList
    // can inject it into the correct tab (friends / business). The
    // store dispatches a `nex-contacts-mock-accepted-changed` event
    // so the ContactsList re-renders without a page reload.
    const identity = invite.senderIdentity;
    if (identity != null) {
      addAccepted({
        id: invite.id,
        nexId: invite.nexId,
        displayName: identity.displayName,
        initials: identity.initials,
        profession: identity.profession,
        city: identity.city,
        isVerified: identity.isVerified,
        avatarUrl: identity.avatarUrl,
        hasShop: identity.hasShop === true,
        shopHref: identity.shopHref ?? null,
        category,
        acceptedAt: new Date().toISOString(),
      });
    }
    setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    setRecentActionId(`accepted-${category}-${invite.id}`);
    setConfirmingInvite(null);
  };
  const dismissConfirmModal = (): void => {
    setConfirmingInvite(null);
  };

  // Owner directive 2026-10-23 · Private Groups contract rev 3 §3.3 ·
  // group-invite accept is a single tap · the viewer becomes a
  // member of the target group immediately. No category modal (the
  // "Save as..." split only exists for friend invites · group
  // membership isn't a contact-category decision). Refuse / let
  // expire records a per-group-instance block so the owner can't
  // re-invite them to THIS group (§3.2).
  const handleAcceptGroupInvite = (invite: MockGroupInvite): void => {
    const name = viewerDisplayName?.trim();
    const handle = viewerNexHandle?.trim();
    if (!name || !handle) {
      // Defensive · parent didn't pass viewer identity · leave the
      // card visible so the user can retry when identity hydrates.
      return;
    }
    const newMember: PrivateGroupMember = {
      accountId: handle,
      nexId: handle,
      displayName: name,
      initials: inboundInitialsFromName(name),
      avatarUrl: null,
      role: "member",
      joinedAt: new Date().toISOString(),
    };
    acceptGroupInvite(invite.id, newMember);
    setRecentActionId(`accepted-group-${invite.id}`);
  };

  const handleRefuseGroupInvite = (invite: MockGroupInvite): void => {
    const handle = viewerNexHandle?.trim();
    if (!handle) return;
    refuseGroupInvite(invite.id, handle);
    setRecentActionId(`passed-group-${invite.id}`);
  };

  // Owner directive 2026-10-23 · "over each card is the small button
  // - Confirm" · Pass button retired from the UI · letting an invite
  // expire IS the pass (sealed Socials doctrine · sender never sees
  // explicit decline). The dedicated `handlePassInbound` handler is
  // therefore no longer needed · the natural 24h expiry handles it.

  return (
    <section
      data-nex-contacts-pending-section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginBottom: 10,
      }}
    >
      {/* ─── Connect by NEX-ID form ─────────────────────────── */}
      <form
        onSubmit={handleConnect}
        data-nex-contacts-connect-form
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        <label
          htmlFor="nex-contacts-connect-input"
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: NEX.text,
            lineHeight: 1.2,
          }}
        >
          Connect by NEX-ID
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            id="nex-contacts-connect-input"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="nex-00000"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            style={{
              flex: 1,
              minWidth: 0,
              height: 36,
              padding: "0 12px",
              borderRadius: 8,
              background: NEX.bgPanel,
              border: `1px solid ${accentHex}55`,
              color: NEX.text,
              fontSize: 13,
              outline: "none",
              letterSpacing: 0.4,
            }}
          />
          <button
            type="submit"
            data-nex-contacts-connect-submit
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 8,
              background: `linear-gradient(135deg, ${accentHex}, ${accentHex}cc)`,
              border: `1px solid ${accentHex}`,
              color: "#FFF",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: `0 2px 10px ${accentHex}55`,
            }}
          >
            Connect
          </button>
        </div>

        {/* Owner-authorised 2026-10-24 · Contact Connect intro note.
            Optional · 160-char cap · newlines squashed by the
            sanitiser · a prefilled DEFAULT_INVITE_NOTE lands on the
            recipient card if the sender leaves it blank. Emoji flow
            via the native OS keyboard (owner directive 2026-10-24
            · "we have imoji on our kepad") · no custom NEX-side
            sticker picker. Phase 2 may add stickers / GIFs via a
            moderation pipeline but the surface is UNCHANGED here. */}
        <textarea
          id="nex-contacts-connect-note"
          data-nex-contacts-connect-note
          placeholder={`Say hi (optional) · we'll send "${DEFAULT_INVITE_NOTE}" if you leave this blank`}
          value={noteDraft}
          maxLength={160}
          rows={2}
          onChange={(e) => {
            setNoteDraft(e.target.value);
            if (error) setError(null);
          }}
          style={{
            width: "100%",
            boxSizing: "border-box",
            resize: "none",
            minHeight: 48,
            padding: "8px 12px",
            borderRadius: 8,
            background: NEX.bgPanel,
            border: `1px solid ${accentHex}55`,
            color: NEX.text,
            fontSize: 12,
            lineHeight: 1.4,
            outline: "none",
            fontFamily: "inherit",
          }}
        />

        {error ? (
          <div
            role="alert"
            data-nex-contacts-connect-error
            style={{ fontSize: 11, color: NEX.unreadRed, fontWeight: 600 }}
          >
            {error}
          </div>
        ) : null}
      </form>

      {/* ─── Inbound invitations section ───────────────────── */}
      {/* Owner directive 2026-10-23 · merged inbox per Private Groups
          contract rev 3 §4 Decision 6 · friend invites AND group
          invites render under the same header, same count, same
          chrome. Only the eyebrow + the Confirm handler differ. */}
      {(inboundPending.length > 0 || inboundGroupPending.length > 0) && now !== null ? (
        <div data-nex-contacts-inbound style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 2px",
            }}
          >
            <span
              data-nex-contacts-inbound-count
              style={{ fontSize: 12, color: NEX.textMute }}
            >
              {inboundPending.length + inboundGroupPending.length}{" "}
              {inboundPending.length + inboundGroupPending.length === 1
                ? "invitation"
                : "invitations"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }} />
            <EnvelopeIcon color={NEX.cyan} />
          </header>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 16 }}>
            {inboundPending.map((invite) => (
              <li key={invite.id} style={{ margin: 0, padding: 0 }}>
                <InboundInviteRow
                  invite={invite}
                  now={now}
                  onAccept={() => openConfirmModal(invite)}
                />
              </li>
            ))}
            {inboundGroupPending.map((invite) => (
              <li key={invite.id} style={{ margin: 0, padding: 0 }}>
                <InboundGroupInviteRow
                  invite={invite}
                  now={now}
                  onAccept={() => handleAcceptGroupInvite(invite)}
                  onRefuse={() => handleRefuseGroupInvite(invite)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ─── Outbound waiting section ──────────────────────── */}
      {outboundVisible.length > 0 && now !== null ? (
        <div data-nex-contacts-waiting style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 2px",
            }}
          >
            {/* Owner directive 2026-10-23 · right-anchored section
                icon · count on the left · clock on the right. */}
            <span
              data-nex-contacts-waiting-count
              style={{ fontSize: 12, color: NEX.textMute }}
            >
              {outboundVisible.length}{" "}
              {outboundVisible.length === 1 ? "invite" : "invites"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }} />
            <WaitingClockIcon color={NEX.cyan} />
          </header>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 16 }}>
            {outboundVisible.map((invite) =>
              invite.status === "expired" ? (
                <li key={invite.id} style={{ margin: 0, padding: 0 }}>
                  <ExpiredOutboundRow
                    invite={invite}
                    onDismiss={() => handleDismissOutbound(invite.id)}
                  />
                </li>
              ) : (
                <li key={invite.id} style={{ margin: 0, padding: 0 }}>
                  <PendingInviteRow
                    invite={invite}
                    accentHex={accentHex}
                    now={now}
                    onDismiss={() => handleDismissOutbound(invite.id)}
                  />
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}

      {/* Toast-style confirmation · appears briefly after Accept or
          Pass or Connect so the user knows the action landed. Lives
          below the sections so it never pushes layout. */}
      {recentActionId ? (
        <div
          role="status"
          data-nex-contacts-pending-toast
          style={{
            marginTop: 4,
            padding: "6px 12px",
            borderRadius: 8,
            background: "rgba(22,214,107,0.12)",
            border: `1px solid ${NEX.acceptGreen}66`,
            color: NEX.acceptGreen,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.2,
            textAlign: "center",
          }}
        >
          {recentActionId.startsWith("accepted-friends-")
            ? "Saved to Contacts."
            : recentActionId.startsWith("accepted-business-")
              ? "Saved to Business."
              : recentActionId.startsWith("accepted-group-")
                ? "You joined the group."
                : recentActionId.startsWith("passed-group-")
                  ? "Group invite passed."
                  : recentActionId.startsWith("accepted-")
                    ? "Invitation accepted."
                    : recentActionId.startsWith("passed-")
                      ? "Invitation passed."
                      : "Invitation sent."}
        </div>
      ) : null}

      {/* Category modal · owner directive 2026-10-23 · "when the user
          select the confirm button they will see pop up asking then
          which category to save their new contact to - Contacts -
          Business". Opens on Confirm tap · the user picks Contacts
          or Business · the chosen category drives the toast (and
          will drive the backend write when the real friend-request
          service lands). Cancel = re-close without accepting. */}
      {confirmingInvite !== null ? (
        <ConfirmCategoryModal
          invite={confirmingInvite}
          onSelect={finaliseConfirm}
          onCancel={dismissConfirmModal}
        />
      ) : null}
    </section>
  );
}

/* ─── Outbound pending row ──────────────────────────────────── */

interface PendingInviteRowProps {
  readonly invite: PendingInvite;
  readonly accentHex: string;
  readonly now: Date;
  readonly onDismiss: () => void;
}

function PendingInviteRow({
  invite,
  accentHex,
  now,
  onDismiss,
}: PendingInviteRowProps): React.ReactElement {
  const PENDING_URGENT_THRESHOLD_MS = 2 * 60 * 60 * 1000;
  const msLeft = invitationMsLeft(invite, now);
  const pendingColor = msLeft < PENDING_URGENT_THRESHOLD_MS ? NEX.unreadRed : NEX.textMute;

  return (
    <article
      data-nex-contacts-pending-row
      data-nex-contacts-pending-nexid={invite.nexId}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: "2px 48px 2px 70px",
        width: "100%",
        boxSizing: "border-box",
        background: NEX.bgPanel,
        border: `1.5px dashed ${accentHex}`,
        borderRadius: 10,
        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        color: NEX.text,
        overflow: "visible",
        marginTop: 14,
      }}
    >
      {/* Clock chip · solid black · amber-green rim overridden by red
          arc as time elapses · time text in centre. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -24,
          left: 12,
          width: 48,
          height: 48,
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${NEX.acceptGreen}`,
            overflow: "visible",
            background: "#000000",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          <span
            data-nex-contacts-pending-chip-time
            style={{
              color: "#FFF",
              fontSize: 15,
              fontWeight: 900,
              letterSpacing: 0.4,
              textShadow: "0 1px 3px rgba(0,0,0,0.7)",
              lineHeight: 1,
            }}
          >
            {formatCompactTimeRemaining(invite, now)}
          </span>
        </div>
        <ProgressArc
          percent={invitationElapsedPercent(invite, now)}
          color={NEX.unreadRed}
        />
      </div>

      {/* Identity column · NEX-ID + status label. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "relative",
          zIndex: 1,
          transform: "translateY(-12px)",
        }}
      >
        <div
          data-nex-contacts-pending-row-nexid
          style={{
            /* Owner directive 2026-10-24 · span-mask treatment ·
               the NEX-ID sits on the card's dashed rim; the <span>
               below carries the shell-navy background so the rim
               line is masked behind the text. */
            fontSize: 15,
            fontWeight: 800,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            letterSpacing: 0.4,
          }}
        >
          <span
            style={{
              display: "inline-block",
              background: NEX.bgNavy,
              color: NEX.text,
              padding: "0 6px",
              lineHeight: 1.2,
            }}
          >
            {invite.nexId.toUpperCase()}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.2,
          }}
        >
          <span
            data-nex-contacts-pending-status
            data-nex-contacts-pending-urgent={
              pendingColor === NEX.unreadRed ? "true" : "false"
            }
            style={{
              color: pendingColor,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            Pending
          </span>
        </div>
      </div>

      {/* Bin · dismiss outbound pending · owner directive 2026-10-23
          "reduce the bin size on the cards little" · 32×32/26 → 26×26/20. */}
      <button
        type="button"
        onClick={onDismiss}
        data-nex-contacts-pending-cancel
        aria-label={`Cancel invitation to ${invite.nexId}`}
        style={{
          position: "absolute",
          top: "50%",
          right: 10,
          transform: "translateY(-50%)",
          width: 26,
          height: 26,
          display: "grid",
          placeItems: "center",
          fontSize: 20,
          lineHeight: 1,
          padding: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          WebkitTapHighlightColor: "transparent",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
          zIndex: 2,
        }}
      >
        🗑️
      </button>
    </article>
  );
}

/* ─── Outbound expired row ──────────────────────────────────── */

function ExpiredOutboundRow({
  invite,
  onDismiss,
}: {
  readonly invite: PendingInvite;
  readonly onDismiss: () => void;
}): React.ReactElement {
  return (
    <article
      data-nex-contacts-expired-row
      data-nex-contacts-expired-nexid={invite.nexId}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: "2px 48px 2px 70px",
        width: "100%",
        boxSizing: "border-box",
        background: NEX.bgPanel,
        border: `1.5px dashed ${NEX.textMute}`,
        borderRadius: 10,
        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        color: NEX.text,
        overflow: "visible",
        marginTop: 14,
        opacity: 0.8,
      }}
    >
      {/* Expired chip · full-red rim · no time text (window finished). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -24,
          left: 12,
          width: 48,
          height: 48,
          flexShrink: 0,
          zIndex: 2,
          borderRadius: "50%",
          border: `2px solid ${NEX.unreadRed}`,
          background: "#000000",
          display: "grid",
          placeItems: "center",
          boxShadow: `0 2px 8px rgba(0,0,0,0.5)`,
        }}
      >
        <span
          style={{
            color: NEX.unreadRed,
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          ✕
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "relative",
          zIndex: 1,
          transform: "translateY(-12px)",
        }}
      >
        <div
          data-nex-contacts-expired-row-nexid
          style={{
            /* Owner directive 2026-10-24 · span-mask treatment. */
            fontSize: 15,
            fontWeight: 800,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            letterSpacing: 0.4,
          }}
        >
          <span
            style={{
              display: "inline-block",
              background: NEX.bgNavy,
              color: NEX.textMute,
              padding: "0 6px",
              lineHeight: 1.2,
            }}
          >
            {invite.nexId.toUpperCase()}
          </span>
        </div>
        <span
          data-nex-contacts-expired-status
          style={{
            color: NEX.unreadRed,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: "uppercase",
          }}
        >
          Invitation expired
        </span>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        data-nex-contacts-expired-dismiss
        aria-label={`Dismiss expired invitation to ${invite.nexId}`}
        style={{
          position: "absolute",
          top: "50%",
          right: 10,
          transform: "translateY(-50%)",
          width: 32,
          height: 32,
          display: "grid",
          placeItems: "center",
          fontSize: 26,
          lineHeight: 1,
          padding: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          WebkitTapHighlightColor: "transparent",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
          zIndex: 2,
        }}
      >
        🗑️
      </button>
    </article>
  );
}

/* ─── Confirm-category modal ────────────────────────────────── */
//
// Owner directive 2026-10-23 · "when the user select the confirm
// button they will see pop up asking then which category to save
// their new contact to - Contacts - Business". Lightweight dialog
// portalled visually over the contacts page via position:fixed +
// a dimmed backdrop. Shows the sender's chip + name so the user
// knows WHO they're saving, then two full-width tappable options.
// Backdrop click + Escape key both cancel.

function ConfirmCategoryModal({
  invite,
  onSelect,
  onCancel,
}: {
  readonly invite: PendingInvite;
  readonly onSelect: (category: "friends" | "business") => void;
  readonly onCancel: () => void;
}): React.ReactElement {
  const identity = invite.senderIdentity ?? null;
  const displayName = identity?.displayName ?? invite.nexId.toUpperCase();
  const initials =
    identity?.initials && identity.initials.trim().length > 0
      ? identity.initials.toUpperCase()
      : inboundInitialsFromName(displayName);

  // Escape-key dismiss · attached while modal is open.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save contact category"
      data-nex-contacts-category-modal
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 320,
          padding: "18px 18px 14px",
          borderRadius: 16,
          background: NEX.bgPanel,
          border: `1.5px solid ${NEX.cyan}`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 24px ${NEX.cyan}22`,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Owner directive 2026-10-23 · "header Text - Save Contact" ·
            modal title sits at the top of the dialog · 15/800 white ·
            matches the section-header rhythm elsewhere on the page. */}
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 800,
            color: NEX.text,
            letterSpacing: 0.2,
            lineHeight: 1.2,
          }}
        >
          Save Contact
        </h3>

        {/* Sender identity row · chip + name · reminds the user who
            they're about to save (now sits below the Save Contact
            title · no "Save as…" subtitle duplication). */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              overflow: "hidden",
              border: `2px solid ${NEX.cyan}`,
              background: `linear-gradient(135deg, ${NEX.cyan}cc 0%, #180012 65%, #050F1E 100%)`,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            {identity?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={identity.avatarUrl}
                alt=""
                aria-hidden
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span
                style={{
                  color: "#FFF",
                  fontSize: 14,
                  fontWeight: 900,
                  letterSpacing: "0.04em",
                }}
              >
                {initials}
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: NEX.text,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </div>
          </div>
        </div>

        {/* Owner directive 2026-10-23 · "the pop up container for
            confirm the buttons should be 1 row - Contacts - Business" ·
            two category options side-by-side (flex row, equal width)
            instead of stacked. One-tap decision. */}
        <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
          <button
            type="button"
            onClick={() => onSelect("friends")}
            data-nex-contacts-category-friends
            style={{
              flex: 1,
              minWidth: 0,
              height: 40,
              padding: "0 10px",
              borderRadius: 10,
              background: `linear-gradient(135deg, ${NEX.cyan}, ${NEX.cyan}cc)`,
              border: `1px solid ${NEX.cyan}`,
              color: "#07140A",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: `0 2px 10px ${NEX.cyan}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>👥</span>
            Contacts
          </button>
          <button
            type="button"
            onClick={() => onSelect("business")}
            data-nex-contacts-category-business
            style={{
              flex: 1,
              minWidth: 0,
              height: 40,
              padding: "0 10px",
              borderRadius: 10,
              background: "transparent",
              border: `1px solid ${NEX.cyan}`,
              color: NEX.text,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>💼</span>
            Business
          </button>
        </div>

        {/* Cancel · tertiary · tap to close without saving. */}
        <button
          type="button"
          onClick={onCancel}
          data-nex-contacts-category-cancel
          style={{
            marginTop: 2,
            padding: "6px 0",
            background: "transparent",
            border: "none",
            color: NEX.textMute,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Inbound pending row ───────────────────────────────────── */

function InboundInviteRow({
  invite,
  now,
  onAccept,
}: {
  readonly invite: PendingInvite;
  readonly now: Date;
  readonly onAccept: () => void;
}): React.ReactElement {
  // Owner directive 2026-10-23 revised · "it only starts at 60m
  // down and heart beat like ping timing" · urgency window tightened
  // from 2h → 1h · the chip only pulses + the minutes-only countdown
  // only appears in the last hour of the 24h window. Heartbeat keeps
  // the sealed presence-ping cadence (1200ms cubic-bezier) so the
  // chip beats at the same rhythm as an online contact's live ping.
  const PENDING_URGENT_THRESHOLD_MS = 60 * 60 * 1000;
  const msLeft = invitationMsLeft(invite, now);
  const isUrgent = msLeft > 0 && msLeft < PENDING_URGENT_THRESHOLD_MS;
  // Owner directive 2026-10-23 (revised) · "the invitations cards
  // should be exactly same as the contacts card design style - with
  // button small outside the card top right side with Confirm" ·
  // the inbound row now mirrors `_contact-row.tsx` BYTE-FOR-BYTE
  // (same cyan rim, cyan chip gradient, name + profession + city
  // chrome, zero extra decorations) · the ONLY differentiator is a
  // small Confirm button floated OUTSIDE the card at the top-right
  // (overlapping the top rim mirroring the chip at top-left).
  // Doctrine: the recipient has no explicit decline button · letting
  // the invite expire IS the pass · honours the sealed "sender never
  // sees decline vs timeout" rule perfectly.
  const identity = invite.senderIdentity ?? null;
  const displayName = identity?.displayName ?? invite.nexId.toUpperCase();
  const initials =
    identity?.initials && identity.initials.trim().length > 0
      ? identity.initials.toUpperCase()
      : inboundInitialsFromName(displayName);
  // Owner directive 2026-10-23 · "their profile image" · if the
  // avatar URL fails to load (offline, blocked, 404) the chip falls
  // back to initials rather than showing a broken-image glyph.
  const [avatarFailed, setAvatarFailed] = React.useState(false);
  const showAvatar =
    identity?.avatarUrl != null && identity.avatarUrl.length > 0 && !avatarFailed;

  return (
    <article
      data-nex-contacts-inbound-row
      data-nex-contacts-inbound-nexid={invite.nexId}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        // Match contacts-card padding byte-for-byte (2px 48px 2px 70px) ·
        // the 48px right slot is reserved for the shop marker when
        // the sender has one · empty slot otherwise. Confirm button
        // floats OUTSIDE the card at top:-14 so it never competes.
        padding: "2px 48px 2px 70px",
        width: "100%",
        boxSizing: "border-box",
        background: NEX.bgPanel,
        // Cyan rim · same as the My Contacts row chrome · the floating
        // Confirm button carries the "invitation" semantic, not the rim.
        border: `1.5px solid ${NEX.cyan}`,
        borderRadius: 10,
        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        color: NEX.text,
        overflow: "visible",
        marginTop: 14,
      }}
    >
      {/* Chip · 48×48 round · cyan gradient + rim · initials
          centred · same geometry as `_contact-row.tsx` byte-for-byte.
          Owner directive 2026-10-23 · "if the user select the profile
          image on the cards invitations it will open the users
          profile page" · chip wrapper is now a `<a>` link routing
          to `/nex-native/u/[nexId]` · the sealed canonical NEX user
          profile URL. Confirm button sits above the top-right rim
          and stops click propagation so chip-tap and Confirm-tap
          never fire together. */}
      <a
        href={`/nex-native/u/${invite.nexId}`}
        aria-label={`Open ${displayName}'s NEX profile`}
        data-nex-contacts-inbound-chip-link
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          top: -24,
          left: 12,
          width: 48,
          height: 48,
          flexShrink: 0,
          zIndex: 2,
          display: "block",
          textDecoration: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${NEX.cyan}`,
            overflow: "hidden",
            background: `linear-gradient(135deg, ${NEX.cyan}cc 0%, #180012 65%, #050F1E 100%)`,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {showAvatar ? (
            <img
              src={identity!.avatarUrl!}
              alt=""
              aria-hidden
              onError={() => setAvatarFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span
              style={{
                color: "#FFF",
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: "0.04em",
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              }}
            >
              {initials}
            </span>
          )}
        </div>
        {/* Urgency heartbeat · pulsing dark-red ring around the chip
            when <2h remain · owner directive 2026-10-23 · "count down
            under profile heart beat from last 2 hour in red color
            dark". Reuses the sealed heartbeat animation shape from
            `_contact-row.tsx` · colour is unreadRed (#B30000). */}
        {isUrgent ? (
          <div
            aria-hidden
            data-nex-contacts-inbound-urgent-heartbeat
            style={{
              position: "absolute",
              inset: -3,
              borderRadius: "50%",
              border: `2px solid ${NEX.unreadRed}`,
              animation:
                "nex-contacts-inbound-urgent-heartbeat 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
              pointerEvents: "none",
            }}
          />
        ) : null}
      </a>
      {isUrgent ? (
        <style>{`
          @keyframes nex-contacts-inbound-urgent-heartbeat {
            0%   { transform: scale(1);    opacity: 0.9; }
            75%  { transform: scale(1.35); opacity: 0; }
            100% { transform: scale(1.35); opacity: 0; }
          }
        `}</style>
      ) : null}

      {/* Digital countdown under the chip · owner directive 2026-10-23
          revised "60m 59m 58m" format · minutes-only ticks (60m,
          59m, ..., 1m, 0m) in the urgent window (<1h left). Owner
          revision "enlarge size" · fontSize 12 → 15 · reads boldly
          under the pulsing chip without overflowing the 48px column. */}
      {isUrgent ? (
        <div
          aria-live="polite"
          data-nex-contacts-inbound-urgent-time
          style={{
            position: "absolute",
            top: 36,
            left: 12,
            width: 48,
            textAlign: "center",
            fontSize: 15,
            fontWeight: 900,
            color: NEX.unreadRed,
            letterSpacing: 0.4,
            lineHeight: 1,
            pointerEvents: "none",
            zIndex: 3,
            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
            whiteSpace: "nowrap",
          }}
        >
          {Math.max(0, Math.floor(msLeft / 60000))}m
        </div>
      ) : null}

      {/* Identity column · name + verified pill · profession · city
          with map pin · translateY lifts the whole block above the
          rim · byte-identical to `_contact-row.tsx`. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "relative",
          zIndex: 1,
          transform: "translateY(-12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          <div
            data-nex-contacts-inbound-row-name
            style={{
              /* Owner directive 2026-10-24 · span-mask treatment. */
              fontSize: 15,
              fontWeight: 800,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: 0.2,
            }}
          >
            <span
              style={{
                display: "inline-block",
                background: NEX.bgNavy,
                color: NEX.text,
                padding: "0 6px",
                lineHeight: 1.2,
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </span>
          </div>
          {identity?.isVerified ? (
            <span
              aria-label="Verified"
              title="Verified NEX account"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#FFD700",
                color: NEX.bgNavy,
                fontSize: 9,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              ✓
            </span>
          ) : null}
        </div>
        {identity?.profession ? (
          <div
            data-nex-contacts-inbound-row-profession
            style={{
              fontSize: 11,
              color: NEX.textMute,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {identity.profession}
          </div>
        ) : null}
        {identity?.city ? (
          <div
            data-nex-contacts-inbound-row-location
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: NEX.textMute,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <InboundMapPinIcon color={NEX.unreadRed} />
            <span>{identity.city}</span>
          </div>
        ) : null}
        {/* Owner-authorised 2026-10-24 · Contact Connect intro note.
            Renders under the location line · "Message" eyebrow +
            the sender's note (160-char-capped, newlines squashed,
            inline emoji typed from the OS keyboard renders natively).
            Private pre-accept · only the recipient sees it. */}
        {invite.note ? (
          <div
            data-nex-contacts-inbound-row-note
            style={{
              marginTop: 2,
              padding: "6px 8px",
              borderRadius: 8,
              background: "rgba(0,175,255,0.08)",
              border: `1px solid ${NEX.cyan}22`,
              lineHeight: 1.35,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: 0.6,
                color: NEX.cyan,
                textTransform: "uppercase",
                marginBottom: 1,
              }}
            >
              Message
            </div>
            <div
              style={{
                fontSize: 11,
                color: NEX.text,
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}
            >
              {invite.note}
            </div>
          </div>
        ) : null}
      </div>

      {/* Shop marker · right slot · owner directive 2026-10-23
          "shop if they have icon" + "move down the cart little" ·
          same 32×32 chrome as the 🛒 marker on accepted contact rows
          but positioned lower on the card (top:65%, translateY(-50%))
          so the floating Confirm button at the top-right rim has
          clear breathing room above. Tap routes to the sender's
          shop at `/nex-native/shop-share-demo/[nexId]`. */}
      {identity?.hasShop && identity.shopHref ? (
        <a
          href={identity.shopHref}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Open ${displayName} shop`}
          title={`Open ${displayName} shop`}
          data-nex-contacts-inbound-shop-marker
          style={{
            position: "absolute",
            top: "65%",
            right: 10,
            transform: "translateY(-50%)",
            width: 32,
            height: 32,
            display: "grid",
            placeItems: "center",
            fontSize: 26,
            lineHeight: 1,
            zIndex: 2,
            cursor: "pointer",
            color: "inherit",
            textDecoration: "none",
            WebkitTapHighlightColor: "transparent",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
          }}
        >
          🛒
        </a>
      ) : null}

      {/* Floating Confirm button · OUTSIDE the card top-right ·
          mirrors the chip at top-left (both overlap the card's top
          rim). Small green pill · one tap accepts the invitation.
          Positioned with top:-14 so half the pill sits above the
          card border · matches the chip's top:-24 overlap rhythm. */}
      <button
        type="button"
        onClick={onAccept}
        data-nex-contacts-inbound-confirm
        aria-label={`Confirm invitation from ${displayName}`}
        style={{
          position: "absolute",
          top: -14,
          right: 10,
          padding: "4px 12px",
          borderRadius: 999,
          background: `linear-gradient(135deg, ${NEX.acceptGreen}, ${NEX.acceptGreen}cc)`,
          border: `1px solid ${NEX.acceptGreen}`,
          color: "#07140A",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: `0 2px 6px ${NEX.acceptGreen}66`,
          zIndex: 3,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        Confirm
      </button>
    </article>
  );
}

/* ─── Inbound group invite row ──────────────────────────────── */
//
// Owner directive 2026-10-23 · Private Groups contract rev 3 §4
// Decision 6 · group invites render under the same inbound header
// as friend invites. Visually: same card chrome · same chip-at-
// top-left + Confirm-at-top-right rhythm · but the eyebrow line
// reads "GROUP INVITE" (cyan 10/900 letterSpaced) and the body
// swaps NEX-ID → group name. Pass is explicit here (small 🗑 at
// the right rim) because refusing a group invite records a
// per-group-instance block (§3.2) · we want the user's intent to
// be clear, not inferred from timeout alone.

function InboundGroupInviteRow({
  invite,
  now,
  onAccept,
  onRefuse,
}: {
  readonly invite: MockGroupInvite;
  readonly now: Date;
  readonly onAccept: () => void;
  readonly onRefuse: () => void;
}): React.ReactElement {
  const PENDING_URGENT_THRESHOLD_MS = 60 * 60 * 1000;
  const msLeft = groupInvitationMsLeft(invite, now);
  const isUrgent = msLeft > 0 && msLeft < PENDING_URGENT_THRESHOLD_MS;
  const inviterName = invite.inviterDisplayName;
  const initials = inboundInitialsFromName(inviterName);
  const [avatarFailed, setAvatarFailed] = React.useState(false);
  const showAvatar =
    invite.inviterAvatarUrl != null &&
    invite.inviterAvatarUrl.length > 0 &&
    !avatarFailed;

  return (
    <article
      data-nex-contacts-inbound-group-row
      data-nex-contacts-inbound-group-id={invite.groupId}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: "2px 48px 2px 70px",
        width: "100%",
        boxSizing: "border-box",
        background: NEX.bgPanel,
        border: `1.5px solid ${NEX.cyan}`,
        borderRadius: 10,
        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        color: NEX.text,
        overflow: "visible",
        marginTop: 14,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -24,
          left: 12,
          width: 48,
          height: 48,
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${NEX.cyan}`,
            overflow: "hidden",
            background: `linear-gradient(135deg, ${NEX.cyan}cc 0%, #180012 65%, #050F1E 100%)`,
            display: "grid",
            placeItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {showAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={invite.inviterAvatarUrl!}
              alt=""
              aria-hidden
              onError={() => setAvatarFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span
              style={{
                color: "#FFF",
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: "0.04em",
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
              }}
            >
              {initials}
            </span>
          )}
        </div>
        {isUrgent ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -3,
              borderRadius: "50%",
              border: `2px solid ${NEX.unreadRed}`,
              animation:
                "nex-contacts-inbound-urgent-heartbeat 1200ms cubic-bezier(0.4,0,0.2,1) infinite",
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>

      {isUrgent ? (
        <div
          aria-live="polite"
          data-nex-contacts-inbound-group-urgent-time
          style={{
            position: "absolute",
            top: 36,
            left: 12,
            width: 48,
            textAlign: "center",
            fontSize: 15,
            fontWeight: 900,
            color: NEX.unreadRed,
            letterSpacing: 0.4,
            lineHeight: 1,
            pointerEvents: "none",
            zIndex: 3,
            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
            whiteSpace: "nowrap",
          }}
        >
          {Math.max(0, Math.floor(msLeft / 60000))}m
        </div>
      ) : null}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          position: "relative",
          zIndex: 1,
          transform: "translateY(-12px)",
        }}
      >
        <div
          data-nex-contacts-inbound-group-eyebrow
          style={{
            /* Owner directive 2026-10-24 · "same size text as if it
               was name" · 15/800 scale, cyan tint. Inner <span>
               carries a solid shell-navy background so the cyan rim
               line behind the text is MASKED (owner directive 2026-
               10-24 · "remove the container line from behind the
               text sitting on the line"). The span uses display:
               inline-block so the background only covers the text,
               not the whole 100%-wide row. */
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 0.2,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <span
            style={{
              display: "inline-block",
              background: NEX.bgNavy,
              color: NEX.cyan,
              padding: "0 6px",
              lineHeight: 1.2,
            }}
          >
            Group invite
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          <div
            data-nex-contacts-inbound-group-name
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: NEX.text,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: 0.2,
            }}
          >
            {invite.groupName}
          </div>
          {invite.inviterIsVerified ? (
            <span
              aria-label="Verified"
              title="Verified NEX account"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#FFD700",
                color: NEX.bgNavy,
                fontSize: 9,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              ✓
            </span>
          ) : null}
        </div>
        <div
          data-nex-contacts-inbound-group-inviter
          style={{
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          from {inviterName}
        </div>
      </div>

      {/* Pass · 🗑 at the right rim · smaller than the Confirm pill
          so Confirm reads as the primary action. One tap records
          a per-group-instance block (contract §3.2). */}
      <button
        type="button"
        onClick={onRefuse}
        data-nex-contacts-inbound-group-refuse
        aria-label={`Pass on invite to ${invite.groupName}`}
        title="Pass"
        style={{
          position: "absolute",
          top: "65%",
          right: 10,
          transform: "translateY(-50%)",
          width: 28,
          height: 28,
          display: "grid",
          placeItems: "center",
          fontSize: 20,
          lineHeight: 1,
          padding: 0,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          WebkitTapHighlightColor: "transparent",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
          zIndex: 2,
        }}
      >
        🗑️
      </button>

      <button
        type="button"
        onClick={onAccept}
        data-nex-contacts-inbound-group-confirm
        aria-label={`Confirm invite to ${invite.groupName}`}
        style={{
          position: "absolute",
          top: -14,
          right: 10,
          padding: "4px 12px",
          borderRadius: 999,
          background: `linear-gradient(135deg, ${NEX.acceptGreen}, ${NEX.acceptGreen}cc)`,
          border: `1px solid ${NEX.acceptGreen}`,
          color: "#07140A",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: `0 2px 6px ${NEX.acceptGreen}66`,
          zIndex: 3,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        Confirm
      </button>
    </article>
  );
}

function inboundInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function InboundMapPinIcon({ color }: { readonly color: string }) {
  return (
    <svg
      aria-hidden
      width={10}
      height={10}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0, display: "block" }}
    >
      <path
        fill={color}
        d="M12 2c-4.418 0-8 3.582-8 8 0 5.25 7 12 7.4 12.3a1 1 0 0 0 1.2 0C13 22 20 15.25 20 10c0-4.418-3.582-8-8-8zm0 10.75a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5z"
      />
    </svg>
  );
}

/* ─── Progress arc (shared) ─────────────────────────────────── */

function ProgressArc({
  percent,
  color,
}: {
  readonly percent: number;
  readonly color: string;
}): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const strokeLen = (circumference * clamped) / 100;
  return (
    <svg
      aria-hidden
      viewBox="0 0 48 48"
      width={48}
      height={48}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
    >
      <circle
        cx={24}
        cy={24}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={`${strokeLen} ${circumference}`}
        transform="rotate(-90 24 24)"
        style={{ filter: `drop-shadow(0 0 4px ${color}99)` }}
      />
    </svg>
  );
}

/* ─── Section icons ─────────────────────────────────────────── */

function WaitingClockIcon({ color }: { readonly color: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function EnvelopeIcon({ color }: { readonly color: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </svg>
  );
}
