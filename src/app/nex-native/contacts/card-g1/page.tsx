// src/app/nex-native/contacts/card-g1/page.tsx
//
// Card Variant G1 · "Deep Emerald Flat" · Emerald bg cards matching the
// screen chrome colour. 1px gold rim, 44px avatar, orange name, Sage
// profession, gold chevron. Minimal.

import { CardVariantShell } from "../_card-variants/_proto-shell";
import { CardG1 } from "../_card-variants/card-g1";
import { PROTOTYPE_IRISH_GOLD } from "../_prototype-shared";

export const dynamic = "force-dynamic";

export default function CardG1Page() {
  return (
    <CardVariantShell
      variant="g1"
      variantLabel="Card G1 · Deep Emerald Flat"
      variantDescription="Emerald body matching the screen chrome · thin gold rim · 44px avatar · minimal"
      renderCard={(row) => (
        <CardG1 key={row.id} row={row} accentHex={PROTOTYPE_IRISH_GOLD} />
      )}
    />
  );
}
