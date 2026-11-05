// TC3 · Server page → Shell → dynamic-imported portal with ssr:false.
// Tests whether disabling SSR for the portal component unblocks the
// slot. Expected: 200 if TC2 panics due to SSR of nested client portal.

import { TestShell } from "../_test-shell";
import { TestPortalLazyWrapper } from "../_test-portal-dynamic-wrapper";

export const dynamic = "force-dynamic";

export default function TC3Page(): React.JSX.Element {
  return (
    <TestShell
      label="TC3"
      renderHeader={<TestPortalLazyWrapper label="TC3-lazy" />}
    />
  );
}
