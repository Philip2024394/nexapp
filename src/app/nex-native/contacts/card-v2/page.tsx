// src/app/nex-native/contacts/card-v2/page.tsx
//
// Card Variant 2 · "Emerald Elevated" (material depth) in the prototype-c
// chrome. Elevated white cards with pronounced emerald-tinted shadow.
// 56px avatar · 17px bold orange name · badge row (shop + last-seen).
// Unread badge replaces the chevron when there are unread messages.

import { CardVariantShell } from "../_card-variants/_proto-shell";
import { CardV2 } from "../_card-variants/card-v2";
import { PROTOTYPE_IRISH_GOLD } from "../_prototype-shared";

export const dynamic = "force-dynamic";

export default function CardV2Page() {
  return (
    <CardVariantShell
      variant="v2"
      variantLabel="Card V2 · Emerald Elevated"
      variantDescription="Material depth · soft shadow · 56px avatar · badge row · Instagram-card feel"
      renderCard={(row) => (
        <CardV2 key={row.id} row={row} accentHex={PROTOTYPE_IRISH_GOLD} />
      )}
    />
  );
}
