// src/app/nex-native/manage/shop/setup/story/page.tsx
//
// Shop Setup · Step 5 · Your story.
// Owner-authorised 2026-11-06.

import type * as React from "react";
import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { StoryStepClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "var(--nex-world-drawer-bg, #020914)";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ShopSetupStoryPage(): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/manage/shop/setup/story");
  }
  const businesses = await listBusinessesByOwner(session.account.id);
  const existing = businesses[0];
  if (!existing) {
    redirect("/nex-native/manage/shop/setup/identity");
  }

  return (
    <>
      <style>{`html, body { background: ${NEX_BG}; }`}</style>
      <main
        data-nex-shop-setup-story
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: NEX_TEXT,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding:
            "calc(env(safe-area-inset-top, 0px) + 18px) 20px calc(env(safe-area-inset-bottom, 0px) + 18px)",
          boxSizing: "border-box",
        }}
      >
        <StoryStepClient
          initialDescription={existing.description ?? ""}
        />
      </main>
    </>
  );
}
