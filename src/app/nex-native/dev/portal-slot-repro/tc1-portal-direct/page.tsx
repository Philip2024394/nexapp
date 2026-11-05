// TC1 · Server page → ClientComponent-with-createPortal DIRECTLY.
// Expected: 200 (works · same pattern as Chat Header 99901).

import { TestPortal } from "../_test-portal";

export const dynamic = "force-dynamic";

export default function TC1Page(): React.JSX.Element {
  return (
    <main style={{ padding: 20, color: "#F2F5F8", background: "#123D2B", minHeight: "100dvh" }}>
      <h1>TC1 · Portal rendered DIRECTLY by server page</h1>
      <TestPortal label="TC1" />
    </main>
  );
}
