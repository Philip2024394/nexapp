// src/app/api/nex-native/manage/orders/[orderId]/events/route.ts
//
// Read-only order-event refresh endpoint for the seller detail page.
// Owner-sealed 2026-11-10 P3. Verifies the signed-in seller owns the
// order's business before returning events.

import { NextResponse, type NextRequest } from "next/server";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import * as orderService from "@/lib/nex-native/order-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ orderId: string }> },
): Promise<NextResponse> {
  const { orderId } = await ctx.params;
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const order = await orderService.getOrderById(orderId).catch(() => null);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: biz } = await nexSupabaseAdmin
    .from("nex_business")
    .select("owner_account_id")
    .eq("id", order.business_id)
    .maybeSingle();
  const ownerId = (biz as { owner_account_id: string } | null)?.owner_account_id;
  if (!ownerId || ownerId !== session.account.id) {
    return NextResponse.json({ error: "not_owner" }, { status: 403 });
  }

  const events = await orderService.listOrderEvents(orderId).catch(() => []);
  return NextResponse.json({ events }, { status: 200 });
}
