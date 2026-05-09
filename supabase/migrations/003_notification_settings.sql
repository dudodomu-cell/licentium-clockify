-- Migration 003 — notification_settings.
-- Run this AFTER 002_payments_invoices.sql.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.notification_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  slack_enabled BOOLEAN NOT NULL DEFAULT false,
  slack_notify_invoice_created BOOLEAN NOT NULL DEFAULT true,
  slack_notify_invoice_paid BOOLEAN NOT NULL DEFAULT true,
  slack_notify_payment_logged BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.notification_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY notif_select ON public.notification_settings
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY notif_update_admin ON public.notification_settings
    FOR UPDATE TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.touch_notification_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS notification_settings_touch ON public.notification_settings;
CREATE TRIGGER notification_settings_touch
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_notification_settings();
