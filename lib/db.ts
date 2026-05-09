import { getSupabaseServer } from "./supabase/server";
import { durationMinutes } from "./format";
import type {
  EntryWithJoins,
  Invoice,
  InvoiceSettings,
  Payment,
  PaymentWithUser,
  Profile,
  Project,
  UserBalance,
} from "./types";

// ---------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------

export async function fetchProfiles(): Promise<Profile[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as Profile[];
}

// ---------------------------------------------------------------
// Projects
// ---------------------------------------------------------------

export async function fetchProjects(opts: { includeArchived?: boolean } = {}): Promise<Project[]> {
  const supabase = await getSupabaseServer();
  let q = supabase.from("projects").select("*").order("name");
  if (!opts.includeArchived) q = q.eq("archived", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Project[];
}

// ---------------------------------------------------------------
// Time entries
// ---------------------------------------------------------------

export type EntriesFilter = {
  since?: string;
  until?: string;
  userId?: string;
  projectId?: string;
  // Include the running entry even if it falls outside [since, until).
  // (Used on the dashboard so a long-running timer started yesterday still
  // shows up on today's view.)
  includeRunning?: boolean;
};

type RawJoinRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  description: string;
  starts_at: string;
  ends_at: string | null;
  rate: number | string;
  created_at: string;
  updated_at: string;
  profiles: { full_name: string; email: string } | null;
  projects: { name: string; color: string } | null;
};

function mapEntry(row: RawJoinRow): EntryWithJoins {
  return {
    id: row.id,
    user_id: row.user_id,
    project_id: row.project_id,
    description: row.description,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    rate: Number(row.rate),
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_name: row.profiles?.full_name ?? "—",
    user_email: row.profiles?.email ?? "",
    project_name: row.projects?.name ?? null,
    project_color: row.projects?.color ?? null,
  };
}

export async function fetchEntries(filter: EntriesFilter = {}): Promise<EntryWithJoins[]> {
  const supabase = await getSupabaseServer();

  const select = "*, profiles(full_name, email), projects(name, color)";
  let q = supabase.from("time_entries").select(select).order("starts_at", { ascending: false });

  if (filter.since) q = q.gte("starts_at", filter.since);
  if (filter.until) q = q.lt("starts_at", filter.until);
  if (filter.userId) q = q.eq("user_id", filter.userId);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []) as unknown as RawJoinRow[];

  if (filter.includeRunning) {
    // Re-fetch any running entries (ends_at IS NULL) that wouldn't match the
    // since/until window because they started before it. Merge unique.
    let runQ = supabase
      .from("time_entries")
      .select(select)
      .is("ends_at", null);
    if (filter.userId) runQ = runQ.eq("user_id", filter.userId);
    if (filter.projectId) runQ = runQ.eq("project_id", filter.projectId);
    const { data: runData, error: runErr } = await runQ;
    if (runErr) throw runErr;

    const seen = new Set(rows.map((r) => r.id));
    for (const r of (runData ?? []) as unknown as RawJoinRow[]) {
      if (!seen.has(r.id)) {
        rows = [r, ...rows];
        seen.add(r.id);
      }
    }
  }

  return rows.map(mapEntry);
}

export async function fetchRunningEntry(userId: string): Promise<EntryWithJoins | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*, profiles(full_name, email), projects(name, color)")
    .eq("user_id", userId)
    .is("ends_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapEntry(data as unknown as RawJoinRow);
}

// ---------------------------------------------------------------
// Payments
// ---------------------------------------------------------------

type RawPaymentJoinRow = {
  id: string;
  user_id: string;
  amount: number | string;
  paid_at: string;
  note: string;
  created_by: string | null;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
};

function mapPayment(row: RawPaymentJoinRow): PaymentWithUser {
  return {
    id: row.id,
    user_id: row.user_id,
    amount: Number(row.amount),
    paid_at: row.paid_at,
    note: row.note,
    created_by: row.created_by,
    created_at: row.created_at,
    user_name: row.profiles?.full_name ?? "—",
    user_email: row.profiles?.email ?? "",
  };
}

export async function fetchPayments(opts: { userId?: string } = {}): Promise<PaymentWithUser[]> {
  const supabase = await getSupabaseServer();
  // payments has TWO FKs to profiles (user_id and created_by) — disambiguate
  // explicitly by FK name, otherwise PostgREST refuses with PGRST201.
  let q = supabase
    .from("payments")
    .select("*, profiles!payments_user_id_fkey(full_name, email)")
    .order("paid_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as unknown as RawPaymentJoinRow[]).map(mapPayment);
}

// ---------------------------------------------------------------
// Balances — earned minus paid, per user, all-time
// ---------------------------------------------------------------

export async function computeBalances(): Promise<UserBalance[]> {
  // We deliberately compute in JS instead of via SQL aggregates: the team is
  // small (a handful of users, low thousands of entries), and doing it here
  // keeps the SQL schema simpler and matches how the dashboard already works.
  const [profiles, entries, payments] = await Promise.all([
    fetchProfiles(),
    fetchEntries({}),
    fetchPayments({}),
  ]);

  const out = new Map<string, UserBalance>();
  for (const p of profiles) {
    out.set(p.id, {
      user_id: p.id,
      user_name: p.full_name,
      user_email: p.email,
      default_rate: Number(p.default_rate),
      total_minutes: 0,
      total_earned: 0,
      total_paid: 0,
      balance: 0,
    });
  }

  for (const e of entries) {
    const b = out.get(e.user_id);
    if (!b) continue;
    const m = durationMinutes(e.starts_at, e.ends_at);
    b.total_minutes += m;
    b.total_earned += (m / 60) * Number(e.rate);
  }

  for (const p of payments) {
    const b = out.get(p.user_id);
    if (!b) continue;
    b.total_paid += Number(p.amount);
  }

  for (const b of out.values()) {
    b.balance = b.total_earned - b.total_paid;
  }

  return [...out.values()].sort((a, b) => b.balance - a.balance);
}

// ---------------------------------------------------------------
// Invoice settings + invoices
// ---------------------------------------------------------------

export async function fetchInvoiceSettings(): Promise<InvoiceSettings> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("invoice_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data as InvoiceSettings;
}

function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: row.id as string,
    number: row.number as string,
    issued_at: row.issued_at as string,
    period_from: row.period_from as string,
    period_to: row.period_to as string,
    issuer_name: row.issuer_name as string,
    issuer_details: (row.issuer_details as string) ?? "",
    recipient_name: row.recipient_name as string,
    recipient_email: (row.recipient_email as string | null) ?? null,
    recipient_details: (row.recipient_details as string) ?? "",
    payment_terms: (row.payment_terms as string) ?? "",
    notes: (row.notes as string) ?? "",
    currency: (row.currency as string) ?? "USD",
    total_amount: Number(row.total_amount),
    total_hours: Number(row.total_hours),
    line_items: (row.line_items as Invoice["line_items"]) ?? [],
    filter_user_id: (row.filter_user_id as string | null) ?? null,
    filter_project_id: (row.filter_project_id as string | null) ?? null,
    paid_at: (row.paid_at as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function fetchInvoices(): Promise<Invoice[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("issued_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(mapInvoice);
}

export async function fetchInvoiceById(id: string): Promise<Invoice | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapInvoice(data as Record<string, unknown>);
}
