// src/app/nex-native/contacts/card-g2/page.tsx
//
// Card Variant G2 · "Emerald Floating" · Emerald bg with gold-tinted
// shadow. 56px avatar. Shop + location + last-seen badge row.

import { CardVariantShell } from "../_card-variants/_proto-shell";
import { CardG2 } from "../_card-variants/card-g2";
import { PROTOTYPE_IRISH_GOLD } from "../_prototype-shared";

export const dynamic = "force-dynamic";

export default function CardG2Page() {
  return (
    <CardVariantShell
      variant="g2"
      variantLabel="Card G2 · Emerald Floating"
      variantDescription="Emerald body · gold-tinted shadow · 56px avatar · location pill · badge row"
      renderCard={(row) => (
        <CardG2 key={row.id} row={row} accentHex={PROTOTYPE_IRISH_GOLD} />
      )}
    />
  );
}
