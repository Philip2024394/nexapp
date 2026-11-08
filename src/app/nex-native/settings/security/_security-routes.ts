// src/app/nex-native/settings/security/_security-routes.ts
//
// NEX Phase 1.0 Security · route registry.
// Sealed 2026-10-06 · universal rule enforcement discipline (5 artefacts).
//
// Single source of truth for every /settings/security sub-route. The
// parity test (`_security-pages.test.ts`) iterates this list and
// asserts that every entry has a page file, mounts the security
// shell, and surfaces the Dashboard snippet. Adding a new sub-route
// means ONE line here + a page + no further code change elsewhere.
//
// This registry is a load-bearing contract · drift-protect it.

export interface SecurityRouteDef {
  readonly key: string;
  /** Full href (used by caller navigation + shell back-link resolution). */
  readonly href: string;
  /** Repo-relative path to the page.tsx file · used by the parity test. */
  readonly file: string;
  /** Display title shown in the shell header + the Dashboard checklist. */
  readonly title: string;
  /** One-line descriptor shown in the shell + registry-driven listings. */
  readonly subtitle: string;
}

export const SECURITY_ROUTES: readonly SecurityRouteDef[] = [
  {
    key: "landing",
    href: "/nex-native/settings/security",
    file: "src/app/nex-native/settings/security/page.tsx",
    title: "Security",
    subtitle: "Dashboard · health check · everything in one place",
  },
  // Note · the `devices` sub-route was intentionally purged on
  // 2026-11-06 as part of the HQ-deletion-queue sweep (commit
  // 16f6c4c · "Process HQ deletion queue · 29 trees"). Face sign-in
  // credentials + active sessions are currently accessed via the
  // Activity page (nex_sign_in_event) and the password reset flow's
  // mass-session-invalidation path. If a dedicated Devices surface
  // is reinstated, add the registry row back AND restore the
  // page.tsx file in the same commit.
  {
    key: "activity",
    href: "/nex-native/settings/security/activity",
    file: "src/app/nex-native/settings/security/activity/page.tsx",
    title: "Activity",
    subtitle: "Recent sign-in events on your account",
  },
  {
    key: "password",
    href: "/nex-native/settings/security/password",
    file: "src/app/nex-native/settings/security/password/page.tsx",
    title: "Password",
    subtitle: "Change your account password",
  },
  {
    key: "delete-account",
    href: "/nex-native/settings/security/delete-account",
    file: "src/app/nex-native/settings/security/delete-account/page.tsx",
    title: "Delete account",
    subtitle: "Permanently remove your NEX account",
  },
] as const;

export function getSecurityRoute(key: string): SecurityRouteDef | null {
  return SECURITY_ROUTES.find((r) => r.key === key) ?? null;
}
