// src/app/nex-native/create/product/form/page.tsx
//
// Shared Create Product form page · Phase 1 Product System.
//
// Resolves (business, dept, cat) · looks up the sealed CategorySpec
// from the registry · mounts the client form shell which composes
// SpecFormBuilder + name/price/image inputs + Save/Publish buttons.
//
// Server portion resolves the spec + hands off; the client component
// owns the mutable form state and the server-action call.

import { redirect } from "next/navigation";
import { resolveSessionWithDevOverride } from "@/lib/nex-native/app/dev-impersonation";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import { resolveCategorySpec } from "@/lib/nex-native/catalogue/specs";
import { DEPARTMENTS } from "@/lib/nex-native/catalogue/departments";
import type { DepartmentId } from "@/lib/nex-native/catalogue/departments";
import { CreateProductFormClient } from "./_form-client";
// Owner-authorised 2026-11-05 iter 25 · fetch the owner's uploaded
// videos so the product form can offer a background-video picker for
// the NEX Live shoppable-card overlay (migration 280 applied).
import { listMyUploadedVideos } from "@/lib/nex-native/live-broadcast/uploaded-video-service";

export const dynamic = "force-dynamic";

export default async function CreateProductFormPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string; dept?: string; cat?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveSessionWithDevOverride();
  if (!session) {
    redirect("/nex-native/sign-in?next=" + encodeURIComponent("/nex-native/create/product"));
  }
  const { business, dept, cat } = await searchParams;
  if (!business || !dept || !cat) {
    redirect("/nex-native/create/product");
  }

  // Ownership gate (defence-in-depth · server action re-checks)
  let owned: Array<{ id: string; name: string }>;
  try {
    const raw = await listBusinessesByOwner(session.account.id);
    owned = raw.map((b) => ({ id: b.id, name: b.display_name }));
  } catch {
    owned = [];
  }
  const biz = owned.find((b) => b.id === business);
  if (!biz) {
    redirect("/nex-native/create/product");
  }

  // Resolve the sealed spec
  const spec = resolveCategorySpec(dept as DepartmentId, cat!);
  if (!spec) {
    redirect(`/nex-native/create/product/category?business=${encodeURIComponent(business!)}`);
  }
  const department = DEPARTMENTS.find((d) => d.id === (dept as DepartmentId));

  // Owner-authorised 2026-11-05 iter 25 · owner's recent uploaded
  // videos · passed to the form so the merchant can pick one as the
  // NEX Live background. Fail-open: empty list just hides the picker.
  let myVideos: ReadonlyArray<{
    id: string;
    title: string;
    publicUrl: string;
  }> = [];
  try {
    const raw = await listMyUploadedVideos(session.account.id, { limit: 20 });
    const base = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL ?? "";
    myVideos = raw.map((v) => ({
      id: v.id,
      title: v.title,
      publicUrl: `${base}/storage/v1/object/public/${v.storage_bucket}/${v.storage_object_path}`,
    }));
  } catch {
    myVideos = [];
  }

  return (
    <CreateProductFormClient
      businessId={business!}
      businessName={biz!.name}
      departmentId={dept as DepartmentId}
      departmentLabel={department?.label ?? dept!}
      categoryId={cat!}
      categoryLabel={spec!.label}
      fields={spec!.fields}
      myVideos={myVideos}
    />
  );
}
