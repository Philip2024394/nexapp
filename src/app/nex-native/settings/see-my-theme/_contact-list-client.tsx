"use client";

// src/app/nex-native/settings/see-my-theme/_contact-list-client.tsx
//
// Client component for the See My Theme contact list · sealed 2026-10-16.
//
// Pure UI state only · the write happens in the sealed server action
// `updateThemeVisibilityAction`. Follows the sealed save-UI honesty
// pattern (see src/app/nex-native/settings/__tests__/_save-ui-honesty
// .test.ts): capture previous state, optimistic update, roll back AND
// surface a role="alert" when the action returns { ok: false }.

import { useMemo, useState, useTransition } from "react";
import {
  updateThemeVisibilityAction,
  type UpdateThemeVisibilityResult,
} from "./_actions";

export interface ContactListEntry {
  readonly other_account_id: string;
  readonly display_name: string;
  readonly nex_handle: string | null;
  readonly avatar_url: string | null;
  /** Viewer's current toggle state (grandfather-aware). */
  readonly actor_toggle_on: boolean;
  /** Other participant's share-flag (grandfather-aware). Used client-
   *  side to recompute effective visibility after an optimistic actor
   *  toggle without a server round-trip. The other participant's flag
   *  cannot change as a result of the actor's toggle, so this value
   *  is correct for the lifetime of this page render. */
  readonly other_shares_theme: boolean;
}

interface Props {
  readonly entries: readonly ContactListEntry[];
  readonly searchPlaceholder: string;
  readonly searchAriaLabel: string;
  readonly visibleBadge: string;
  readonly hiddenBadge: string;
  readonly toggleAriaOn: string;
  readonly toggleAriaOff: string;
  readonly savingLabel: string;
  readonly genericError: string;
  readonly noMatchTitle: string;
  readonly noMatchBody: string;
}

const PANEL = "#03101D";
const BORDER = "rgba(0, 175, 255, 0.18)";
const CYAN = "#00AFFF";
const CYAN_FAINT = "rgba(0, 175, 255, 0.12)";
const TEXT_PRIMARY = "#F2F5F8";
const TEXT_SECONDARY = "#7D9BC0";
const ORANGE = "#FF7200";

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]!.toUpperCase()).join("");
}

export function ContactListClient(props: Props): React.JSX.Element {
  const [query, setQuery] = useState("");
  // Local optimistic state per contact · keyed by other_account_id.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const resolved = useMemo(
    () =>
      props.entries.map((e) => ({
        ...e,
        actor_toggle_on:
          overrides[e.other_account_id] ?? e.actor_toggle_on,
      })),
    [props.entries, overrides],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resolved;
    return resolved.filter((e) => {
      const name = (e.display_name ?? "").toLowerCase();
      const handle = (e.nex_handle ?? "").toLowerCase();
      return name.includes(q) || handle.includes(q);
    });
  }, [resolved, query]);

  function onToggle(otherId: string, currentState: boolean) {
    const next = !currentState;
    const previous = currentState;
    // Optimistic flip
    setOverrides((prev) => ({ ...prev, [otherId]: next }));
    setError(null);
    setSavingId(otherId);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("other_account_id", otherId);
      fd.set("on", next ? "true" : "false");
      let result: UpdateThemeVisibilityResult;
      try {
        result = await updateThemeVisibilityAction(fd);
      } catch (err) {
        result = {
          ok: false,
          reason: "service_error",
          message: err instanceof Error ? err.message : String(err),
        };
      }
      if (!result.ok) {
        // Honest rollback
        setOverrides((prev) => ({ ...prev, [otherId]: previous }));
        setError(props.genericError);
      }
      setSavingId((cur) => (cur === otherId ? null : cur));
    });
  }

  return (
    <div data-nex-settings-see-my-theme-client>
      <label
        htmlFor="see-my-theme-search"
        style={{ position: "absolute", left: -9999 }}
      >
        {props.searchAriaLabel}
      </label>
      <input
        id="see-my-theme-search"
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder={props.searchPlaceholder}
        aria-label={props.searchAriaLabel}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        data-nex-settings-see-my-theme-search
        style={{
          width: "100%",
          minHeight: 44,
          padding: "10px 14px",
          borderRadius: 10,
          background: PANEL,
          border: `1px solid ${BORDER}`,
          color: TEXT_PRIMARY,
          fontSize: 14,
          outline: "none",
          marginBottom: 12,
        }}
      />

      {error && (
        <div
          role="alert"
          data-nex-settings-see-my-theme-error
          style={{
            marginBottom: 10,
            padding: "8px 12px",
            borderRadius: 10,
            background: "rgba(255, 114, 0, 0.08)",
            border: "1px solid rgba(255, 114, 0, 0.35)",
            color: ORANGE,
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div
          data-nex-settings-see-my-theme-empty
          style={{
            padding: "16px 14px",
            borderRadius: 12,
            background: PANEL,
            border: `1px solid ${BORDER}`,
            color: TEXT_SECONDARY,
            fontSize: 13,
            lineHeight: 1.5,
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: TEXT_PRIMARY,
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            {props.noMatchTitle}
          </div>
          {props.noMatchBody}
        </div>
      ) : (
        <ul
          data-nex-settings-see-my-theme-list
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gap: 10,
          }}
        >
          {filtered.map((e) => {
            const isOn = e.actor_toggle_on;
            const isSaving = savingId === e.other_account_id && pending;
            // Defect 1 fix (sealed 2026-10-16) · badge displays the
            // EFFECTIVE mutual-visibility result, not the actor's raw
            // toggle state. When the other party has their side OFF
            // (or legacy data has it FALSE), the badge honestly reads
            // "Standard NEX theme for this chat" even while the actor's
            // own toggle stays ON. The actor's toggle remains visually
            // independent above so the user still sees their own intent.
            // The other party's flag is captured at server-render time
            // and cannot change in response to the actor's own toggle,
            // so this computation is correct for optimistic updates.
            const effectivelyVisible = isOn && e.other_shares_theme;
            const badge = effectivelyVisible
              ? props.visibleBadge
              : props.hiddenBadge;
            return (
              <li
                key={e.other_account_id}
                data-nex-settings-see-my-theme-row={e.other_account_id}
                data-nex-settings-see-my-theme-effective-visible={
                  effectivelyVisible ? "true" : "false"
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  background: PANEL,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  minHeight: 64,
                }}
              >
                {e.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.avatar_url}
                    alt=""
                    aria-hidden
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      objectFit: "cover",
                      flexShrink: 0,
                      background: CYAN_FAINT,
                    }}
                  />
                ) : (
                  <div
                    aria-hidden
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: CYAN_FAINT,
                      color: CYAN,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 13,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {initials(e.display_name)}
                  </div>
                )}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: TEXT_PRIMARY,
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={e.display_name}
                  >
                    {e.display_name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: TEXT_SECONDARY,
                      marginTop: 2,
                      lineHeight: 1.3,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={badge}
                  >
                    {isSaving ? props.savingLabel : badge}
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  aria-label={isOn ? props.toggleAriaOn : props.toggleAriaOff}
                  onClick={() => onToggle(e.other_account_id, isOn)}
                  disabled={isSaving}
                  data-nex-settings-see-my-theme-toggle={e.other_account_id}
                  data-nex-settings-see-my-theme-toggle-state={
                    isOn ? "on" : "off"
                  }
                  style={{
                    flexShrink: 0,
                    position: "relative",
                    width: 48,
                    height: 28,
                    borderRadius: 999,
                    background: isOn ? CYAN : "rgba(125, 155, 192, 0.35)",
                    border: "none",
                    cursor: isSaving ? "default" : "pointer",
                    opacity: isSaving ? 0.6 : 1,
                    transition: "background 180ms ease",
                    padding: 0,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 3,
                      left: isOn ? 23 : 3,
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: "#F2F5F8",
                      transition: "left 180ms ease",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
                    }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
