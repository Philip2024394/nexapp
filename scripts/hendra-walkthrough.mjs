// Hendra 7-area journey walkthrough.
// Signs in using the Supabase client directly (gets a real auth
// session), injects the cookies into Playwright, then visits each
// sealed URL and records the pass/fail/blocked outcome.
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const BASE = 'http://localhost:3008';
const EMAIL = 'nex-hendra@mock.nex.app';
const PASSWORD = 'NexTestHendra-2026-10-28';

const envRaw = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const SUPA_URL = env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const SUPA_ANON = env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;
const supaRef = SUPA_URL.match(/https:\/\/([^.]+)\./)[1];

const SECTIONS = [
  { area: 'Chat landing',             url: '/nex-native/chat' },
  { area: 'Chat inbox',               url: '/nex-native/chat/inbox' },
  { area: 'Themes library',           url: '/nex-native/chat-themes-library' },
  { area: 'Themes · watches-hendra',  url: '/nex-native/themes/watches-hendra' },
  { area: 'Intro settings',           url: '/nex-native/settings/intro-video' },
  { area: 'Vault',                    url: '/nex-native/vault' },
  { area: 'Shop · public',            url: '/nex-native/hendra-watches' },
  { area: 'Shop · manage',            url: '/nex-native/manage/shop' },
  { area: 'Directory',                url: '/nex-native/directory' },
  { area: 'Live feed',                url: '/nex-native/live' },
  { area: 'Live · enter-broadcast-room', url: '/nex-native/live-commerce/enter-broadcast-room' },
  { area: 'Profile · me',             url: '/nex-native/profile/me' },
  { area: 'Contacts',                 url: '/nex-native/contacts' },
];

// 1 · sign in using Supabase JS client · gets access + refresh tokens
console.log('→ signing in Hendra via Supabase client');
const sb = createClient(SUPA_URL, SUPA_ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: signInData, error: signInErr } = await sb.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});
if (signInErr) {
  console.error('!! sign-in failed:', signInErr.message);
  process.exit(1);
}
console.log('✓ signed in · access_token length:', signInData.session.access_token.length);
console.log('   user id:', signInData.session.user.id);
console.log('   email:', signInData.session.user.email);

// 2 · format Supabase SSR cookie · same name Next.js SSR expects
// The SSR cookie value is a base64url-encoded JSON of {access_token, refresh_token, …}
const cookieName = `sb-${supaRef}-auth-token`;
const cookieVal = `base64-${Buffer.from(JSON.stringify({
  access_token: signInData.session.access_token,
  refresh_token: signInData.session.refresh_token,
  expires_in: signInData.session.expires_in,
  expires_at: signInData.session.expires_at,
  token_type: signInData.session.token_type,
  user: signInData.session.user,
})).toString('base64url')}`;

// 3 · launch Playwright with the cookie pre-injected
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 420, height: 909 } });
await ctx.addCookies([
  { name: cookieName, value: cookieVal, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
]);
const page = await ctx.newPage();

// 4 · verify auth is live by hitting a known-signed-in-only route
console.log('\n→ verify auth · hit /profile/me');
await page.goto(`${BASE}/nex-native/profile/me`, { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForTimeout(500);
const verifyUrl = page.url();
console.log('  landed at:', verifyUrl);
if (verifyUrl.includes('/sign-in')) {
  console.error('!! auth cookie did NOT take effect · still bouncing to sign-in');
  console.error('   cookie name was:', cookieName);
  await browser.close();
  process.exit(2);
}
console.log('✓ auth cookie is live\n');

// 5 · visit each section · settle between navs to avoid ERR_ABORTED
// races when the PREVIOUS route issued a server-side redirect (e.g.
// /chat → /contacts) and the next goto() fires before the browser
// has fully committed the first response. Observed 2026-10-28:
// both /chat/inbox and /hendra-watches turned green in isolation
// (curl + direct probe both HTTP 200) but failed in sequence · the
// settle delay + explicit about:blank between routes eliminates it.
const results = [];
for (const s of SECTIONS) {
  await page.goto('about:blank').catch(() => {});
  await page.waitForTimeout(250);
  const start = Date.now();
  let status = 'unknown', final = '', excerpt = '', hendraMarker = false, hasAvatar = false;
  try {
    await page.goto(`${BASE}${s.url}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(600);
    final = page.url();
    const bodyText = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => '')) || '';
    excerpt = bodyText.replace(/\s+/g, ' ').trim().slice(0, 180);
    hendraMarker = /hendra|watches-hendra|nex-50014|Watch Seller|Daytona|Seamaster|Nautilus|Bogor/i.test(bodyText);
    const html = await page.content().catch(() => '');
    hasAvatar = /nex-mock-personas\/hendra\.png/i.test(html);
    if (final.includes('/sign-in')) status = 'FAIL · bounced to /sign-in';
    else if (final.endsWith('/not-found') || /This page could not be found|Not Found 404/i.test(bodyText)) status = 'FAIL · 404';
    else if (/^Coming soon|not available yet in your region|Vault.*LOCKED|is locked/i.test(bodyText)) status = 'BLOCKED · sealed hold';
    else status = 'OK';
  } catch (e) {
    status = `FAIL · ${e.message.split('\n')[0].slice(0, 60)}`;
  }
  const ms = Date.now() - start;
  const line = `[${s.area.padEnd(28)}]  ${status.padEnd(28)}  ${(final.replace(BASE,'') || '(none)').padEnd(50)}  hendra:${hendraMarker ? '✓' : '✗'}  avatar:${hasAvatar ? '✓' : '✗'}  (${ms}ms)`;
  console.log(line);
  results.push({ area: s.area, url: s.url, final, status, hendraMarker, hasAvatar, excerpt });
}

await browser.close();
fs.writeFileSync('scripts/hendra-walkthrough-results.json', JSON.stringify(results, null, 2));
console.log('\n→ full results: scripts/hendra-walkthrough-results.json');
