// src/app/nex-native/manage/community-discovery/page.tsx
//
// Owner surface · Phase 2B.1 · toggle community discovery for a business.
//
// Consent-first (default off). On opt-in we publish ONE welcome card into
// the chosen hyperlocal zone, visible to that community for 14 days. On
// opt-out we retract the active welcome card.
//
// Zone picker defaults to the owner's community membership zone. The
// owner can also pick any kecamatan under Kota Yogyakarta (Phase 1 city
// scope) · future phases widen to other cities.

import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { listBusinessesByOwner } from "@/lib/nex-native/business-service";
import {
  getBusinessDiscoveryStatus,
  setBusinessDiscovery,
} from "@/lib/nex-native/community/business-discovery-service";
import { getMembershipForAccount } from "@/lib/nex-native/community/membership-service";
import { suggestZonesForOnboarding, getZoneById } from "@/lib/nex-native/community/zone-service";
import { NEX_COMMUNITY_BUSINESS_WELCOME_EXPIRY_DAYS } from "@/lib/nex-native/community/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

export default async function CommunityDiscoveryPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const owned = await listBusinessesByOwner(session.account.id);
  if (owned.length === 0) redirect("/nex-native/onboarding");
  const business = owned[0];

  const [status, membership, zoneOptions] = await Promise.all([
    getBusinessDiscoveryStatus(business.id),
    getMembershipForAccount(session.account.id),
    suggestZonesForOnboarding(),
  ]);

  const currentZone = status?.zoneId ? await getZoneById(status.zoneId) : null;
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;

  // The default-selected zone: current discovery zone, else owner's
  // membership hyperlocal, else first suggested option.
  const defaultZoneId =
    status?.zoneId ??
    membership?.hyperlocal_zone_id ??
    zoneOptions[0]?.id ??
    "";

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-4 border-b border-[var(--nex-neutral-300)] pb-3">
        <h1 className="text-lg font-semibold text-[var(--nex-neutral-900)]">
          Community discovery · {business.display_name}
        </h1>
        <p className="mt-2 text-xs text-neutral-600 leading-relaxed">
          List your business in the local community so neighbours can
          discover you. We&apos;ll post ONE welcome card into the community
          feed for {NEX_COMMUNITY_BUSINESS_WELCOME_EXPIRY_DAYS} days.
          Visible to residents of the zone you pick · no coordinates ·
          no safety-stream placement. You can retract at any time.
        </p>
      </header>

      {banner && (
        <div
          className={`mb-4 rounded border p-3 text-xs ${
            banner.code === "updated"
              ? "border-green-300 bg-green-50 text-green-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
          role="status"
        >
          {banner.message}
        </div>
      )}

      <section className="mb-6 rounded border border-neutral-300 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Current status
            </div>
            <div className="mt-1 text-sm font-semibold text-neutral-900">
              {status?.optIn ? "Listed in community" : "Not listed"}
            </div>
            {status?.toggledAt && (
              <div className="text-xs text-neutral-500">
                last changed{" "}
                {new Date(status.toggledAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
          </div>
          {status?.activeWelcome && (
            <div className="text-right text-xs text-neutral-600">
              <div>Active welcome card</div>
              <div className="text-neutral-500">
                expires{" "}
                {new Date(status.activeWelcome.detail.expires_at).toLocaleString(
                  "en-GB",
                  { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" },
                )}
              </div>
            </div>
          )}
        </div>

        {currentZone && (
          <div className="mb-3 rounded border border-neutral-200 bg-neutral-50 p-2 text-xs">
            <span className="text-neutral-500">Discovery zone · </span>
            <span className="font-medium text-neutral-800">{currentZone.name}</span>
          </div>
        )}

        <form action={toggleDiscoveryAction} className="space-y-3">
          <input type="hidden" name="businessId" value={business.id} />
          <label className="block text-xs text-neutral-600">
            Community (hyperlocal zone)
            <select
              name="zoneId"
              defaultValue={defaultZoneId}
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 bg-white px-2 py-2 text-sm"
            >
              {zoneOptions.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-neutral-500">
              Choose the neighbourhood you want to appear in. You can retract later.
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              name="optIn"
              value="true"
              disabled={status?.optIn}
              className="min-h-[44px] rounded border border-emerald-700 bg-emerald-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status?.optIn ? "Already listed" : "List in community"}
            </button>
            <button
              type="submit"
              name="optIn"
              value="false"
              disabled={!status?.optIn}
              className="min-h-[44px] rounded border border-neutral-500 bg-white px-4 text-sm font-semibold text-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Retract listing
            </button>
          </div>
        </form>
      </section>

      <div className="text-xs">
        <Link href="/nex-native/manage" className="text-neutral-600 underline">
          ← Back to manage
        </Link>
      </div>
    </main>
  );
}

async function toggleDiscoveryAction(formData: FormData): Promise<void> {
  "use server";
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(
      `/nex-native/manage/community-discovery?e=unauthenticated&m=${encodeURIComponent(
        "Session expired · sign in again",
      )}`,
    );
  }
  const businessId = String(formData.get("businessId") ?? "");
  const optInRaw = String(formData.get("optIn") ?? "");
  const zoneIdRaw = String(formData.get("zoneId") ?? "");
  const optIn = optInRaw === "true";
  const zoneId = zoneIdRaw.length > 0 ? zoneIdRaw : null;
  try {
    await setBusinessDiscovery({
      callerAccountId: session.account.id,
      businessId,
      optIn,
      zoneId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    redirect(
      `/nex-native/manage/community-discovery?e=error&m=${encodeURIComponent(msg)}`,
    );
  }
  redirect(
    `/nex-native/manage/community-discovery?e=updated&m=${encodeURIComponent(
      optIn ? "Listed in community" : "Retracted from community",
    )}`,
  );
}
