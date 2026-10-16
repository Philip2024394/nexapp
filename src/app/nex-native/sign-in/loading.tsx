// src/app/nex-native/sign-in/loading.tsx · instant-paint boundary
// for the Sign-In surface · covers the Supabase client-init gap.

import { NexLoadingSkeleton } from "@/components/nex-native/nex-loading-skeleton";

export default function SignInLoading() {
  return <NexLoadingSkeleton label="Sign in" rows={3} />;
}
