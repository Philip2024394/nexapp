// src/app/nex-native/shop-share-demo/[contactId]/page.tsx
//
// Owner directive 2026-10-23 · "the cart icon on the cards will divert
// to the owners shop page". Demo shop surface reached by tapping the
// 🛒 cart on a contact card in the picker. Isolated from the sealed
// real business shop at /nex-native/[businessSlug] so this build has
// zero risk to that production surface.
//
// Server component · resolves the contact id against the mock set
// and hands the display name + shop name to the client view. If the
// id doesn't match a mock contact, 404s.

import { notFound } from "next/navigation";
import { MOCK_CONTACTS } from "@/app/nex-native/free-chat/_contact-picker-data";
import { ShopShareDemoClient } from "./_client";

export const runtime = "nodejs";
export const dynamic = "force-static";

interface PageProps {
  params: Promise<{ contactId: string }>;
}

export default async function ShopShareDemoPage({ params }: PageProps) {
  const { contactId } = await params;
  const contact = MOCK_CONTACTS.find((c) => c.id === contactId);
  if (!contact || !contact.hasShop) notFound();

  return (
    <ShopShareDemoClient
      ownerContactId={contact.id}
      ownerDisplayName={contact.displayName}
      ownerShopName={contact.shopName ?? contact.displayName}
      ownerInitials={contact.initials}
    />
  );
}
