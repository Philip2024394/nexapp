// src/app/nex-native/chat-themes-library/marketplace-prototype/editor/crispy-chicken/page.tsx
//
// Owner directive 2026-10-22 · prototype editor for the Crispy Chicken
// shop template · PROTOTYPE ONLY · persistence lives in localStorage
// per the owner-approved scope decision:
//
//   "Prototype editor only · localStorage, no backend"
//
// What this route IS:
//   · A working UI demonstration of the Phase 2 edit experience
//   · All 24 editable fields from the ⓘ modal, mapped 1:1
//   · Image uploads via FileReader → data URL → localStorage
//   · "View preview" that opens the Shop preview with the current
//     edits applied via localStorage override
//
// What this route is NOT:
//   · Not a real editor · no DB writes, no migrations, no entitlement
//     enforcement, no Supabase storage
//   · Not gated by purchase · anyone can open the URL
//   · Not persisting across devices · localStorage is single-origin
//     and local-browser only
//   · Not a committed design · when the Theme Commerce Purchase
//     Journey doctrine locks and the real schema is approved, this
//     prototype is replaced (not promoted directly)

import type * as React from "react";
import { EditorClient } from "./_editor-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX_BG = "#020914";
const NEX_TEXT = "#F2F5F8";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default function CrispyChickenEditorPage(): React.ReactElement {
  return (
    <>
      <style>{`html, body { background: ${NEX_BG} !important; }`}</style>
      <main
        data-nex-marketplace-prototype-editor
        style={{
          position: "absolute",
          inset: 0,
          background: NEX_BG,
          color: NEX_TEXT,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <EditorClient />
      </main>
    </>
  );
}
