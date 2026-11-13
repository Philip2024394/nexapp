// src/lib/nex-native/family-safety/_ui-types.ts
//
// Owner directive 2026-11-12 · Family Safe UI surfaces have been
// retired at the component tree level. The library layer stays live
// per sealed "UI + nav only" removal scope. The three types below
// used to live in `src/components/nex-native/family-safety/types.ts`
// and are now kept here locally so the still-live library services
// (home-service, etc.) do not break their import.
//
// These are internal to the library layer now. No UI component
// consumes them anymore.

export type FamilyMembershipState =
  | "none"
  | "pending_invitation"
  | "active_guardian"
  | "active_child"
  | "suspended"
  | "revoked";

export interface FamilyHomeSnapshot {
  readonly familyMembershipState: FamilyMembershipState;
  readonly hasAnyChildLink: boolean;
  readonly hasAnyGuardianLink: boolean;
  /** Count of pending invitations the viewer must confirm/decline. */
  readonly pendingInvitationCount: number;
  readonly canAccessDashboard: boolean;
  readonly canConfigureSafeChat: boolean;
}

export const FAMILY_HOME_SNAPSHOT_SAFE_DEFAULT: FamilyHomeSnapshot = {
  familyMembershipState: "none",
  hasAnyChildLink: false,
  hasAnyGuardianLink: false,
  pendingInvitationCount: 0,
  canAccessDashboard: false,
  canConfigureSafeChat: false,
} as const;
