-- Rollback for migration 348.
DROP INDEX IF EXISTS public.idx_nex_session_account_live_supersede;
ALTER TABLE public.nex_session
  DROP CONSTRAINT IF EXISTS nex_session_superseded_reason_length;
ALTER TABLE public.nex_session DROP COLUMN IF EXISTS superseded_reason;
ALTER TABLE public.nex_session DROP COLUMN IF EXISTS superseded_at;
DROP INDEX IF EXISTS public.idx_nex_account_active_single_session;
ALTER TABLE public.nex_account DROP COLUMN IF EXISTS active_single_session_id;
