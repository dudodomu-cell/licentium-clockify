-- Migration 002 — payments, invoices, invoice_settings.
-- Run this AFTER schema.sql (which is the v1 baseline).
-- Safe to re-run: every CREATE uses IF NOT EXISTS where Postgres allows it,
-- and policy/trigger creations are wrapped in DO blocks that swallow
-- duplicate-object errors.

-- ============================================================
-- Payments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  paid_at DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_user_idx    ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_paid_at_idx ON public.payments(paid_at DESC);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY payments_select ON public.payments
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY payments_insert_owner_or_admin ON public.payments
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY payments_update_owner_or_admin ON public.payments
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY payments_delete_owner_or_admin ON public.payments
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Invoice settings (singleton)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoice_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  issuer_name TEXT NOT NULL DEFAULT 'Licentium',
  issuer_details TEXT NOT NULL DEFAULT '',
  default_recipient_name TEXT NOT NULL DEFAULT 'Prokopiev Law',
  default_recipient_email TEXT NOT NULL DEFAULT 'illia@prokopievlaw.com',
  default_recipient_details TEXT NOT NULL DEFAULT '',
  default_payment_terms TEXT NOT NULL DEFAULT 'Due upon receipt',
  default_currency TEXT NOT NULL DEFAULT 'USD',
  invoice_number_prefix TEXT NOT NULL DEFAULT 'LIC',
  next_invoice_seq INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.invoice_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY settings_select ON public.invoice_settings
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY settings_update_admin ON public.invoice_settings
    FOR UPDATE TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.touch_invoice_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS invoice_settings_touch ON public.invoice_settings;
CREATE TRIGGER invoice_settings_touch
  BEFORE UPDATE ON public.invoice_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_invoice_settings_updated_at();

-- ============================================================
-- Invoices
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL CHECK (period_to >= period_from),

  issuer_name TEXT NOT NULL,
  issuer_details TEXT NOT NULL DEFAULT '',
  recipient_name TEXT NOT NULL,
  recipient_email TEXT,
  recipient_details TEXT NOT NULL DEFAULT '',

  payment_terms TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',

  total_amount NUMERIC(10,2) NOT NULL,
  total_hours NUMERIC(10,2) NOT NULL,

  -- Snapshots so historical invoices stay frozen even if entries are edited.
  -- line_items is a JSON array of { description, project_name, hours, rate, amount, user_name }.
  line_items JSONB NOT NULL,
  filter_user_id UUID,
  filter_project_id UUID,

  paid_at DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_issued_at_idx ON public.invoices(issued_at DESC);
CREATE INDEX IF NOT EXISTS invoices_paid_idx ON public.invoices(paid_at);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY invoices_select ON public.invoices
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY invoices_insert_admin ON public.invoices
    FOR INSERT TO authenticated WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY invoices_update_admin ON public.invoices
    FOR UPDATE TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY invoices_delete_admin ON public.invoices
    FOR DELETE TO authenticated USING (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Atomically take the next invoice number and bump the sequence.
-- Returns a string like "LIC-2026-0001".
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  seq INT;
  prefix TEXT;
BEGIN
  UPDATE public.invoice_settings
  SET next_invoice_seq = next_invoice_seq + 1
  WHERE id = 1
  RETURNING next_invoice_seq - 1, invoice_number_prefix INTO seq, prefix;

  RETURN prefix || '-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(seq::TEXT, 4, '0');
END $$;
