// Shared TypeScript types for the Clockify domain.
// Mirrors the columns of the Postgres tables in supabase/schema.sql.

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  default_rate: number;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  name: string;
  client: string | null;
  color: string;
  archived: boolean;
  created_by: string | null;
  created_at: string;
};

export type TimeEntry = {
  id: string;
  user_id: string;
  project_id: string | null;
  description: string;
  starts_at: string;
  ends_at: string | null;
  rate: number;
  created_at: string;
  updated_at: string;
};

// Hydrated entry as we fetch it for the UI: joined with the user's name and
// the project's name+color so we don't have to look them up on each row.
export type EntryWithJoins = TimeEntry & {
  user_name: string;
  user_email: string;
  project_name: string | null;
  project_color: string | null;
};
