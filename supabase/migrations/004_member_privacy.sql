-- Migration 004 — tighten RLS so members only see their own data.
-- Pre: schema.sql + 002 + 003 already applied.
-- Safe to re-run (idempotent: drops policies before recreating).

-- ============================================================
-- profiles: members see only their own row
-- ============================================================

DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- ============================================================
-- time_entries: members see only their own entries
-- ============================================================

DROP POLICY IF EXISTS entries_select ON public.time_entries;

CREATE POLICY entries_select_own_or_admin ON public.time_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- payments: members see only their own
-- (already mostly enforced; renaming for consistency)
-- ============================================================

DROP POLICY IF EXISTS payments_select ON public.payments;

CREATE POLICY payments_select_own_or_admin ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- invoices: admin-only read
-- ============================================================

DROP POLICY IF EXISTS invoices_select ON public.invoices;

CREATE POLICY invoices_select_admin ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================
-- invoice_settings: admin-only read
-- ============================================================

DROP POLICY IF EXISTS settings_select ON public.invoice_settings;

CREATE POLICY settings_select_admin ON public.invoice_settings
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================
-- notification_settings: admin-only read
-- ============================================================

DROP POLICY IF EXISTS notif_select ON public.notification_settings;

CREATE POLICY notif_select_admin ON public.notification_settings
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================
-- Note on projects: stays read-all. Members must be able to pick a
-- project when starting a timer, and the names alone aren't sensitive
-- (no money in this table). Per-project hour totals on /projects are
-- naturally limited to what each viewer can see in time_entries.
-- ============================================================
