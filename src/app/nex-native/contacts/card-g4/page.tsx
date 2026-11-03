// src/app/nex-native/contacts/card-g4/page.tsx
//
// Card Variant G4 · "Emerald Dense" · compact Emerald rows · 36px
// avatar · hair-thin gold divider between cards · maximum rows per
// screen.

import { CardVariantShell } from "../_card-variants/_proto-shell";
import { CardG4 } from "../_card-variants/card-g4";
import { PROTOTYPE_IRISH_GOLD } from "../_prototype-shared";

export const dynamic = "force-dynamic";

export default function CardG4Page() {
  return (
    <CardVariantShell
      variant="g4"
      variantLabel="Card G4 · Emerald Dense"
      variantDescription="Emerald bg · 36px avatar · gold hair-divider · WhatsApp density"
      renderCard={(row, i, total) => (
        <CardG4
          key={row.id}
          row={row}
          accentHex={PROTOTYPE_IRISH_GOLD}
          isLast={i === total - 1}
        />
      )}
    />
  );
}
