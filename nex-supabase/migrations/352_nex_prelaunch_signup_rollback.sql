-- =============================================================================
-- Migration 352 · ROLLBACK · nex_prelaunch_signup
-- STATUS: PROPOSAL · Only run after an authorised APPLY of 352.
-- Target when applied: sandbox kdstoyyeygcopkogqsyv ONLY.
-- =============================================================================
--
-- DROP TABLE CASCADE drops the table, its indexes, its RLS state, and any
-- (none expected) dependent objects. This is DESTRUCTIVE · it loses every
-- submitted prelaunch email. Confirm with the owner that any list state has
-- been exported before running.

DROP TABLE IF EXISTS public.nex_prelaunch_signup CASCADE;
