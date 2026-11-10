// src/app/nex-native/manage/categories/_actions.ts
//
// Server-action stub for the categories section-assignment surface ·
// owner-sealed 2026-11-10 build cycle. The real
// `assignProductToSectionAction` was never migrated when the
// product-detail editor was refactored; `[productId]/page.tsx` still
// binds it to the form `action` prop.
//
// Stub makes the build succeed and honestly reports the action is not
// wired. The product read path still works; section reassignment is
// unavailable until the real action is revived.

"use server";

import { redirect } from "next/navigation";

export async function assignProductToSectionAction(
  businessId: string,
  productId: string,
  _formData: FormData,
): Promise<never> {
  const qs = new URLSearchParams({
    e: "section_assign_not_wired",
    m: "Section reassignment is not wired in this environment.",
  });
  redirect(`/nex-native/manage/products/${productId}?${qs.toString()}&biz=${businessId}`);
}
