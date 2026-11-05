"use client";

// Minimal client component that uses createPortal · mirrors
// HeaderSearch/ControlDrawer's pattern. Portal target gated by a
// mounted flag like the sealed components do.

import * as React from "react";
import { createPortal } from "react-dom";

export function TestPortal({ label }: { readonly label: string }): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [mountNode, setMountNode] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setMountNode(document.body);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-nex-test-portal-trigger
        style={{
          padding: "8px 14px",
          background: "#1B5138",
          color: "#F2F5F8",
          border: "1px solid #C6A15B",
          borderRadius: 999,
        }}
      >
        TestPortal · {label} · {open ? "close" : "open"}
      </button>
      {open && mountNode
        ? createPortal(
            <div
              data-nex-test-portal-panel
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                color: "#F2F5F8",
                display: "grid",
                placeItems: "center",
                zIndex: 9999,
              }}
              onClick={() => setOpen(false)}
            >
              Portal panel {label} · tap to close
            </div>,
            mountNode,
          )
        : null}
    </>
  );
}
