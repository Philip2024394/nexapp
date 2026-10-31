// src/app/nex-native/nex-feed/page.tsx
//
// Owner directive 2026-10-30 · one and only NEX feed. The side-drawer
// Live button routes here. Pure redirector:
//   · If any feed entry exists (music active-slot OR uploaded video),
//     redirect to /nex-native/nex-feed/{firstEntryId}. Music entries
//     use the slug `music-<trackId>`; videos keep their raw id.
//   · Else render an honest empty-state.

import { redirect } from "next/navigation";
import Link from "next/link";
import type * as React from "react";
import { listNexFeedEntries } from "@/lib/nex-native/nex-feed/nex-feed-entries";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
// Owner directive 2026-11-01 · Batch E · Stage 3B · country-aware
// redirector. `?country=IE` resolves against nex_country_registry;
// invalid / disabled codes fall back to Worldwide. The redirector
// then preserves the country param so the viewer page knows which
// pool to list.
import {
  resolveCountryFeedMode,
} from "@/lib/nex-native/nex-feed/country-feed-mode";
import { listCountryFeedEntries } from "@/lib/nex-native/nex-feed/ireland-feed-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "NEX · Feed",
  description: "Swipe up and down through videos and music on NEX.",
};

const NEX = {
  bg: "var(--nex-world-background-base, #020914)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  cyan: "#00AFFF",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
};

const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function NexFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}): Promise<React.JSX.Element> {
  const { country: countryParamRaw } = await searchParams;
  const countryMode = await resolveCountryFeedMode(countryParamRaw);
  const accountLookup = async (ids: readonly string[]) => {
    if (ids.length === 0) return [];
    try {
      const { data } = await nexSupabaseAdmin
        .from("nex_account")
        .select("id, display_name, nex_handle, avatar_url")
        .in("id", ids);
      return (
        (data as Array<{
          id: string;
          display_name: string | null;
          nex_handle: string | null;
          avatar_url: string | null;
        }> | null) ?? []
      ).map((r) => ({
        id: r.id,
        displayName: r.display_name ?? "NEX user",
        nexHandle: r.nex_handle ?? null,
        avatarUrl: r.avatar_url ?? null,
      }));
    } catch {
      return [];
    }
  };

  // Owner directive 2026-11-01 · Batch E · country-aware pool. Country
  // mode uses the Ireland reader; Worldwide uses the sealed pool.
  const entries =
    countryMode.kind === "country"
      ? await listCountryFeedEntries({
          country: countryMode.code,
          nowMs: Date.now(),
          accountLookup,
        })
      : await listNexFeedEntries({ nowMs: Date.now(), accountLookup });

  if (entries.length > 0) {
    // Preserve `?country=` on the redirect so the viewer page keeps
    // showing the right pool after resolution.
    const q =
      countryMode.kind === "country"
        ? `?country=${countryMode.code}`
        : "";
    redirect(`/nex-native/nex-feed/${entries[0]!.feedEntryId}${q}`);
  }

  return (
    <main
      data-nex-feed-empty
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        display: "grid",
        placeItems: "center",
        padding: "40px 20px",
      }}
    >
      <section
        style={{
          maxWidth: 420,
          textAlign: "center",
          padding: 24,
          borderRadius: 16,
          background: NEX.panelSoft,
          border: `1px solid ${NEX.border}`,
        }}
      >
        <div
          aria-hidden
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: NEX.cyan,
            marginBottom: 6,
          }}
        >
          NEX Feed
        </div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          No posts yet
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.5,
          }}
        >
          Check back soon.
        </p>
        <Link
          href="/nex-native"
          style={{
            display: "inline-block",
            marginTop: 16,
            padding: "10px 18px",
            borderRadius: 999,
            background: NEX.cyan,
            color: "#031018",
            fontSize: 13,
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Back home
        </Link>
      </section>
    </main>
  );
}
