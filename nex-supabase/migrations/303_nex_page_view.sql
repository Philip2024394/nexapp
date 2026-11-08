-- 303_nex_page_view.sql
-- -----------------------------------------------------------------------------
-- NEX Traffic Analytics · nex_page_view · business + product page views.
-- Owner-authorised 2026-11-08 (round 5).
-- STATUS · AUTHORED · APPLIED TO SANDBOX ONLY · NOT APPLIED to production
-- (ijvqdvsvwtwxzcqmoqit) per CLAUDE.md §5 Safety Constitution + owner's
-- explicit hold on production application for mig 302 + 303.
--
-- Doctrine context (owner directive 2026-11-08 · round 5)
--   · Count GENUINE views · do not inflate numbers.
--   · Prevent accidental duplicate counting from rerenders.
--   · Filter obvious bots / automated requests where reliably identifiable.
--   · Do NOT collect unnecessary personal information.
--   · Do NOT record private chat activity.
--   · Keep business + product views distinguishable.
--   · Country attribution accurate.
--   · Apply retention + access controls.
--   · NEVER label page views as "unique visitors" unless a verified
--     deduplication method exists (we use SHA-256 of a long-lived
--     first-party anonymous cookie · readers expose BOTH total views
--     and COUNT(DISTINCT viewer_token_hash) as separate numbers).
--
-- Privacy posture
--   · viewer_token_hash is SHA-256 of a first-party httpOnly cookie
--     (32 random bytes). Raw cookie never stored · hash not reversible.
--   · user_agent_hash is SHA-256 of User-Agent · raw UA never stored.
--   · No IP address storage. Country attribution derives from the
--     Vercel geo header (x-vercel-ip-country) when present, else from
--     NEX_APP_COUNTRY. Country value is bounded by CHECK constraint.
--   · No chat content · no auth tokens · no PII beyond the signed-in
--     account_id (when the viewer is signed in).
--
-- Columns
--   id                  · surrogate PK
--   business_id         · FK → nex_business · CASCADE on business delete
--   page_type           · 'business' | 'product'
--   product_id          · FK → nex_product · NULL for business views
--   country             · 'ireland' | 'indonesia' | 'worldwide' | 'global'
--   viewer_token_hash   · SHA-256 of anon cookie · 64-hex chars · never raw
--   viewer_account_id   · signed-in account · FK → nex_account · SET NULL
--   user_agent_hash     · SHA-256 of UA · 64-hex chars · may be NULL
--   bot_likely          · tracer-set boolean · bot UA pattern match
--   viewed_at           · server-side timestamp · default now()
--
-- Role scoping · identical discipline to migrations 290-302 ·
-- service_role INSERT + SELECT only, RLS enabled with zero policies.
--
-- Retention (future work · not enforced by this migration)
--   · Owner directive requires retention + access controls. This
--     migration establishes the shape. A follow-up migration + cron
--     job must prune rows older than N days (owner-chosen N). Until
--     that lands, rows accumulate · HQ dashboards window their reads
--     to 30 days so the UI remains bounded.
--
-- Rollback
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '303';
--     DROP INDEX IF EXISTS idx_nex_page_view_business_time;
--     DROP INDEX IF EXISTS idx_nex_page_view_product_time;
--     DROP INDEX IF EXISTS idx_nex_page_view_viewed_at;
--     DROP TABLE IF EXISTS nex_page_view;
--   COMMIT;

begin;

create table if not exists nex_page_view (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references nex_business(id) on delete cascade,
  page_type          text not null,
  product_id         uuid null references nex_product(id) on delete cascade,
  country            text not null,
  viewer_token_hash  text not null,
  viewer_account_id  uuid null references nex_account(id) on delete set null,
  user_agent_hash    text null,
  bot_likely         boolean not null default false,
  viewed_at          timestamptz not null default now(),

  constraint ck_page_view_page_type
    check (page_type in ('business', 'product')),

  -- Product views MUST carry a product_id · business views MUST NOT.
  constraint ck_page_view_product_shape check (
    (page_type = 'product' and product_id is not null)
    or
    (page_type = 'business' and product_id is null)
  ),

  constraint ck_page_view_country check (
    country in ('ireland', 'indonesia', 'worldwide', 'global')
  ),

  -- viewer_token_hash is always 64-char lowercase hex (SHA-256). The
  -- tracer enforces this · the DB enforces the shape as defence in
  -- depth. Prevents a malformed hash from poisoning the index.
  constraint ck_page_view_viewer_token_shape check (
    char_length(viewer_token_hash) = 64
    and viewer_token_hash ~ '^[0-9a-f]{64}$'
  ),

  constraint ck_page_view_user_agent_hash_shape check (
    user_agent_hash is null
    or (char_length(user_agent_hash) = 64 and user_agent_hash ~ '^[0-9a-f]{64}$')
  )
);

comment on table nex_page_view is
  'Owner-sealed 2026-11-08 (round 5) · page-view telemetry for '
  'business + product surfaces. Privacy · no raw IP · no raw UA · '
  'no chat activity · no unnecessary PII. viewer_token_hash is '
  'SHA-256 of a first-party anon cookie (reversibility impossible). '
  'service_role INSERT + SELECT only.';

-- Hot per-business reads (hourly aggregation for HQ Members chart).
create index if not exists idx_nex_page_view_business_time
  on nex_page_view (business_id, viewed_at desc);

-- Per-product reads (product-detail analytics, when wired).
create index if not exists idx_nex_page_view_product_time
  on nex_page_view (product_id, viewed_at desc)
  where product_id is not null;

-- Time-range scans across all businesses (HQ Alerts / global reports).
create index if not exists idx_nex_page_view_viewed_at
  on nex_page_view (viewed_at desc);

-- Role scoping · identical to migrations 290-302. Zero anon /
-- authenticated · service_role INSERT + SELECT only. RLS enabled
-- with zero policies so RLS-aware clients see zero rows.
alter table nex_page_view enable row level security;
revoke all on nex_page_view from public;
revoke all on nex_page_view from authenticated;
revoke all on nex_page_view from anon;
revoke all on nex_page_view from service_role;
grant select, insert on nex_page_view to service_role;

insert into nex_migration_history (version, description, notes)
  values (
    '303',
    'nex_page_view · business + product traffic telemetry',
    'Sandbox-only until owner authorises production apply · owner directive 2026-11-08 (round 5)'
  )
  on conflict do nothing;

commit;
