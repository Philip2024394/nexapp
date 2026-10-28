// src/app/nex-native/manage/products/[productId]/interest/page.tsx
//
// Phase 1 · Slice 1F · owner-authorised 2026-10-24.
// -----------------------------------------------------------------------------
// Seller-facing per-product interest surface. Thin shell · delegates
// data assembly to the sealed seller-insight-service (Slice 1E) and
// rendering to the presentational dashboard component.
//
// Access control
// -----------------------------------------------------------------------------
// 1 · Resolve session. Guest → redirect to sign-in.
// 2 · Resolve product. Missing → notFound (never leak the id).
// 3 · Delegate ownership check to the service, which returns a
//     typed denial reason. We translate it to the right Next.js
//     routing primitive · never render partial data to an
//     unauthorised caller.
//
// Reminder (G1 R1 · tracked, not fixed by this slice): nex_peer_
// message RLS is defective; the service-layer check in seller-
// insight-service.ts is the sole enforcement. Production release
// of this surface remains blocked by G1 per the saved plan.
//
// Migration 216 compatibility
// -----------------------------------------------------------------------------
// The service handles missing nex.discovery_signal / unapplied
// Migration 216 by returning `unavailable` for the affected
// metrics. The dashboard renders those as "— data unavailable"
// without crashing the page.

import type * as React from "react";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as productService from "@/lib/nex-native/product-service";
import { getPerProductInterestSummary } from "@/lib/nex-native/seller-insights/seller-insight-service";
import { InterestDashboard } from "./_interest-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProductInterestPage({
  params,
}: {
  readonly params: Promise<{ productId: string }>;
}): Promise<React.JSX.Element> {
  const { productId } = await params;

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(
      `/nex-native/sign-in?next=${encodeURIComponent(
        `/nex-native/manage/products/${productId}/interest`,
      )}`,
    );
  }

  // Resolve the product name BEFORE calling the service · we want to
  // show a titled heading on the dashboard even if a specific metric
  // comes back unavailable. The service also fetches the product
  // (ownership resolution), so this is one extra read that keeps the
  // UI simple to type · acceptable for the first phase.
  const product = await productService.getProductById(productId);
  if (!product) notFound();

  const result = await getPerProductInterestSummary({
    sellerAccountId: session.account.id,
    productId: product.id,
  });

  if (!result.ok) {
    switch (result.reason.kind) {
      case "not-signed-in":
        // Defensive · session was present above but service returned
        // not-signed-in. Treat as auth loss.
        redirect(
          `/nex-native/sign-in?next=${encodeURIComponent(
            `/nex-native/manage/products/${productId}/interest`,
          )}`,
        );
        break;
      case "product-not-found":
        notFound();
        break;
      case "product-not-in-owned-business":
        redirect(
          "/nex-native/manage?e=interest_forbidden&m=" +
            encodeURIComponent("You don't own this product"),
        );
        break;
      case "business-not-found":
      case "not-business-owner":
        // These are the per-business denial kinds · reaching them
        // from the per-product entry point should be impossible,
        // but we fail closed by redirecting to /manage.
        redirect(
          "/nex-native/manage?e=interest_forbidden&m=" +
            encodeURIComponent("Access denied"),
        );
        break;
    }
    // Unreachable · every denial kind redirects or 404s above.
    // Narrow the type for TypeScript.
    throw new Error("unreachable");
  }

  return (
    <InterestDashboard
      productId={product.id}
      productName={product.name}
      summary={result.data}
    />
  );
}
