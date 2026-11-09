// src/app/nex-native/profile/[handle]/loading.tsx · R32b · dynamic
// public profile page · 14 awaits · instant paint prevents white
// flash on handle lookup + profile + business + badges resolution.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function ProfileHandleLoading() {
  return <NexLoadingSkeleton label="Profile" rows={5} />;
}
