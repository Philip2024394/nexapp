// src/app/nex-native/contacts/card-v4/page.tsx
//
// Card Variant 4 · "Dense Scroll" (WhatsApp-style compact) in the
// prototype-c chrome. 36px avatar · 56px tall rows · thin bottom
// borders instead of individual card shadows · maximum rows per screen.
// Unread badge or shop glyph on the right.

import { CardVariantShell } from "../_card-variants/_proto-shell";
import { CardV4 } from "../_card-variants/card-v4";
import { PROTOTYPE_IRISH_GOLD } from "../_prototype-shared";

export const dynamic = "force-dynamic";

export default function CardV4Page() {
  return (
    <CardVariantShell
      variant="v4"
      variantLabel="Card V4 · Dense Scroll"
      variantDescription="WhatsApp density · 36px avatar · 56px row · maximum contacts per screen"
      renderCard={(row, i, total) => (
        <CardV4
          key={row.id}
          row={row}
          accentHex={PROTOTYPE_IRISH_GOLD}
          isLast={i === total - 1}
        />
      )}
    />
  );
}
