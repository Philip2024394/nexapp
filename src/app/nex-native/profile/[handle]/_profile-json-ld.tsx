// src/app/nex-native/profile/[handle]/_profile-json-ld.tsx
//
// NEX SEO B2 closeout · profile structured data.
// Owner-authorised 2026-11-11.
// -----------------------------------------------------------------------------
// Server component that double-checks is_discoverable + handle format before
// rendering any Schema.org payload. Mounted at the TOP of profile/[handle]/
// page.tsx so it protects every one of the 5 return branches (owner · viewer
// · guest · 404 · redirect). When discoverability is false, missing or fails,
// this renders NOTHING — never a Person payload, never partial fields.
//
// Hard rule: only the public-safe subset of fields reaches Schema.org.
//   Allowed:  display_name · handle · bio · avatar_url · website_url
//   Blocked:  email · phone · address · friend list · DMs · private flags
//
// The component re-fetches account+profile itself (instead of trusting
// props) because the calling page has several code paths and a passed-in
// prop could carry a mismatched handle after a redirect.

import type * as React from "react";
import * as accountService from "@/lib/nex-native/account-service";
import * as accountProfileService from "@/lib/nex-native/account-profile-service";
import {
  buildBreadcrumbList,
  buildPerson,
  renderJsonLd,
} from "@/lib/nex-native/seo/json-ld";

const HANDLE_RE = /^[a-z0-9_.-]{2,32}$/;

export async function ProfileJsonLdScripts({
  handle,
}: {
  readonly handle: string;
}): Promise<React.JSX.Element | null> {
  const normalised = (handle || "").toLowerCase().trim();
  if (!HANDLE_RE.test(normalised)) return null;

  const account = await accountService
    .getAccountByNexHandle(normalised)
    .catch(() => null);
  if (!account) return null;

  const profile = await accountProfileService
    .getProfileByAccountId(account.id)
    .catch(() => null);
  if (!profile || profile.is_discoverable !== true) return null;

  const displayName = account.display_name?.trim() || `@${normalised}`;
  // Only the public subset below reaches Schema.org. Private fields
  // (email, phone, location_label, friend lists) never appear here.
  const personPayload = buildPerson({
    handle: normalised,
    displayName,
    bio: profile.bio ?? null,
    avatarUrl: profile.avatar_url ?? null,
    websiteUrl: null, // no public websiteUrl field on nex_account_profile today.
  });
  const breadcrumbPayload = buildBreadcrumbList([
    { name: "NEX", path: "/nex-native" },
    { name: "Profiles", path: "/nex-native/directory" },
    { name: displayName, path: `/nex-native/profile/${normalised}` },
  ]);

  const personBody = renderJsonLd(personPayload);
  const breadcrumbBody = renderJsonLd(breadcrumbPayload);
  if (!personBody && !breadcrumbBody) return null;

  return (
    <>
      {personBody ? (
        <script
          type="application/ld+json"
          data-nex-seo="person"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: personBody }}
        />
      ) : null}
      {breadcrumbBody ? (
        <script
          type="application/ld+json"
          data-nex-seo="profile-breadcrumb"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: breadcrumbBody }}
        />
      ) : null}
    </>
  );
}
