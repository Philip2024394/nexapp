import pkg from 'pg';
import { readFileSync } from 'node:fs';
const { Client } = pkg;
const m = readFileSync('.env.local','utf8').match(/^DATABASE_URL=['"]?([^'"\n]+)['"]?$/m);
const url = m[1];
if (!url.includes('kdstoyyeygcopkogqsyv')) { process.exit(2); }
const c = new Client({ connectionString: url });
await c.connect();
const ACC = '11111111-1111-4111-8111-111111111111';
const attempts = await c.query(`SELECT COUNT(*)::int AS n, device_id, bool_or(success) AS any_success, MAX(attempted_at) AS last_at FROM nex_vault_pin_attempt WHERE account_id = $1 GROUP BY device_id ORDER BY n DESC`, [ACC]);
console.log('nex_vault_pin_attempt groups:', attempts.rows);
const setup = await c.query(`SELECT account_id, device_id, created_at FROM nex_vault_setup WHERE account_id = $1`, [ACC]);
console.log('nex_vault_setup rows:', setup.rows.length);
setup.rows.forEach(r => console.log(' -', r.device_id, 'created', r.created_at));
const envs = await c.query(`SELECT account_id, device_id, created_at FROM nex_vault_key_envelope WHERE account_id = $1 ORDER BY created_at DESC LIMIT 10`, [ACC]);
console.log('nex_vault_key_envelope rows:', envs.rows.length);
envs.rows.forEach(r => console.log(' -', r.device_id, 'created', r.created_at));
await c.end();
