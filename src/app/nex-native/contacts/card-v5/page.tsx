// src/app/nex-native/contacts/card-v5/page.tsx
//
// Card Variant 5 · "Spacious Hero" (generous premium) in the prototype-c
// chrome. 64px avatar · 108px tall card · multiple metadata rows (name
// + verified pill, profession, city with pin, shop badge, last-seen) ·
// Forest-green Chat CTA button on the right.

import { CardVariantShell } from "../_card-variants/_proto-shell";
import { CardV5 } from "../_card-variants/card-v5";
import { PROTOTYPE_IRISH_GOLD } from "../_prototype-shared";

export const dynamic = "force-dynamic";

export default function CardV5Page() {
  return (
    <CardVariantShell
      variant="v5"
      variantLabel="Card V5 · Spacious Hero"
      variantDescription="Luxurious premium · 64px avatar · 108px card · Forest Chat CTA · LinkedIn-feature feel"
      renderCard={(row) => (
        <CardV5 key={row.id} row={row} accentHex={PROTOTYPE_IRISH_GOLD} />
      )}
    />
  );
}
