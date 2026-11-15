// src/app/nex-native/create/product/form/page.tsx
//
// D3 · Fills the MISSING form route linked from the sealed category
// picker at `/nex-native/create/product/category/page.tsx:138`:
//
//   `/nex-native/create/product/form?business=X&dept=Y&cat=Z`
//
// Role:
//   · Server component · parses + validates querystring (business,
//     dept, cat).
//   · Resolves the session via `resolveSessionWithDevOverride` so dev
//     impersonation (99901/99903) works the same as prod sessions
//     (upload-bounce-to-sign-in parity with /vault + /chat surfaces).
//   · Confirms the signed-in account owns the referenced business.
//   · Looks up the sealed Zod-backed CategorySpec via
//     `resolveCategorySpec(dept, cat)`.
//   · Resolves a sensible default `currency` from the business row
//     (`defaultCurrencyFromBusinessRow`) — same resolver the shop
//     surfaces already use; falls back to env then to "EUR".
//   · Hands the resolved context + empty drafts to
//     `CreateProductFormClient`, which composes the existing editors
//     under `src/components/nex-native/product-create/*` and posts to
//     `createProductAction` on submit.
//
// All error paths redirect back to the category picker preserving
// `business` when it is known. Unknown/malformed params are treated
// as "pick again", never as a silent failure — the only valid path to
// this form is through the sealed tiles, which only link to registered
// (dept, cat) pairs.

import { redirect } from "next/navigation";
import type * as React from "react";

import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import {
  listBusinessesByOwner,
  getBusinessById,
  defaultCurrencyFromBusinessRow,
} from "@/lib/nex-native/business-service";
import {
  findDepartment,
  type DepartmentId,
} from "@/lib/nex-native/catalogue/departments";
import {
  isCategorySpecRegistered,
  resolveCategorySpec,
} from "@/lib/nex-native/catalogue/specs";

import { CreateProductFormClient } from "./_create-product-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_DEPT_IDS: readonly DepartmentId[] = [
  "electronics_technology",
  "home_furniture_living",
  "kitchen_dining",
  "fashion_clothing",
  "jewellery_watches",
  "beauty_personal_care",
  "health_wellness_medical",
  "baby_nursery_parenting",
  "toys_games_hobbies",
  "sports_fitness_outdoors",
  "garden_outdoor_agriculture",
  "tools_diy_construction",
  "automotive_motorcycles_transport",
  "food_grocery_beverages",
  "pet_supplies_animals",
  "books_education_stationery",
  "office_business_industrial",
  "arts_crafts_handmade",
  "music_film_entertainment",
  "travel_luggage_outdoor",
  "digital_products_software",
  "accommodation_property",
  "food_delivery_restaurants",
  "services_marketplace",
  "experiences_activities_tickets",
  "second_hand_refurbished",
  "luxury_premium_collectibles",
  "gifts_celebrations_seasonal",
  "renewable_energy_utilities",
  "everything_else",
];

function isValidDeptId(raw: string): raw is DepartmentId {
  return (VALID_DEPT_IDS as readonly string[]).includes(raw);
}

export default async function CreateProductFormPage({
  searchParams,
}: {
  searchParams: Promise<{
    business?: string;
    dept?: string;
    cat?: string;
  }>;
}): Promise<React.JSX.Element> {
  const { business, dept, cat } = await searchParams;

  // Session gate first · dev-override aware so 99901/99903 impersonation
  // resolves identically to prod sign-in (parity with /vault + /chat).
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    const nextParam =
      business && dept && cat
        ? `/nex-native/create/product/form?business=${encodeURIComponent(
            business,
          )}&dept=${encodeURIComponent(dept)}&cat=${encodeURIComponent(cat)}`
        : "/nex-native/create/product";
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(nextParam)}`);
  }

  // Querystring is the single source of truth. Missing/malformed param
  // → send the user back to the picker so they can re-select. Preserve
  // `business` when it is known so they don't lose shop context.
  const backToPicker = (b?: string): string =>
    b
      ? `/nex-native/create/product/category?business=${encodeURIComponent(b)}`
      : `/nex-native/create/product/category`;

  if (!business || !dept || !cat) {
    redirect(backToPicker(business));
  }

  if (!isValidDeptId(dept)) {
    redirect(backToPicker(business));
  }

  // Ownership gate · never trust the querystring. Rejects cases where
  // a seller shares a tile-link with someone who doesn't own the shop.
  let owned: Array<{ id: string }> = [];
  try {
    const raw = await listBusinessesByOwner(session.account.id);
    owned = raw.map((b) => ({ id: b.id }));
  } catch {
    owned = [];
  }
  if (!owned.some((b) => b.id === business)) {
    redirect("/nex-native/create/product");
  }

  // The tiles only expose registered pairs, but guard anyway — a stale
  // tab + a schema-level removal shouldn't slip past the server.
  if (!isCategorySpecRegistered(dept, cat)) {
    redirect(backToPicker(business));
  }
  const categorySpec = resolveCategorySpec(dept, cat);
  if (!categorySpec) {
    // Defensive · isCategorySpecRegistered already returned true.
    redirect(backToPicker(business));
  }

  const department = findDepartment(dept);
  const category = department?.categories.find((c) => c.id === cat);
  const departmentLabel = department?.label ?? "Products";
  const categoryLabel = category?.label ?? categorySpec.label;

  // Resolve default currency · thin reader matches the resolver used by
  // the shop/delivery/cart surfaces. Safe pre-migration (env/EUR fallback).
  const biz = await getBusinessById(business).catch(() => null);
  const defaultCurrency = defaultCurrencyFromBusinessRow(biz);
  const businessName = biz?.display_name ?? "";

  return (
    <CreateProductFormClient
      businessId={business}
      businessName={businessName}
      departmentId={dept}
      departmentLabel={departmentLabel}
      categoryId={cat}
      categoryLabel={categoryLabel}
      fields={categorySpec.fields}
      defaultCurrency={defaultCurrency}
    />
  );
}
