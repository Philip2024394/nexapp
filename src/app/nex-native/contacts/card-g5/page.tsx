// src/app/nex-native/contacts/card-g5/page.tsx
//
// Card Variant G5 · "Emerald Luxury" · generous Emerald hero · 64px
// avatar · stacked metadata including shop pill + location + last-seen
// · Gold Chat CTA button on the right.

import { CardVariantShell } from "../_card-variants/_proto-shell";
import { CardG5 } from "../_card-variants/card-g5";
import { PROTOTYPE_IRISH_GOLD } from "../_prototype-shared";

export const dynamic = "force-dynamic";

export default function CardG5Page() {
  return (
    <CardVariantShell
      variant="g5"
      variantLabel="Card G5 · Emerald Luxury"
      variantDescription="Luxurious Emerald hero · 64px avatar · shop pill · location pin · Gold Chat CTA"
      renderCard={(row) => (
        <CardG5 key={row.id} row={row} accentHex={PROTOTYPE_IRISH_GOLD} />
      )}
    />
  );
}
