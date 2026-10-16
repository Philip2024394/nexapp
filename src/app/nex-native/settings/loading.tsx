// src/app/nex-native/settings/loading.tsx · instant-paint boundary
// for the Settings route group. Covers /settings and all nested
// subroutes (profile, security, help, tier, notifications, etc.).

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function SettingsLoading() {
  return <NexLoadingSkeleton label="Settings" rows={5} />;
}
