import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const BASE = 'http://localhost:3008';
const envRaw = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envRaw.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2]; }

const sb = createClient(env.NEXT_PUBLIC_NEX_SUPABASE_URL, env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: s } = await sb.auth.signInWithPassword({ email: 'nex-hendra@mock.nex.app', password: 'NexTestHendra-2026-10-28' });
const ref = env.NEXT_PUBLIC_NEX_SUPABASE_URL.match(/https:\/\/([^.]+)\./)[1];
const cookieVal = 'base64-' + Buffer.from(JSON.stringify({
  access_token: s.session.access_token, refresh_token: s.session.refresh_token,
  expires_in: s.session.expires_in, expires_at: s.session.expires_at,
  token_type: s.session.token_type, user: s.session.user,
})).toString('base64url');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 420, height: 909 } });
await ctx.addCookies([{ name: `sb-${ref}-auth-token`, value: cookieVal, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
const page = await ctx.newPage();

const URLS = [
  '/nex-native/hendra-watches?commerce=1',
  '/nex-native/manage/shop?commerce=1',
];
for (const u of URLS) {
  await page.goto(`${BASE}${u}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(600);
  const final = page.url().replace(BASE, '');
  const body = await page.locator('body').innerText().catch(() => '');
  const hendra = /hendra|watches-hendra|Daytona|Seamaster|Nautilus|Bogor|Watch Seller/i.test(body);
  const html = await page.content().catch(() => '');
  const avatar = /nex-mock-personas\/hendra\.png/i.test(html);
  console.log(`${u.padEnd(50)} → ${final.padEnd(50)}  hendra:${hendra?'✓':'✗'}  avatar:${avatar?'✓':'✗'}`);
  console.log(`   excerpt: ${body.replace(/\s+/g,' ').trim().slice(0,180)}`);
}

await browser.close();
