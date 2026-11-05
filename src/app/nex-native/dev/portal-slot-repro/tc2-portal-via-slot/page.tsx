// TC2 · Server page → Shell (client) with renderHeader prop → Portal.
// This is the exact failure pattern from peer-chat + PortraitBloomShell.
// Expected: 500 if the panic is a generic pattern bug.

import { TestShell } from "../_test-shell";
import { TestPortal } from "../_test-portal";

export const dynamic = "force-dynamic";

export default function TC2Page(): React.JSX.Element {
  return (
    <TestShell
      label="TC2"
      renderHeader={<TestPortal label="TC2-in-slot" />}
    />
  );
}
