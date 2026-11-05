"use client";

// Thin Client Component wrapper that dynamic-imports TestPortal with
// ssr:false. Only Client Components can use next/dynamic with ssr:false.

import dynamic from "next/dynamic";

const TestPortalLazy = dynamic(
  () => import("./_test-portal").then((m) => m.TestPortal),
  { ssr: false },
);

export function TestPortalLazyWrapper({ label }: { readonly label: string }): React.JSX.Element {
  return <TestPortalLazy label={label} />;
}
