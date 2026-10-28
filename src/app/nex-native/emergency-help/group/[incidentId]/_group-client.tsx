"use client";

// src/app/nex-native/emergency-help/group/[incidentId]/_group-client.tsx
//
// Emergency responder group · prototype. See page.tsx header for the
// sealed owner directive 2026-10-25. All data below is illustrative ·
// no realtime, no persistence, no composer wiring in this phase.

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NexTextarea } from "@/lib/nex-native/nex-keyboard/nex-textarea";
import { useGroupCountdown } from "@/lib/nex-native/emergency/_group-countdown";
import { isEmergencyFlagOn } from "@/lib/nex-native/emergency/_feature-flags";
import {
  flagServerAction,
  resolveServerAction,
  withdrawServerAction,
} from "@/app/nex-native/emergency-help/_actions";

// Owner directive 2026-10-25 · match the sealed NEX themes-marketplace
// side drawer palette so the Group menu feels like part of NEX chrome.
// Pulled byte-equivalent from
// src/app/nex-native/chat-themes-library/_marketplace-side-drawer.tsx
const NEX_DRAWER = {
  bg: "#020914",
  // Owner directive 2026-10-25 · solid dark-navy drawer panel.
  // Opaque so no colour from the Crimson Beacon background bleeds
  // through on the group surface.
  panel: "#06101E",
  scrim: "rgba(2, 9, 20, 0.72)",
  text: "#F2F5F8",
  textMuted: "#7D9BC0",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
  gold: "#FFC24A",
  goldSoft: "rgba(255, 194, 74, 0.45)",
  borderSoft: "rgba(255, 255, 255, 0.08)",
  cardBg: "rgba(255,255,255,0.02)",
} as const;

const NEX = {
  bg: "#060108",
  surface: "rgba(10, 2, 8, 0.78)",
  surfaceSoft: "rgba(255, 255, 255, 0.06)",
  text: "#F2F5F8",
  textDim: "#C8D4E8",
  textMuted: "#8EA0B8",
  red: "#FF3355",
  redDeep: "#8B1A1A",
  cyan: "#00AFFF",
  gold: "#FFC24B",
  green: "#2BD47F",
  border: "rgba(255, 51, 85, 0.42)",
  borderCyan: "rgba(0, 175, 255, 0.3)",
} as const;

const PLACEHOLDER = {
  memberName: "Member's Name",
  nexId: "NEX-00000",
  age: 34,
  sex: "Female",
  locationLabel: "Last recorded location",
  locationAddress: "Jl. Malioboro, Yogyakarta · Indonesia",
  locationCoords: "-7.792900, 110.365600",
  mapsUrl: "https://www.google.com/maps?q=-7.792900,110.365600",
  // Owner directive 2026-10-25 · member mobile wired into the drawer's
  // "Call the member" action · prototype value only.
  memberMobile: "+6281234567890",
  ipAddress: "203.0.113.42",
  timeLabel: "Date 00-00-0000 - 00-00pm",
  // Current viewer · the person who just tapped "I will help"
  viewerName: "You",
  viewerNexId: "NEX-11111",
};

// Owner directive 2026-10-25 · the local 24h countdown + its
// `formatRemaining` helper have been retired · every surface that
// shows the group's expiry (hero text, drawer "Expires in" line,
// pinned contacts card) reads from `useGroupCountdown` so a single
// clock ticks everywhere. See _group-countdown.ts.

export interface EmergencyGroupClientProps {
  readonly incidentId: string;
}

// Owner directive 2026-10-25 · one Updates post · prototype shape.
// The real backend will materialise this from an `emergency_group_post`
// table with author_account_id + content + flagged_at + review_state.
interface UpdateEntry {
  readonly id: string;
  readonly authorName: string;
  readonly authorNexId: string;
  readonly isActivator: boolean;
  readonly createdAt: string;
  readonly body: string;
}

function formatRelativeTime(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diffSec = Math.max(0, Math.floor((now - t) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ${diffMin % 60}m ago`;
}

export function EmergencyGroupClient(
  props: EmergencyGroupClientProps,
): React.JSX.Element {
  // Owner directive 2026-10-25 · the Alert Screen passes which action
  // the helper took via ?action=help|police. The group then posts the
  // helper's identity card + the matching system message. Unknown or
  // missing values fall back to the generic "joined" copy so legacy
  // links keep working.
  const router = useRouter();
  const sp = useSearchParams();
  const actionRaw = sp?.get("action") ?? "";
  const action: "help" | "police" | "joined" =
    actionRaw === "police"
      ? "police"
      : actionRaw === "help"
        ? "help"
        : "joined";

  // Owner directive 2026-10-25 · shared 24h clock · one source of
  // truth across the hero, drawer, and pinned-card countdowns. See
  // _group-countdown.ts for the sessionStorage anchor.
  const { label: remainingLabel } = useGroupCountdown();
  // UpdateCard relative-time formatter still needs a ticking "now"
  // in millis · reuse a cheap 1s interval here.
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // 3-dots side drawer · owner directive 2026-10-25.
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Owner directive 2026-10-25 · world-standard drawer actions:
  //   Mark as safe       → resolveServerAction + resolved banner
  //   Share location     → window.open(mapsUrl)
  //   Call the member    → tel: link via memberMobile
  //   Report false alarm → flagServerAction + toast
  //   Leave group        → withdrawServerAction + /contacts
  const [resolved, setResolved] = React.useState(false);
  const [reportedToast, setReportedToast] = React.useState(false);
  const [actionBusy, setActionBusy] = React.useState<
    "resolve" | "flag" | "leave" | null
  >(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const reportToastTimerRef = React.useRef<number | null>(null);

  // Dismiss the "Reported" toast after a short window. Clean up on
  // unmount so a navigation-mid-timeout doesn't fire into a dead tree.
  React.useEffect(() => {
    if (!reportedToast) return;
    reportToastTimerRef.current = window.setTimeout(
      () => setReportedToast(false),
      3500,
    );
    return () => {
      if (reportToastTimerRef.current !== null) {
        window.clearTimeout(reportToastTimerRef.current);
        reportToastTimerRef.current = null;
      }
    };
  }, [reportedToast]);

  const handleMarkAsSafe = React.useCallback(async () => {
    if (actionBusy !== null) return;
    setActionBusy("resolve");
    setActionError(null);
    try {
      await resolveServerAction(props.incidentId);
      setResolved(true);
      setDrawerOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error");
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, props.incidentId]);

  const handleShareLocation = React.useCallback(() => {
    setDrawerOpen(false);
    if (typeof window !== "undefined") {
      window.open(PLACEHOLDER.mapsUrl, "_blank", "noopener,noreferrer");
    }
  }, []);

  const handleCallMember = React.useCallback(() => {
    setDrawerOpen(false);
    if (typeof window !== "undefined") {
      window.location.href = `tel:${PLACEHOLDER.memberMobile}`;
    }
  }, []);

  const handleReportFalseAlarm = React.useCallback(async () => {
    if (actionBusy !== null) return;
    setActionBusy("flag");
    setActionError(null);
    try {
      await flagServerAction(props.incidentId);
      setReportedToast(true);
      setDrawerOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error");
    } finally {
      setActionBusy(null);
    }
  }, [actionBusy, props.incidentId]);

  const handleLeaveGroup = React.useCallback(async () => {
    if (actionBusy !== null) return;
    setActionBusy("leave");
    setActionError(null);
    try {
      await withdrawServerAction(props.incidentId);
      router.push("/nex-native/contacts");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error");
      setActionBusy(null);
    }
  }, [actionBusy, props.incidentId, router]);

  // Owner directive 2026-10-25 · Updates composer. Prototype state ·
  // posts live in memory only. The activator's first post is pinned
  // (cyan rim) so the person in trouble stays legible when the thread
  // fills. See the owner's agreed tradeoff: no moderation layer yet ·
  // every post can be flagged via the inline Report chip.
  const [updates, setUpdates] = React.useState<ReadonlyArray<UpdateEntry>>(() => [
    {
      id: "u-activator",
      authorName: PLACEHOLDER.memberName,
      authorNexId: PLACEHOLDER.nexId,
      isActivator: true,
      createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      body:
        "I'm by the Malioboro market, outside the pharmacy. Can't move my leg. Please come.",
    },
    {
      id: "u-rina",
      authorName: "Rina Pratama",
      authorNexId: "NEX-20394",
      isActivator: false,
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      body: "I'm 2 minutes away by motorbike. Coming now.",
    },
    {
      id: "u-agus",
      authorName: "Agus Wijaya",
      authorNexId: "NEX-18827",
      isActivator: false,
      createdAt: new Date(Date.now() - 30 * 1000).toISOString(),
      body: "Police dispatched · ETA 7 minutes.",
    },
  ]);
  const [draft, setDraft] = React.useState("");

  const postUpdate = React.useCallback((): void => {
    const body = draft.trim();
    if (body.length === 0) return;
    setUpdates((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        authorName: PLACEHOLDER.viewerName,
        authorNexId: PLACEHOLDER.viewerNexId,
        isActivator: false,
        createdAt: new Date().toISOString(),
        body,
      },
    ]);
    setDraft("");
  }, [draft]);

  // Pin activator posts to the top, then chronological order for the rest.
  const sortedUpdates = React.useMemo(() => {
    const pinned = updates.filter((u) => u.isActivator);
    const rest = updates
      .filter((u) => !u.isActivator)
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return [...pinned, ...rest];
  }, [updates]);

  return (
    <main
      data-nex-emergency-group
      data-testid="nex-emergency-group"
      style={{
        minHeight: "100%",
        backgroundColor: NEX.bg,
        backgroundImage:
          "linear-gradient(180deg, rgba(6, 2, 8, 0.78) 0%, rgba(6, 2, 8, 0.5) 32%, rgba(6, 2, 8, 0.58) 60%, rgba(6, 2, 8, 0.88) 100%), url(/nex-emergency/countdown-background.png)",
        backgroundSize: "100% 100%, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding:
          "max(20px, env(safe-area-inset-top, 0px)) 20px calc(env(safe-area-inset-bottom, 0px) + 20px)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <style>{`
        @keyframes nexEmergencyGroupPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(43, 212, 127, 0.45); }
          50%      { box-shadow: 0 0 0 10px rgba(43, 212, 127, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-nex-emergency-group] * { animation: none !important; }
        }
      `}</style>

      {/* Owner directive 2026-10-25 · 14px header on the left, vertical
          3-dots on the right · plain icon-button, no background. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 32,
        }}
      >
        <div
          style={{
            flex: 1,
            // Owner directive 2026-10-25 · "NEX" prefix dropped + text
            // enlarged from 14 → 20px so the group label reads as a
            // proper hero on the left side of the header row.
            fontSize: 20,
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: "0.01em",
            color: NEX.red,
            textShadow: "0 2px 10px rgba(255, 51, 85, 0.5)",
          }}
        >
          Emergency Group
        </div>
        <button
          type="button"
          data-testid="nex-emergency-group-drawer-trigger"
          aria-label="Open group menu"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          style={{
            // Owner directive 2026-10-25 · dots now white + a touch
            // larger · touch target bumped from 32 → 36.
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            background: "transparent",
            border: "none",
            color: "#FFFFFF",
            cursor: "pointer",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
            fontFamily: "inherit",
            padding: 0,
          }}
        >
          <DotsIcon size={24} />
        </button>
      </div>

      {drawerOpen ? (
        <GroupDrawer
          onClose={() => setDrawerOpen(false)}
          remainingLabel={remainingLabel}
          resolved={resolved}
          actionBusy={actionBusy}
          onMarkAsSafe={() => void handleMarkAsSafe()}
          onShareLocation={handleShareLocation}
          onCallMember={handleCallMember}
          onReportFalseAlarm={() => void handleReportFalseAlarm()}
          onLeaveGroup={() => void handleLeaveGroup()}
        />
      ) : null}

      {/* Owner directive 2026-10-25 · resolved banner shows when the
          activator (or NEX HQ) marks the incident safe. Composer and
          Updates post button disable from here; the Close button
          below switches to a solid green "Return to contacts" CTA. */}
      {resolved ? (
        <div
          data-testid="nex-emergency-group-resolved"
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            background: "rgba(43, 212, 127, 0.14)",
            border: `1px solid ${NEX.green}`,
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 10px 24px -10px rgba(43, 212, 127, 0.45)",
          }}
        >
          <span aria-hidden style={{ color: NEX.green, fontSize: 18, lineHeight: 1 }}>
            ✓
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>
              Marked safe
            </div>
            <div style={{ fontSize: 12, color: NEX.textDim, marginTop: 2 }}>
              This emergency has been resolved by the member. The group
              will close shortly.
            </div>
          </div>
        </div>
      ) : null}

      {actionError !== null ? (
        <div
          data-testid="nex-emergency-group-action-error"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(255, 51, 85, 0.12)",
            border: "1px solid rgba(255, 51, 85, 0.4)",
            fontSize: 12,
            color: "#FFBAC5",
            textAlign: "center",
          }}
        >
          {actionError}
        </div>
      ) : null}

      {/* Owner directive 2026-10-25 · hero area · "Group Expires 19.59".
          Centered, large, red — the single prominent lifetime signal
          now that the green activation banner has been retired. Static
          placeholder time in prototype · will swap to the real expiry
          clock when the backend lands. */}
      <div
        data-testid="nex-emergency-group-expiry-hero"
        style={{
          padding: "16px 14px",
          textAlign: "center",
          fontSize: 22,
          fontWeight: 900,
          lineHeight: 1.1,
          letterSpacing: "0.01em",
          color: "#FFFFFF",
          textShadow: "0 2px 14px rgba(255, 51, 85, 0.55)",
        }}
      >
        Group Expires{" "}
        <span style={{ color: NEX.red }}>{remainingLabel}</span>
      </div>

      {/* Owner directive 2026-10-25 · "Person Needs Help" heading
          replaces the earlier Contacts-pin helper line · reads as a
          section header introducing the member identity card below. */}
      <h2
        data-testid="nex-emergency-group-person-heading"
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 900,
          lineHeight: 1.1,
          letterSpacing: "0.01em",
          textAlign: "center",
          color: "#FFFFFF",
          textShadow: "0 2px 10px rgba(255, 51, 85, 0.5)",
        }}
      >
        Person Needs Help
      </h2>

      {/* Member identity card · same shape as the Alert Screen */}
      <div
        data-nex-group-identity
        style={{
          padding: "16px 16px 18px",
          borderRadius: 16,
          background: NEX.surface,
          border: `1px solid ${NEX.border}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(255, 51, 85, 0.35), rgba(139, 26, 26, 0.65))",
              border: `2px solid ${NEX.red}`,
              display: "grid",
              placeItems: "center",
              color: "#FFFFFF",
            }}
          >
            <PersonIcon size={36} />
          </div>
          <div
            data-testid="nex-group-member-name"
            style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.01em" }}
          >
            {PLACEHOLDER.memberName}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: NEX.textDim,
              letterSpacing: "0.04em",
            }}
          >
            Age {PLACEHOLDER.age} · {PLACEHOLDER.sex}
          </div>
          <div
            data-testid="nex-group-member-nex-id"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: NEX.gold,
              letterSpacing: "0.08em",
              fontFamily:
                "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
            }}
          >
            NEX ID: {PLACEHOLDER.nexId}
          </div>
        </div>

        <div
          aria-hidden
          style={{
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
            margin: "4px 0 2px",
          }}
        />

        <div>
          <div style={styleEyebrow}>
            <MapPinIcon size={13} />
            {PLACEHOLDER.locationLabel}
          </div>
          <div
            style={{
              fontSize: 13.5,
              color: NEX.text,
              lineHeight: 1.4,
              marginBottom: 2,
            }}
          >
            {PLACEHOLDER.locationAddress}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: NEX.textDim,
              lineHeight: 1.4,
              marginBottom: 6,
              fontFamily:
                "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
            }}
          >
            {PLACEHOLDER.locationCoords}
          </div>
          <a
            data-testid="nex-group-maps-link"
            href={PLACEHOLDER.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={styleMapsBtn}
          >
            Share location on Google Maps
            <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>→</span>
          </a>
        </div>

        <div>
          <div style={styleEyebrow}>Last-known IP</div>
          <div style={styleMono}>{PLACEHOLDER.ipAddress}</div>
        </div>

        <div>
          <div style={styleEyebrow}>Date and time</div>
          <div style={{ fontSize: 13.5, color: NEX.textDim, lineHeight: 1.4 }}>
            {PLACEHOLDER.timeLabel}
          </div>
        </div>
      </div>

      {/* Owner directive 2026-10-25 · "Helping" header + list of
          responders who have committed either to help in person or to
          contact police. Replaces the earlier chat-style system-message
          log. The current viewer (the person who just tapped) is one
          entry · additional mock entries illustrate how the list fills
          as more members join the group. */}
      {/* Owner directive 2026-10-25 · "Helping" left-aligned,
          "What To Do →" smaller link on the right · guide page carries
          the same Crimson Beacon background. */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          margin: "4px 0 0",
        }}
      >
        <h2
          data-testid="nex-emergency-group-helping-heading"
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: "0.01em",
            color: "#FFFFFF",
            textShadow: "0 2px 10px rgba(43, 212, 127, 0.5)",
          }}
        >
          Helping
        </h2>
        <a
          data-testid="nex-emergency-group-how-to-help-link"
          href="/nex-native/emergency-help/what-to-do"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: NEX.cyan,
            textDecoration: "none",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          How To Help →
        </a>
      </div>

      <div
        data-testid="nex-emergency-group-helpers-list"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Current viewer · action is action-aware (?action=help|police) */}
        <HelperRow
          name={PLACEHOLDER.viewerName}
          nexId={PLACEHOLDER.viewerNexId}
          action={action === "joined" ? "help" : action}
          isYou
        />
        {/* Illustrative additional helpers · prototype only */}
        <HelperRow
          name="Rina Pratama"
          nexId="NEX-20394"
          action="help"
        />
        <HelperRow
          name="Agus Wijaya"
          nexId="NEX-18827"
          action="police"
        />
      </div>

      {/* Updates section · owner directive 2026-10-25 · group members
          post what they can verify. Activator posts auto-pin (cyan rim)
          so the person in trouble stays legible as the thread grows.
          No moderation layer yet · every post carries an inline
          Report chip. */}
      <div
        data-testid="nex-emergency-group-updates"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 4,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 900,
            lineHeight: 1.1,
            color: "#FFFFFF",
            textShadow: "0 2px 10px rgba(0, 175, 255, 0.4)",
          }}
        >
          Updates
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: NEX.textDim,
              marginLeft: 8,
              fontFamily:
                "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
            }}
          >
            {sortedUpdates.length}
          </span>
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sortedUpdates.map((u) => (
            <UpdateCard key={u.id} entry={u} now={now} />
          ))}
        </div>

        {/* Composer · NexTextarea with chat-mode keypad per the sealed
            universal-keypad rule 2026-10-24 (forceKeypadActive=true). */}
        <div
          data-testid="nex-emergency-group-composer"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            padding: "10px 12px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${NEX_DRAWER.cyanSoft}`,
          }}
        >
          <NexTextarea
            value={draft}
            onChange={setDraft}
            onSend={postUpdate}
            keypadMode="chat"
            forceKeypadActive={true}
            accentColor={NEX_DRAWER.cyan}
            placeholder={resolved ? "Group closed · no new updates" : "Post an update…"}
            rows={1}
            maxLength={280}
            disabled={resolved}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: NEX_DRAWER.text,
              fontSize: 13,
              fontFamily: "inherit",
              resize: "none",
              lineHeight: 1.4,
              minHeight: 32,
              padding: "4px 4px",
              opacity: resolved ? 0.5 : 1,
            }}
          />
          <button
            type="button"
            data-testid="nex-emergency-group-composer-send"
            onClick={postUpdate}
            disabled={draft.trim().length === 0 || resolved}
            aria-label="Send update"
            style={{
              // Owner directive 2026-10-25 · post button is solid green.
              // Draft-empty state keeps the muted grey fill so the
              // button still reads as disabled.
              width: 34,
              height: 34,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background:
                draft.trim().length === 0 || resolved
                  ? "rgba(255,255,255,0.06)"
                  : NEX.green,
              color:
                draft.trim().length === 0 || resolved
                  ? NEX.textMuted
                  : "#031018",
              border: `1px solid ${
                draft.trim().length === 0 || resolved
                  ? "rgba(255,255,255,0.14)"
                  : NEX.green
              }`,
              cursor:
                draft.trim().length === 0 || resolved
                  ? "not-allowed"
                  : "pointer",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              fontFamily: "inherit",
              flexShrink: 0,
              boxShadow:
                draft.trim().length === 0 || resolved
                  ? "none"
                  : "0 6px 14px -6px rgba(43, 212, 127, 0.6)",
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>

      {/* Owner directive 2026-10-25 · Close button · when the group is
          resolved it turns green and reads "Return to contacts" to
          invite the exit. Otherwise it's the standard cyan close. */}
      <button
        type="button"
        data-testid="nex-emergency-group-close"
        data-nex-emergency-group-resolved={resolved ? "true" : "false"}
        onClick={() => router.push("/nex-native/contacts")}
        style={{
          marginTop: "auto",
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.04em",
          color: resolved ? "#031018" : "#FFFFFF",
          background: resolved ? NEX.green : NEX_DRAWER.cardBg,
          border: `1px solid ${resolved ? NEX.green : NEX_DRAWER.cyanSoft}`,
          cursor: "pointer",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          fontFamily: "inherit",
          boxShadow: resolved
            ? "0 10px 24px -10px rgba(43, 212, 127, 0.6)"
            : "none",
        }}
      >
        {resolved ? "Return to contacts" : "Close"}
      </button>

      {reportedToast ? (
        <div
          data-testid="nex-emergency-group-reported-toast"
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 92,
            transform: "translateX(-50%)",
            padding: "10px 14px",
            borderRadius: 999,
            background: "rgba(6, 16, 30, 0.96)",
            border: `1px solid ${NEX.gold}`,
            color: "#FFFFFF",
            fontSize: 12.5,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            zIndex: 160,
            boxShadow: "0 14px 32px -14px rgba(0,0,0,0.7)",
          }}
        >
          <span aria-hidden style={{ color: NEX.gold }}>⚑</span>
          Reported to NEX HQ for review.
        </div>
      ) : null}
    </main>
  );
}

function UpdateCard({
  entry,
  now,
}: {
  readonly entry: UpdateEntry;
  readonly now: number;
}): React.JSX.Element {
  // Owner directive 2026-10-25 · every update card renders in the
  // same chrome · activator-specific cyan rim / stripe / MEMBER chip
  // all retired. The activator-first order is preserved in
  // sortedUpdates so the member in trouble still reads at the top of
  // the thread. Mobile-friendly type: 14px body (was 13), 13px name
  // (was 12.5), 11px meta line (was 10.5), 10px chip (was 9).
  return (
    <div
      data-nex-group-update-card
      data-nex-group-update-activator={entry.isActivator ? "true" : "false"}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        background: NEX_DRAWER.cardBg,
        border: `1px solid ${NEX_DRAWER.borderSoft}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            border: `1.5px solid ${NEX.cyan}`,
            display: "grid",
            placeItems: "center",
            color: "#FFFFFF",
            flexShrink: 0,
          }}
        >
          <PersonIcon size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#FFFFFF",
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.authorName}
          </div>
          <div
            style={{
              fontSize: 11,
              color: NEX.gold,
              fontFamily:
                "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
              letterSpacing: "0.06em",
              lineHeight: 1.3,
            }}
          >
            {entry.authorNexId} · {formatRelativeTime(entry.createdAt, now)}
          </div>
        </div>
        {/* Owner directive 2026-10-25 · honest-copy gate · the `✓ ID`
            chip claims the responder's identity has been verified.
            Verification backend does not exist yet. The chip is
            gated behind feature flag `NEX_EMERGENCY_RESPONDER_ID_VERIFIED_LIVE`
            which defaults OFF, so the chip does not render in any
            environment where the Emergency Profile backend has not
            been proven live. When the flag flips, the chip returns. */}
        {isEmergencyFlagOn("responderIdVerifiedLive") ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 7px",
              borderRadius: 999,
              background: "rgba(0, 175, 255, 0.1)",
              border: `1px solid ${NEX_DRAWER.cyanSoft}`,
              color: NEX_DRAWER.cyan,
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
            }}
          >
            ✓ ID
          </span>
        ) : null}
      </div>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.45,
          color: "#FFFFFF",
        }}
      >
        {entry.body}
      </div>
      <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          data-nex-group-update-report
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: NEX.textMuted,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            touchAction: "manipulation",
            WebkitTapHighlightColor: "transparent",
            fontFamily: "inherit",
          }}
        >
          Report
        </button>
      </div>
    </div>
  );
}

function SendIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function DotsIcon({ size = 18 }: { readonly size?: number }): React.JSX.Element {
  // Owner directive 2026-10-25 · vertical kebab (three dots stacked
  // down the Y axis) rather than horizontal.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function GroupDrawer({
  onClose,
  remainingLabel,
  resolved,
  actionBusy,
  onMarkAsSafe,
  onShareLocation,
  onCallMember,
  onReportFalseAlarm,
  onLeaveGroup,
}: {
  readonly onClose: () => void;
  readonly remainingLabel: string;
  readonly resolved: boolean;
  readonly actionBusy: "resolve" | "flag" | "leave" | null;
  readonly onMarkAsSafe: () => void;
  readonly onShareLocation: () => void;
  readonly onCallMember: () => void;
  readonly onReportFalseAlarm: () => void;
  readonly onLeaveGroup: () => void;
}): React.JSX.Element {
  // Owner directive 2026-10-25 · the Group drawer must match the sealed
  // NEX themes-marketplace side drawer visually · same panel colour,
  // same card shape, same cyan rim, same text + muted-text tokens.
  // Pulled byte-equivalent from
  // src/app/nex-native/chat-themes-library/_marketplace-side-drawer.tsx
  // (NEX_DRAWER palette at the top of this file). Actions are visual
  // stubs in the prototype · tapping any one closes the drawer.
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <>
      <div
        data-testid="nex-emergency-group-drawer-scrim"
        onClick={onClose}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_DRAWER.scrim,
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          zIndex: 150,
        }}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Group menu"
        tabIndex={-1}
        data-testid="nex-emergency-group-drawer"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          width: "min(320px, 86%)",
          background: NEX_DRAWER.panel,
          borderLeft: `1px solid ${NEX_DRAWER.cyanSoft}`,
          boxShadow: "-16px 0 40px rgba(0,0,0,0.6)",
          padding:
            "max(14px, env(safe-area-inset-top, 0px)) 14px calc(env(safe-area-inset-bottom, 0px) + 24px)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          zIndex: 151,
          color: NEX_DRAWER.text,
          outline: "none",
          overflowY: "auto",
          fontFamily: "inherit",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 13,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: NEX_DRAWER.cyan,
              fontWeight: 700,
            }}
          >
            Menu
          </h2>
          <button
            type="button"
            data-testid="nex-emergency-group-drawer-close"
            aria-label="Close menu"
            onClick={onClose}
            style={{
              // Owner directive 2026-10-25 · solid blue close button.
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: `1px solid ${NEX_DRAWER.cyan}`,
              color: "#031018",
              background: NEX_DRAWER.cyan,
              cursor: "pointer",
              touchAction: "manipulation",
              WebkitTapHighlightColor: "transparent",
              fontFamily: "inherit",
              boxShadow: "0 6px 14px -6px rgba(0, 175, 255, 0.5)",
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div
          style={{
            fontSize: 11,
            color: NEX_DRAWER.textMuted,
            lineHeight: 1.4,
          }}
        >
          Expires in {remainingLabel}
        </div>

        <nav
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <DrawerItem
            label="Mark as safe"
            sub="Close the group early · the situation is resolved."
            accent={NEX_DRAWER.cyan}
            onClick={onMarkAsSafe}
            icon={<DrawerCheckIcon />}
            busy={actionBusy === "resolve"}
            disabled={resolved || actionBusy !== null}
          />
          <DrawerItem
            label="Share location on map"
            sub="Open the member's last-known location in Google Maps."
            accent={NEX_DRAWER.cyan}
            onClick={onShareLocation}
            icon={<DrawerPinIcon />}
          />
          <DrawerItem
            label="Call the member"
            sub="Dial the mobile on their emergency profile."
            accent={NEX_DRAWER.cyan}
            onClick={onCallMember}
            icon={<DrawerPhoneIcon />}
          />
          <DrawerItem
            label="Report false alarm"
            sub="Flag this activation to NEX HQ for review."
            accent={NEX_DRAWER.cyan}
            onClick={onReportFalseAlarm}
            icon={<DrawerFlagIcon />}
            busy={actionBusy === "flag"}
            disabled={actionBusy !== null}
          />
          <DrawerItem
            label="Leave group"
            sub="Withdraw your commitment and exit this group."
            accent={NEX_DRAWER.gold}
            onClick={onLeaveGroup}
            icon={<DrawerExitIcon />}
            busy={actionBusy === "leave"}
            disabled={actionBusy !== null}
          />
        </nav>

        <div
          style={{
            marginTop: "auto",
            fontSize: 11,
            color: NEX_DRAWER.textMuted,
            borderTop: `1px solid ${NEX_DRAWER.borderSoft}`,
            paddingTop: 10,
          }}
        >
          NEX Emergency Group · prototype menu
        </div>
      </aside>
    </>
  );
}

function DrawerItem({
  label,
  sub,
  accent,
  onClick,
  icon,
  busy,
  disabled,
}: {
  readonly label: string;
  readonly sub: string;
  readonly accent: string;
  readonly onClick: () => void;
  readonly icon: React.ReactNode;
  readonly busy?: boolean;
  readonly disabled?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-nex-group-drawer-item={label.toLowerCase().replace(/\s+/g, "-")}
      data-nex-group-drawer-item-busy={busy ? "true" : "false"}
      data-nex-group-drawer-item-disabled={disabled ? "true" : "false"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 12,
        background: NEX_DRAWER.cardBg,
        border: `1px solid ${NEX_DRAWER.borderSoft}`,
        color: NEX_DRAWER.text,
        cursor: disabled ? "not-allowed" : "pointer",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        fontFamily: "inherit",
        textAlign: "left",
        width: "100%",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: `${accent}1A`,
          border: `1px solid ${accent}55`,
          color: accent,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
          flex: 1,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: NEX_DRAWER.text }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 11,
            color: NEX_DRAWER.textMuted,
            lineHeight: 1.3,
          }}
        >
          {sub}
        </span>
      </span>
    </button>
  );
}

function DrawerCheckIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DrawerPinIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function DrawerPhoneIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.9.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

function DrawerExitIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function DrawerFlagIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function HelperRow({
  name,
  nexId,
  action,
  isYou,
}: {
  readonly name: string;
  readonly nexId: string;
  readonly action: "help" | "police";
  readonly isYou?: boolean;
}): React.JSX.Element {
  const isPolice = action === "police";
  const rimColor = isPolice ? NEX.red : NEX.green;
  const rimBg = isPolice
    ? "rgba(255, 51, 85, 0.08)"
    : "rgba(43, 212, 127, 0.08)";
  const rimBorder = isPolice
    ? "rgba(255, 51, 85, 0.4)"
    : "rgba(43, 212, 127, 0.4)";
  const chipLabel = isPolice ? "Contacting police" : "Will help";
  return (
    <div
      data-nex-group-helper-row
      data-nex-group-helper-action={action}
      data-nex-group-helper-is-you={isYou ? "true" : "false"}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 12,
        background: rimBg,
        border: `1px solid ${rimBorder}`,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          flexShrink: 0,
          background: "rgba(255,255,255,0.08)",
          border: `1.5px solid ${rimColor}`,
          display: "grid",
          placeItems: "center",
          color: "#FFFFFF",
        }}
      >
        <PersonIcon size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 800,
            color: "#FFFFFF",
            lineHeight: 1.2,
          }}
        >
          {isYou ? "You" : name}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: NEX.gold,
            letterSpacing: "0.06em",
            fontFamily:
              "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
            marginTop: 1,
          }}
        >
          {nexId}
        </div>
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 999,
          background: isPolice
            ? "rgba(255, 51, 85, 0.14)"
            : "rgba(43, 212, 127, 0.14)",
          border: `1px solid ${rimColor}`,
          fontSize: 10.5,
          fontWeight: 800,
          color: "#FFFFFF",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
        }}
      >
        {chipLabel}
      </div>
    </div>
  );
}

function ResponderJoinedCard({
  action,
}: {
  readonly action: "help" | "police" | "joined";
}): React.JSX.Element {
  const isPolice = action === "police";
  const rimColor = isPolice ? NEX.red : NEX.green;
  const rimBg = isPolice
    ? "rgba(255, 51, 85, 0.08)"
    : "rgba(43, 212, 127, 0.08)";
  const rimBorder = isPolice
    ? "rgba(255, 51, 85, 0.4)"
    : "rgba(43, 212, 127, 0.4)";
  const commitment =
    action === "police"
      ? "has accepted to contact the police with the details of this person and location."
      : "has joined the group to help with this emergency.";

  return (
    <div
      data-nex-group-responder-card
      data-nex-group-responder-action={action}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        background: rimBg,
        border: `1px solid ${rimBorder}`,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          flexShrink: 0,
          background: "rgba(255,255,255,0.08)",
          border: `1.5px solid ${rimColor}`,
          display: "grid",
          placeItems: "center",
          color: "#FFFFFF",
        }}
      >
        <PersonIcon size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.4,
            color: "#FFFFFF",
          }}
        >
          <strong style={{ color: "#FFFFFF" }}>
            {PLACEHOLDER.viewerName}
          </strong>{" "}
          <span style={styleMonoInline}>({PLACEHOLDER.viewerNexId})</span>{" "}
          {commitment}
        </div>
        {/* Owner directive 2026-10-25 · honest-copy gate · "ID verified"
            chip gated behind the same feature flag as UpdateCard. */}
        {isEmergencyFlagOn("responderIdVerifiedLive") ? (
          <div
            style={{
              marginTop: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(0, 175, 255, 0.1)",
              border: `1px solid ${NEX.borderCyan}`,
              fontSize: 10.5,
              fontWeight: 700,
              color: NEX.cyan,
              letterSpacing: "0.04em",
            }}
          >
            <span aria-hidden>✓</span> ID verified
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SystemLine({
  children,
  joined,
  muted,
}: {
  readonly children: React.ReactNode;
  readonly joined?: boolean;
  readonly muted?: boolean;
}): React.JSX.Element {
  return (
    <div
      data-nex-group-system-line
      data-nex-group-joined={joined ? "true" : "false"}
      style={{
        fontSize: 12.5,
        lineHeight: 1.5,
        color: muted ? NEX.textMuted : joined ? NEX.text : NEX.textDim,
        padding: "8px 10px",
        borderRadius: 10,
        background: joined
          ? "rgba(43, 212, 127, 0.08)"
          : "rgba(255, 255, 255, 0.04)",
        border: joined
          ? "1px solid rgba(43, 212, 127, 0.35)"
          : "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {joined ? (
        <span style={{ color: NEX.green, marginRight: 6 }} aria-hidden>
          ●
        </span>
      ) : null}
      {children}
    </div>
  );
}

function PersonIcon({ size = 36 }: { readonly size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MapPinIcon({ size = 13 }: { readonly size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 7-8 13-8 13s-8-6-8-13a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

const styleEyebrow: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: NEX.cyan,
  marginBottom: 4,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const styleMono: React.CSSProperties = {
  fontSize: 13,
  color: NEX.textDim,
  lineHeight: 1.4,
  fontFamily:
    "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
};

const styleMonoInline: React.CSSProperties = {
  fontFamily:
    "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace",
  color: NEX.gold,
};

const styleMapsBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12.5,
  fontWeight: 700,
  color: NEX.cyan,
  textDecoration: "none",
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${NEX.cyan}66`,
  background: "rgba(0, 175, 255, 0.08)",
};
