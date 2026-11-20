// src/app/nex-native/manage/orders/[orderId]/_dispatch-action.ts
//
// Seller dispatch · server-action entrypoint · PROPOSAL ARTEFACT · 2026-11-17
// -----------------------------------------------------------------------------
// This is the ONLY surface the browser can invoke for dispatch writes.
// Identity is derived here from the verified session via the dispatch
// service — the browser form MUST NOT be able to supply a seller_account_id,
// so it is NEVER read from FormData. Any such field is ignored.
//
// Schema-safe when NEX_DISPATCH_TRACKING_ENABLED !== "true": returns
// {ok:false, reason:"feature_disabled"} without touching any dispatch_*
// column. Safe to leave in-tree even on branches where migration 349 is
// not applied.

"use server";

import {
  sellerSaveOrderDispatch,
  type DispatchAction,
  type DispatchProvider,
  type DispatchSaveResult,
} from "@/lib/nex-native/manage-orders/dispatch-service";
import type { TransitUnit } from "@/lib/nex-native/manage-orders/dispatch-eta";

function readString(fd: FormData, key: string): string | null {
  const raw = fd.get(key);
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length === 0 ? null : t;
}

function readInt(fd: FormData, key: string): number | null {
  const raw = fd.get(key);
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

function readAction(fd: FormData): DispatchAction | null {
  const raw = readString(fd, "action");
  switch (raw) {
    case "save":
    case "mark_preparing":
    case "mark_dispatched":
    case "mark_delivered":
      return raw;
    default:
      return null;
  }
}

function readProvider(fd: FormData): DispatchProvider | null {
  const raw = readString(fd, "provider");
  switch (raw) {
    case "dhl":
    case "ups":
    case "fedex":
    case "postal":
    case "sea_freight":
    case "other":
      return raw;
    default:
      return null;
  }
}

function readUnit(fd: FormData): TransitUnit | null {
  const raw = readString(fd, "estimated_transit_unit");
  return raw === "days" || raw === "months" ? raw : null;
}

/**
 * Save or advance dispatch state. Identity resolves from session.
 * NOTE: the form MAY include a "seller_account_id" field but it is
 * intentionally ignored here — the browser does not control who the
 * caller is.
 */
export async function sellerSaveOrderDispatchAction(
  fd: FormData,
): Promise<DispatchSaveResult> {
  const order_id = readString(fd, "order_id");
  if (!order_id) {
    return { ok: false, reason: "invalid_input", message: "order_id required" };
  }
  const action = readAction(fd);
  if (!action) {
    return { ok: false, reason: "invalid_action" };
  }

  return sellerSaveOrderDispatch({
    order_id: order_id as `${string}-${string}-${string}-${string}-${string}`,
    provider: readProvider(fd),
    provider_custom: readString(fd, "provider_custom"),
    tracking_number: readString(fd, "tracking_number"),
    tracking_url: readString(fd, "tracking_url"),
    estimated_transit_qty: readInt(fd, "estimated_transit_qty"),
    estimated_transit_unit: readUnit(fd),
    action,
  });
}
