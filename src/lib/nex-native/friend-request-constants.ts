// src/lib/nex-native/friend-request-constants.ts
//
// Plain TypeScript constants shared between client and server
// (friend-request-service.ts is "server-only"; the Shop Contacts
// invite modal is a client component · they must agree on these
// values without the client pulling in the service's server-only
// dependency graph).

/** Maximum length of the optional introduction note on an invite.
 *  Enforced client-side AND service-side; the service imports this
 *  constant and clamps on insert. The DB `CHECK` in Migration 220
 *  mirrors the same cap. */
export const INTRO_NOTE_MAX_LENGTH = 280;
