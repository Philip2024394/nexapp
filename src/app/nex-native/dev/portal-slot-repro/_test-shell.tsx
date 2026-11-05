"use client";

// Minimal client "Shell" wrapper · mirrors PortraitBloomShell structure
// at the simplest possible level. Accepts a ReactNode slot.

import * as React from "react";

interface TestShellProps {
  readonly label: string;
  readonly renderHeader?: React.ReactNode;
}

export function TestShell({ label, renderHeader }: TestShellProps): React.JSX.Element {
  return (
    <main data-nex-test-shell style={{ padding: 20, color: "#F2F5F8" }}>
      <h2>TestShell · {label}</h2>
      <div data-nex-test-shell-slot>{renderHeader}</div>
      <p>Shell body content below the slot.</p>
    </main>
  );
}
