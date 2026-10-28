// Read-only post-upload verification.
import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

if (!env.DATABASE_URL?.includes("ijvqdvsvwtwxzcqmoqit")) {
  console.error("ERR: not pointed at ijvqdvsvwtwxzcqmoqit");
  process.exit(2);
}

const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query(`
    SELECT id, title, visibility, storage_bucket, storage_object_path,
           byte_size, duration_seconds, mime_type, rights_declaration,
           country_of_origin, topic_tags, source, published_at,
           owner_account_id, business_id
      FROM nex_uploaded_video
     WHERE owner_account_id = '4f112c32-46a3-4fa4-8b4a-1c5f50caed42'
     ORDER BY published_at
  `);
  console.log(`Hendra rows: ${rows.length}`);
  for (const r of rows) {
    console.log(`  · ${r.title}`);
    console.log(`     id=${r.id}  visibility=${r.visibility}  mime=${r.mime_type}`);
    console.log(`     bucket=${r.storage_bucket}  path=${r.storage_object_path}`);
    console.log(`     bytes=${r.byte_size}  dur=${r.duration_seconds}s`);
    console.log(`     rights=${r.rights_declaration}  country=${r.country_of_origin}  source=${r.source}`);
    console.log(`     tags=${JSON.stringify(r.topic_tags)}`);
    console.log(`     business=${r.business_id}`);
    console.log(`     published=${r.published_at?.toISOString?.() ?? r.published_at}`);
  }
} finally {
  await client.end();
}
