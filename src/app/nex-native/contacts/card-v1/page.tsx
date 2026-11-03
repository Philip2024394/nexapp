// src/app/nex-native/contacts/card-v1/page.tsx
//
// Card Variant 1 · "Clean Horizon" (flat minimalist) in the prototype-c
// chrome. Signal/iMessage-clean cards. Thin gold rim, white body, 48px
// inline avatar, orange name, chevron right. No chip overlap, no
// translateY tricks.

import { CardVariantShell } from "../_card-variants/_proto-shell";
import { CardV1 } from "../_card-variants/card-v1";
import { PROTOTYPE_IRISH_GOLD } from "../_prototype-shared";

export const dynamic = "force-dynamic";

export default function CardV1Page() {
  return (
    <CardVariantShell
      variant="v1"
      variantLabel="Card V1 · Clean Horizon"
      variantDescription="Flat & minimalist · thin gold rim · 48px avatar inline · iMessage-clean"
      renderCard={(row) => (
        <CardV1 key={row.id} row={row} accentHex={PROTOTYPE_IRISH_GOLD} />
      )}
    />
  );
}
