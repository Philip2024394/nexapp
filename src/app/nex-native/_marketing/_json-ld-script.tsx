// src/app/nex-native/_marketing/_json-ld-script.tsx
//
// Small server component that stringifies and emits a Schema.org payload
// as <script type="application/ml+json">. Keeps the marketing pages terse.

import type * as React from "react";
import { renderJsonLd } from "@/lib/nex-native/seo/json-ld";

export function JsonLdScript({
  payload,
}: {
  readonly payload: Record<string, unknown> | null;
}): React.JSX.Element | null {
  const body = renderJsonLd(payload);
  if (!body) return null;
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
