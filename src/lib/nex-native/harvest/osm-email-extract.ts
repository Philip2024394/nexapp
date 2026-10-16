// src/lib/nex-native/harvest/osm-email-extract.ts
//
// OSM contact-tag email extraction · sealed 2026-10-16.
// --------------------------------------------------------
// Pure, side-effect-free parser that extracts a public business email
// from an OSM element's tag map. NEVER derives from name · NEVER
// constructs info@ · NEVER MX-invents · NEVER returns personal-looking
// addresses · ONLY passes a lightweight format gate so garbage lands
// in `email_status='INVALID'` rather than hidden in the DB.
//
// The six-method extractor at `src/lib/nex/discovery-world/email-
// extractor.ts` remains authoritative for walked-website emails. This
// module is strictly for OSM-tag-sourced emails · a tiny shortcut that
// saves one website walk for the <10% of listings OSM contributors have
// annotated.

export interface OsmEmailExtraction {
  readonly email: string;
  /** URL where the email was observed · for OSM this is the OSM
   *  feature URL. Attribution only · the directory never links users
   *  out to OSM from here. */
  readonly sourceUrl: string;
}

/** Lightweight format check · matches the migration-202 CHECK constraint.
 *  Deliverability verification happens later. */
const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** OSM tag keys that carry a business email, in priority order.
 *  `email` is the primary tag · `contact:email` is the "contact
 *  scheme" variant. We check both. */
const EMAIL_TAG_KEYS: readonly string[] = ["contact:email", "email"];

/**
 * Return an `OsmEmailExtraction` when the OSM tags carry a public
 * email that passes the lightweight format gate · otherwise `null`.
 * Pure · total · deterministic.
 *
 * Policy:
 *   · Only the sealed tag keys are considered · never derived from
 *     any other field.
 *   · Only the FIRST address (if a tag carries a semicolon-separated
 *     list) is kept · "primary contact first" is the OSM convention.
 *   · Whitespace trimmed · case preserved · deliverability unchecked.
 *   · Lightweight format gate matches migration 202 CHECK · a reject
 *     here means the writer will not pass a non-conforming address
 *     into the DB column at all · no `email_status='INVALID'` path
 *     because nothing is persisted.
 */
export function extractOsmEmail(
  tags: Readonly<Record<string, string>>,
  osmFeatureUrl?: string,
): OsmEmailExtraction | null {
  for (const key of EMAIL_TAG_KEYS) {
    const raw = tags[key];
    if (!raw) continue;
    // OSM allows semicolon-separated multi-value tags · take the first
    // addressee only. Primary contact is listed first by convention.
    const first = raw.split(";")[0]?.trim() ?? "";
    if (!first) continue;
    if (!EMAIL_FORMAT.test(first)) continue;
    return {
      email: first,
      sourceUrl: osmFeatureUrl ?? "https://www.openstreetmap.org/",
    };
  }
  return null;
}
