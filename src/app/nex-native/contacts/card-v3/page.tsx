// src/app/nex-native/contacts/card-v3/page.tsx
//
// Card Variant 3 · "Irish Business Card" (emerald + gold stripe) in the
// prototype-c chrome. Full emerald card body with a 4px gold vertical
// stripe on the left · city with map-pin alongside profession · gold
// circle action affordance on the right.

import { CardVariantShell } from "../_card-variants/_proto-shell";
import { CardV3 } from "../_card-variants/card-v3";
import { PROTOTYPE_IRISH_GOLD } from "../_prototype-shared";

export const dynamic = "force-dynamic";

export default function CardV3Page() {
  return (
    <CardVariantShell
      variant="v3"
      variantLabel="Card V3 · Irish Business Card"
      variantDescription="Emerald body · gold left stripe · premium business-card feel · city with pin"
      renderCard={(row) => (
        <CardV3 key={row.id} row={row} accentHex={PROTOTYPE_IRISH_GOLD} />
      )}
    />
  );
}
