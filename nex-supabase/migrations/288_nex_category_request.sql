-- 288_nex_category_request.sql
-- -----------------------------------------------------------------------------
-- NEX Shop · seller-submitted missing-category requests · owner-sealed 2026-11-07.
--
-- STATUS: AUTHORED · NOT YET APPLIED. Owner directive 2026-11-07
-- authorises preparation + review only. A separate explicit
-- application authorisation is required before this migration touches
-- any database.
--
-- Purpose:
--   The owner directive mandates that NEX never force a seller into
--   an inaccurate business classification. When no existing Rev 6
--   subtype matches a seller's actual business, they submit a
--   request describing the business + the category they tentatively
--   chose. A separate HQ-admin flow (not built in this migration)
--   reviews requests · approved ones become additive subtype
--   proposals; rejected ones get reviewer notes explaining why.
--
-- NEX never auto-creates subtypes from user submissions. This table
-- is a review queue, not a live classifier.
--
-- Columns:
--   id              uuid pk · defaults gen_random_uuid()
--   account_id      uuid fk nex_account(id) on delete set null
--                   · nullable so a deleted account's requests
--                     survive for HQ post-mortem analysis
--   business_id     uuid fk nex_business(id) on delete set null
--                   · nullable · the account may request before
--                     provisioning a business row
--   business_name   text · 2..120 chars · what the seller calls
--                     themselves
--   business_description text · 10..1000 chars · free-form
--                     description so HQ reviewer understands the
--                     business model
--   requested_category text · nullable · the Rev 6 category the
--                     seller thinks best fits (e.g., "services")
--   requested_subtype_label text · nullable · the specific
--                     subcategory name the seller would like
--                     (e.g., "Yoga retreats", "Artisan cheese")
--   status          text · pending|under_review|added|rejected
--   reviewer_notes  text · nullable · HQ-admin facing
--   created_at      timestamptz · default now()
--   reviewed_at     timestamptz · nullable
--
-- RLS:
--   · Insert: authenticated account may insert where account_id = auth.uid()
--   · Select own: authenticated account may read rows they submitted
--   · Select all / update: service role only (HQ admin)

begin;

create table if not exists nex_category_request (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references nex_account(id) on delete set null,
  business_id uuid references nex_business(id) on delete set null,
  business_name text not null,
  business_description text not null,
  requested_category text,
  requested_subtype_label text,
  status text not null default 'pending',
  reviewer_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table nex_category_request
  drop constraint if exists nex_category_request_status_check,
  drop constraint if exists nex_category_request_name_length_check,
  drop constraint if exists nex_category_request_description_length_check,
  drop constraint if exists nex_category_request_category_valid_check;

alter table nex_category_request
  add constraint nex_category_request_status_check
    check (status in ('pending', 'under_review', 'added', 'rejected')),
  add constraint nex_category_request_name_length_check
    check (char_length(business_name) between 2 and 120),
  add constraint nex_category_request_description_length_check
    check (char_length(business_description) between 10 and 1000),
  add constraint nex_category_request_category_valid_check
    check (
      requested_category is null
      or requested_category in ('food', 'accommodation', 'property', 'products', 'services')
    );

create index if not exists idx_nex_category_request_status_created
  on nex_category_request (status, created_at desc);

create index if not exists idx_nex_category_request_account
  on nex_category_request (account_id)
  where account_id is not null;

alter table nex_category_request enable row level security;

drop policy if exists nex_category_request_insert_self on nex_category_request;
drop policy if exists nex_category_request_select_self on nex_category_request;

create policy nex_category_request_insert_self
  on nex_category_request
  for insert
  to authenticated
  with check (account_id = auth.uid());

create policy nex_category_request_select_self
  on nex_category_request
  for select
  to authenticated
  using (account_id = auth.uid());

comment on table nex_category_request is
  'Seller-submitted missing-category requests · owner-sealed 2026-11-07
   per the "no legitimate business left without a category" directive.
   Review queue only · never auto-creates Rev 6 subtypes. Approved
   requests become additive proposals authored by owner.';

insert into nex_migration_history (version, description, notes)
  values (
    '288',
    'Phase B · nex_category_request table · seller missing-category submissions',
    'Owner-sealed 2026-11-07. Review queue for the Shop Setup "Request a category" flow. HQ admin review path is a separate authorisation gate.'
  )
  on conflict (version) do nothing;

commit;
