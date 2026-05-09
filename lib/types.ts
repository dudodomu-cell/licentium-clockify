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

export type Payment = {
  id: string;
  user_id: string;
  amount: number;
  paid_at: string;
  note: string;
  created_by: string | null;
  created_at: string;
};

export type PaymentWithUser = Payment & {
  user_name: string;
  user_email: string;
};

export type InvoiceLineItem = {
  description: string;
  project_name: string | null;
  user_name: string;
  hours: number;
  rate: number;
  amount: number;
};

export type Invoice = {
  id: string;
  number: string;
  issued_at: string;
  period_from: string;
  period_to: string;
  issuer_name: string;
  issuer_details: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_details: string;
  payment_terms: string;
  notes: string;
  currency: string;
  total_amount: number;
  total_hours: number;
  line_items: InvoiceLineItem[];
  filter_user_id: string | null;
  filter_project_id: string | null;
  paid_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type InvoiceSettings = {
  id: number;
  issuer_name: string;
  issuer_details: string;
  default_recipient_name: string;
  default_recipient_email: string;
  default_recipient_details: string;
  default_payment_terms: string;
  default_currency: string;
  invoice_number_prefix: string;
  next_invoice_seq: number;
  updated_at: string;
};

// Per-user balance: earned from time entries minus payments received.
export type UserBalance = {
  user_id: string;
  user_name: string;
  user_email: string;
  default_rate: number;
  total_minutes: number;
  total_earned: number;
  total_paid: number;
  balance: number; // positive = owed to this user, negative = prepaid
};
