-- Licentium Clockify schema
-- Run this once in the Supabase SQL editor after creating a fresh project.

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  default_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client TEXT,
  color TEXT NOT NULL DEFAULT '#5eead4',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- FK targets `profiles` rather than `auth.users` so PostgREST can auto-embed
  -- the user's name/email when we fetch entries. profiles.id mirrors
  -- auth.users.id one-to-one (same UUID).
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT entries_end_after_start CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

-- Only one running timer per user.
CREATE UNIQUE INDEX time_entries_one_running_per_user
  ON public.time_entries(user_id) WHERE ends_at IS NULL;

CREATE INDEX time_entries_starts_at_idx ON public.time_entries(starts_at DESC);
CREATE INDEX time_entries_user_idx     ON public.time_entries(user_id);
CREATE INDEX time_entries_project_idx  ON public.time_entries(project_id);

-- ============================================================
-- Triggers
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_touch
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER time_entries_touch
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed a profile for every newly-created auth user.
-- Admins are hardcoded by email here so the very first sign-in works without
-- manual SQL — adjust the array when you onboard or remove an admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_emails TEXT[] := ARRAY[
    'dmytro.o@licentium.io',
    'illia@prokopievlaw.com'
  ];
BEGIN
  INSERT INTO public.profiles (id, email, full_name, default_rate, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    15,
    NEW.email = ANY(admin_emails)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Row level security
-- ============================================================

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- Profiles: every signed-in user can read every profile (the team is small and
-- visibility is intentionally open). Users can update their own; admins can
-- update anyone's (e.g. to change a default rate).
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Projects: everyone can read/write/archive — full collaboration.
CREATE POLICY projects_select ON public.projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY projects_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY projects_update ON public.projects
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY projects_delete ON public.projects
  FOR DELETE TO authenticated USING (true);

-- Time entries: everyone reads; only the owner mutates (admins can mutate any).
CREATE POLICY entries_select ON public.time_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY entries_insert_self ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY entries_update_owner_or_admin ON public.time_entries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY entries_delete_owner_or_admin ON public.time_entries
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- ============================================================
-- Backfill — make sure any auth.users who already exist also have a profile.
-- Safe to re-run; ON CONFLICT keeps existing rows untouched.
-- ============================================================

INSERT INTO public.profiles (id, email, full_name, default_rate, is_admin)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  15,
  u.email IN ('dmytro.o@licentium.io', 'illia@prokopievlaw.com')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
