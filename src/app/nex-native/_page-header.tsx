// src/app/nex-native/_page-header.tsx
//
// Shared NEX-native page header · applied to EVERY dark-navy surface.
// -------------------------------------------------------------------------
// Owner directive 2026-11-12 · supersedes the three-slot header
// (brand ping-badge left · magnifier middle · drawer right). Both the
// NEX profile image circle and the blue magnifying glass are now
// globally retired. The header renders a SINGLE element: the drawer
// button on the right. No per-page hide-flag is required · every
// surface gets the stripped header automatically.
//
// Legacy props (brandAvatarUrl · brandAccent · brandSlot · hideSearch
// · hideBrand · searchStyle) are kept on the interface so the dozens
// of existing call-sites still type-check, but they are NO-OPS. New
// callers should omit them.

// Owner directive 2026-11-12 · drawer identity auto-resolves here so
// every mounting page shows the signed-in bar without each page
// manually threading `drawerSession`. Uses the dev-override resolver
// so NEX_DEV_IMPERSONATE_HANDLE (e.g. nex-99901) is honoured on the
// drawer identity bar across every surface. Falls back to the real
// resolver in production automatically.
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { PageHeaderDrawerButtonClient } from "./_page-header-drawer-button-client";
import type { ControlDrawerSession } from "@/components/nex-native/control-drawer/control-drawer-client";

interface NexPageHeaderProps {
  /** Optional data-attr for tests / analytics. */
  dataScope?: string;
  /** Legacy prop · retained for backward compat · now a no-op (the
   *  brand ping-badge slot has been globally removed per owner
   *  directive 2026-11-12). */
  brandAvatarUrl?: string | null;
  /** Legacy prop · retained for backward compat · now a no-op. */
  brandAccent?: string;
  /** Legacy prop · retained for backward compat · now a no-op. */
  brandSlot?: React.ReactNode;
  /** Legacy prop · retained for backward compat · now a no-op (the
   *  magnifying-glass search icon has been globally removed per
   *  owner directive 2026-11-12). */
  hideSearch?: boolean;
  /** Legacy prop · retained for backward compat · now a no-op (brand
   *  slot is always empty). */
  hideBrand?: boolean;
  /** Legacy prop · retained for backward compat · now a no-op. */
  searchStyle?: "search" | "grid";
  /** Owner fix 2026-11-05 · drawer unification · session identity for
   *  the shared ControlDrawer's identity bar. Page resolves server-side
   *  and passes through. Null (default) renders the drawer in anonymous
   *  mode with a sign-in prompt in the identity slot · nav rows still
   *  render. Non-signed-in pages (welcome · sign-in) can omit. */
  drawerSession?: ControlDrawerSession | null;
}

export async function NexPageHeader({
  dataScope,
  brandAvatarUrl: _brandAvatarUrl,
  brandAccent: _brandAccent,
  brandSlot: _brandSlot,
  hideSearch: _hideSearch,
  hideBrand: _hideBrand,
  searchStyle: _searchStyle,
  drawerSession,
}: NexPageHeaderProps) {
  // Owner directive 2026-11-12 · auto-resolve the drawer session when
  // the mounting page didn't pass one. Explicit `null` is respected
  // (pages that KNOW they are anonymous · e.g. sign-in / welcome).
  // Explicit `undefined` or missing prop → resolve now via the dev-
  // override resolver so the drawer identity bar stops showing the
  // "Sign in to NEX" prompt on every surface that forgot to thread.
  let resolvedDrawerSession: ControlDrawerSession | null;
  if (drawerSession === undefined) {
    const sess = await resolveSessionWithDevOverride();
    resolvedDrawerSession = sess
      ? {
          displayName:
            sess.account.display_name ?? sess.account.nex_handle ?? "NEX user",
          nexHandle: sess.account.nex_handle ?? null,
          isBisnis: false,
        }
      : null;
  } else {
    resolvedDrawerSession = drawerSession;
  }
  // Silence unused-destructured warnings · these props stay in the
  // interface for backward compat with existing callers but intentionally
  // don't render anything.
  void _brandAvatarUrl;
  void _brandAccent;
  void _brandSlot;
  void _hideSearch;
  void _hideBrand;
  void _searchStyle;

  return (
    <header
      data-nex-page-header
      data-nex-page-header-scope={dataScope}
      style={{
        paddingTop: "max(env(safe-area-inset-top, 0px), 8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 12,
      }}
    >
      <PageHeaderDrawerButtonClient session={resolvedDrawerSession} />
    </header>
  );
}
