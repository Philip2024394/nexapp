// src/app/nex-native/contacts/card-g3/page.tsx
//
// Card Variant G3 · "Emerald Executive" · Emerald bg with gold
// double-rim (outer + inner). Reads as a framed exec portrait.
// Shop glyph inline with name · location with pin.

import { CardVariantShell } from "../_card-variants/_proto-shell";
import { CardG3 } from "../_card-variants/card-g3";
import { PROTOTYPE_IRISH_GOLD } from "../_prototype-shared";

export const dynamic = "force-dynamic";

export default function CardG3Page() {
  return (
    <CardVariantShell
      variant="g3"
      variantLabel="Card G3 · Emerald Executive"
      variantDescription="Emerald body · gold double-rim frame · executive portrait feel · city with pin"
      renderCard={(row) => (
        <CardG3 key={row.id} row={row} accentHex={PROTOTYPE_IRISH_GOLD} />
      )}
    />
  );
}
