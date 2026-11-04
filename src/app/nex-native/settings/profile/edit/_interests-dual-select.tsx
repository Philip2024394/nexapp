"use client";

import { useState } from "react";
import { NEX_INTERESTS } from "@/lib/nex-native/profile/interests-registry";

const GOLD = "#C6A15B";
const BORDER_SOFT = "rgba(198, 161, 91, 0.35)";
const FIELD_BG = "rgba(10,31,21,0.65)";
const TEXT_PRIMARY = "#F2F5F8";

interface Props {
  readonly defaultValues: readonly string[];
}

export function InterestsDualSelect({ defaultValues }: Props): React.ReactElement {
  const d0 = defaultValues[0] ?? "";
  const d1 = defaultValues[1] ?? "";
  const [slot1, setSlot1] = useState(d0);
  const [slot2, setSlot2] = useState(d1);

  const slot1Glow = !slot1 && !!slot2;
  const slot2Glow = !!slot1 && !slot2;

  const slot1Options = NEX_INTERESTS.filter((i) => i.id !== slot2);
  const slot2Options = NEX_INTERESTS.filter((i) => i.id !== slot1);

  return (
    <>
      <style>{`
        @keyframes nex-interest-slot-pulse {
          0%   { transform: scale(1);     opacity: 0.9; }
          100% { transform: scale(1.35);  opacity: 0;   }
        }
        [data-nex-interest-slot] { position: relative; }
        [data-nex-interest-slot] > [data-nex-interest-slot-rim] {
          position: absolute;
          inset: 0;
          border-radius: 10px;
          border: 2px solid ${GOLD};
          box-shadow: 0 0 12px ${GOLD}66;
          pointer-events: none;
          opacity: 0;
        }
        [data-nex-interest-slot][data-glow="1"] > [data-nex-interest-slot-rim] {
          animation: nex-interest-slot-pulse 1200ms ease-out infinite;
          transform-origin: center;
        }
        [data-nex-interest-slot] > select {
          background: ${FIELD_BG};
          color: ${TEXT_PRIMARY};
          border: 1px solid ${BORDER_SOFT};
          padding: 11px 13px;
          border-radius: 10px;
          font-size: 15px;
          font-family: inherit;
          outline: none;
          width: 100%;
          appearance: none;
          -webkit-appearance: none;
          background-image:
            linear-gradient(45deg, transparent 50%, ${GOLD} 50%),
            linear-gradient(135deg, ${GOLD} 50%, transparent 50%);
          background-position:
            calc(100% - 18px) center,
            calc(100% - 12px) center;
          background-size: 6px 6px, 6px 6px;
          background-repeat: no-repeat;
          padding-right: 32px;
        }
      `}</style>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <div data-nex-interest-slot data-glow={slot1Glow ? "1" : "0"}>
          <select
            aria-label="Interest field 1"
            value={slot1}
            onChange={(e) => setSlot1(e.target.value)}
          >
            <option value="" style={{ color: "#000" }}>
              Field 1
            </option>
            {slot1Options.map((i) => (
              <option key={i.id} value={i.id} style={{ color: "#000" }}>
                {i.emoji} {i.label}
              </option>
            ))}
          </select>
          {slot1 ? <input type="hidden" name="interests" value={slot1} /> : null}
          <span data-nex-interest-slot-rim aria-hidden />
        </div>
        <div data-nex-interest-slot data-glow={slot2Glow ? "1" : "0"}>
          <select
            aria-label="Interest field 2"
            value={slot2}
            onChange={(e) => setSlot2(e.target.value)}
          >
            <option value="" style={{ color: "#000" }}>
              Field 2
            </option>
            {slot2Options.map((i) => (
              <option key={i.id} value={i.id} style={{ color: "#000" }}>
                {i.emoji} {i.label}
              </option>
            ))}
          </select>
          {slot2 ? <input type="hidden" name="interests" value={slot2} /> : null}
          <span data-nex-interest-slot-rim aria-hidden />
        </div>
      </div>
    </>
  );
}
