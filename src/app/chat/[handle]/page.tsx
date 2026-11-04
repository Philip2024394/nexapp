// src/app/chat/[handle]/page.tsx
//
// NEX short-URL alias for the sealed peer chat surface.
// Owner-authorised 2026-11-04 later-same-day · "the urls must be short".
// -----------------------------------------------------------------------------
// This route accepts a NEX handle (nex-99912) and 307-redirects to the
// canonical peer-chat path at /nex-native/chat/peer/<accountId>. The
// sealed chat template, middleware, and session resolution all run
// on the destination path · this file is a thin resolver / alias.
//
// Behaviour:
//   /chat/nex-99912                      → /nex-native/chat/peer/<uuid>
//   /chat/<unknown-handle>              → /nex-native/contacts (soft 404)
//   /chat/<invalid-format>              → /nex-native/contacts
//
// Invariants:
//   · No DB writes.
//   · No session gate here · the destination enforces its own auth.
//   · Handle regex matches migration 021 handle format: /^nex-[0-9]{5,}$/.

import { redirect } from "next/navigation";
import { getAccountByNexHandle } from "@/lib/nex-native/account-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ handle: string }>;
}

export default async function ShortChatHandleRoute({ params }: PageProps): Promise<never> {
  const { handle } = await params;
  const normalised = (handle ?? "").trim().toLowerCase();
  if (!/^nex-[0-9]{5,}$/.test(normalised)) {
    redirect("/nex-native/contacts");
  }
  const account = await getAccountByNexHandle(normalised).catch(() => null);
  if (!account) {
    redirect("/nex-native/contacts");
  }
  redirect(`/nex-native/chat/peer/${account.id}`);
}
