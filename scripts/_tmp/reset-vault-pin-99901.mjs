import pkg from 'pg';
import { readFileSync } from 'node:fs';
const { Client } = pkg;
const m = readFileSync('.env.local','utf8').match(/^DATABASE_URL=['"]?([^'"\n]+)['"]?$/m);
const url = m[1];
if (!url.includes('kdstoyyeygcopkogqsyv')) { console.error('refuse · not sandbox'); process.exit(2); }
const c = new Client({ connectionString: url });
await c.connect();
const ACCS = ['11111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111113'];
const r = await c.query(`DELETE FROM nex_vault_pin_attempt WHERE account_id = ANY($1)`, [ACCS]);
console.log('cleared vault PIN attempts for VA customer+seller:', r.rowCount);
await c.end();
