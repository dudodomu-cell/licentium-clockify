"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fetchEntries, fetchInvoiceSettings } from "@/lib/db";
import { durationMinutes } from "@/lib/format";
import { notifySlack } from "@/lib/slack";
import { localToUtcIso, TEAM_TZ } from "@/lib/tz";
import { VIEWER_TZ_COOKIE } from "@/lib/viewer-tz";
import type { InvoiceLineItem } from "@/lib/types";

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function requireUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function strOrNull(form: FormData, key: string): string | null {
  const v = str(form, key);
  return v === "" ? null : v;
}

function num(form: FormData, key: string, fallback = 0): number {
  const v = form.get(key);
  if (typeof v !== "string") return fallback;
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/projects");
  revalidatePath("/export");
  revalidatePath("/payments");
  revalidatePath("/invoices");
}

// Reads the submitter's timezone from the cookie so that datetime-local
// strings sent by their browser are interpreted in their wall-clock.
async function submitterTz(): Promise<string> {
  const c = await cookies();
  const tz = c.get(VIEWER_TZ_COOKIE)?.value;
  if (!tz) return TEAM_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return TEAM_TZ;
  }
}

// ---------------------------------------------------------------
// Auth
// ---------------------------------------------------------------

export async function signOutAction() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------
// Timer (start/stop)
// ---------------------------------------------------------------

export async function startTimerAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const description = str(formData, "description");
  const projectId = strOrNull(formData, "project_id");

  // Stop any currently-running timer for this user — Clockify-style: starting
  // a new one auto-stops the previous one. Without this the unique partial
  // index on running entries would refuse the insert.
  const now = new Date().toISOString();
  await supabase
    .from("time_entries")
    .update({ ends_at: now })
    .eq("user_id", user.id)
    .is("ends_at", null);

  // Pick rate from the user's profile default.
  const { data: profile } = await supabase
    .from("profiles")
    .select("default_rate")
    .eq("id", user.id)
    .single();

  const rate = Number(profile?.default_rate ?? 0);

  await supabase.from("time_entries").insert({
    user_id: user.id,
    project_id: projectId,
    description,
    starts_at: now,
    ends_at: null,
    rate,
  });

  refresh();
}

export async function stopTimerAction() {
  const { supabase, user } = await requireUser();
  await supabase
    .from("time_entries")
    .update({ ends_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("ends_at", null);
  refresh();
}

// ---------------------------------------------------------------
// Time entries CRUD
// ---------------------------------------------------------------

// Manual entry — start/end specified by hand.
export async function createEntryAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const description = str(formData, "description");
  const projectId = strOrNull(formData, "project_id");
  const startsAt = str(formData, "starts_at");
  const endsAt = str(formData, "ends_at");
  const rate = num(formData, "rate");

  if (!startsAt || !endsAt) {
    throw new Error("Start and end times are required for manual entries.");
  }

  const tz = await submitterTz();
  await supabase.from("time_entries").insert({
    user_id: user.id,
    project_id: projectId,
    description,
    starts_at: localToUtcIso(startsAt, tz),
    ends_at: localToUtcIso(endsAt, tz),
    rate,
  });

  refresh();
}

export async function updateEntryAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) throw new Error("Entry id missing.");

  const description = str(formData, "description");
  const projectId = strOrNull(formData, "project_id");
  const startsAt = str(formData, "starts_at");
  const endsAt = strOrNull(formData, "ends_at");
  const rate = num(formData, "rate");

  const tz = await submitterTz();
  const patch: Record<string, unknown> = {
    description,
    project_id: projectId,
    starts_at: localToUtcIso(startsAt, tz),
    rate,
  };
  patch.ends_at = endsAt ? localToUtcIso(endsAt, tz) : null;

  // RLS enforces that only the owner (or an admin) can perform this update.
  const { error } = await supabase
    .from("time_entries")
    .update(patch)
    .eq("id", id);
  if (error) throw error;

  refresh();
}

export async function deleteEntryAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) throw new Error("Entry id missing.");

  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) throw error;

  refresh();
}

// ---------------------------------------------------------------
// Projects CRUD
// ---------------------------------------------------------------

export async function createProjectAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = str(formData, "name");
  const client = strOrNull(formData, "client");
  const color = str(formData, "color") || "#5eead4";
  if (!name) throw new Error("Project name required.");

  const { error } = await supabase.from("projects").insert({
    name,
    client,
    color,
    created_by: user.id,
  });
  if (error) throw error;

  refresh();
}

export async function updateProjectAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) throw new Error("Project id missing.");

  const name = str(formData, "name");
  const client = strOrNull(formData, "client");
  const color = str(formData, "color") || "#5eead4";
  const archived = str(formData, "archived") === "true";

  const { error } = await supabase
    .from("projects")
    .update({ name, client, color, archived })
    .eq("id", id);
  if (error) throw error;

  refresh();
}

export async function toggleArchiveProjectAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  const archived = str(formData, "archived") === "true";

  const { error } = await supabase
    .from("projects")
    .update({ archived: !archived })
    .eq("id", id);
  if (error) throw error;

  refresh();
}

export async function deleteProjectAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) throw new Error("Project id missing.");

  // Existing entries will keep `project_id = NULL` after delete (FK ON DELETE
  // SET NULL), so historical hours aren't lost.
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;

  refresh();
}

// ---------------------------------------------------------------
// Profile
// ---------------------------------------------------------------

export async function updateProfileAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const fullName = str(formData, "full_name");
  const defaultRate = num(formData, "default_rate");
  // Optional target_id — admins can edit other people's rates by passing this.
  // RLS rejects the write if a non-admin tries to set target_id ≠ self.
  const targetId = strOrNull(formData, "target_id") ?? user.id;

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, default_rate: defaultRate })
    .eq("id", targetId);
  if (error) throw error;

  refresh();
}

// ---------------------------------------------------------------
// Payments
// ---------------------------------------------------------------

export async function addPaymentAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  // user_id is who got paid. Defaults to self; admins can choose any user.
  // RLS rejects if non-admin sets user_id ≠ self.
  const userId = strOrNull(formData, "user_id") ?? user.id;
  const amount = num(formData, "amount");
  const paidAt = str(formData, "paid_at");
  const note = str(formData, "note");

  if (!paidAt) throw new Error("Payment date required.");
  if (!(amount > 0)) throw new Error("Amount must be positive.");

  const { error } = await supabase.from("payments").insert({
    user_id: userId,
    amount,
    paid_at: paidAt,
    note,
    created_by: user.id,
  });
  if (error) throw error;

  // Slack notification (best-effort; swallowed on failure inside notifySlack).
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", [userId, user.id]);
  const paidUser = profiles?.find((p) => p.id === userId);
  const logger = profiles?.find((p) => p.id === user.id);
  await notifySlack({
    type: "payment_logged",
    userName: paidUser?.full_name ?? paidUser?.email ?? "unknown",
    amount,
    paidAt,
    note,
    loggedBy: logger?.full_name ?? user.email ?? "unknown",
    isSelfLog: userId === user.id,
  });

  refresh();
}

export async function updatePaymentAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) throw new Error("Payment id missing.");
  const amount = num(formData, "amount");
  const paidAt = str(formData, "paid_at");
  const note = str(formData, "note");

  const { error } = await supabase
    .from("payments")
    .update({ amount, paid_at: paidAt, note })
    .eq("id", id);
  if (error) throw error;

  refresh();
}

export async function deletePaymentAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  if (!id) throw new Error("Payment id missing.");
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
  refresh();
}

// ---------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------

export async function updateInvoiceSettingsAction(formData: FormData) {
  const { supabase } = await requireUser();
  const patch = {
    issuer_name: str(formData, "issuer_name"),
    issuer_details: str(formData, "issuer_details"),
    default_recipient_name: str(formData, "default_recipient_name"),
    default_recipient_email: str(formData, "default_recipient_email"),
    default_recipient_details: str(formData, "default_recipient_details"),
    default_payment_terms: str(formData, "default_payment_terms"),
    default_currency: str(formData, "default_currency") || "USD",
    invoice_number_prefix: str(formData, "invoice_number_prefix") || "LIC",
  };
  const { error } = await supabase
    .from("invoice_settings")
    .update(patch)
    .eq("id", 1);
  if (error) throw error;
  refresh();
}

// ---------------------------------------------------------------
// Notification settings
// ---------------------------------------------------------------

export async function updateNotificationSettingsAction(formData: FormData) {
  const { supabase } = await requireUser();
  const patch = {
    slack_enabled: formData.get("slack_enabled") === "on",
    slack_notify_invoice_created:
      formData.get("slack_notify_invoice_created") === "on",
    slack_notify_invoice_paid:
      formData.get("slack_notify_invoice_paid") === "on",
    slack_notify_payment_logged:
      formData.get("slack_notify_payment_logged") === "on",
  };
  const { error } = await supabase
    .from("notification_settings")
    .update(patch)
    .eq("id", 1);
  if (error) throw error;
  refresh();
}

// Aggregate matching entries into invoice line items, then snapshot the
// invoice. Each line is a (description, project, rate) tuple — repeated
// occurrences over multiple days collapse into one line. Uses
// useActionState shape so the form can render validation errors inline
// instead of falling through to Next.js's generic error overlay.
export type CreateInvoiceState = { error: string | null };

export async function createInvoiceAction(
  _prevState: CreateInvoiceState,
  formData: FormData,
): Promise<CreateInvoiceState> {
  const { supabase, user } = await requireUser();

  const periodFrom = str(formData, "period_from");
  const periodTo = str(formData, "period_to");
  if (!periodFrom || !periodTo) return { error: "Period from/to required." };
  const filterUserId = strOrNull(formData, "filter_user_id");
  const filterProjectId = strOrNull(formData, "filter_project_id");

  const recipientName = str(formData, "recipient_name");
  const recipientEmail = strOrNull(formData, "recipient_email");
  const recipientDetails = str(formData, "recipient_details");
  const paymentTerms = str(formData, "payment_terms");
  const notes = str(formData, "notes");
  const currency = str(formData, "currency") || "USD";
  if (!recipientName) return { error: "Recipient name required." };

  const settings = await fetchInvoiceSettings();

  // Fetch matching entries — period is inclusive on both ends.
  const sinceIso = new Date(periodFrom + "T00:00:00").toISOString();
  const toExclusive = new Date(periodTo + "T00:00:00");
  toExclusive.setDate(toExclusive.getDate() + 1);
  const untilIso = toExclusive.toISOString();

  const entries = await fetchEntries({
    since: sinceIso,
    until: untilIso,
    userId: filterUserId ?? undefined,
    projectId: filterProjectId ?? undefined,
  });

  const aggregate = new Map<string, InvoiceLineItem>();
  let totalMinutes = 0;
  let totalAmount = 0;

  for (const e of entries) {
    if (e.ends_at === null) continue;
    const minutes = durationMinutes(e.starts_at, e.ends_at);
    if (minutes <= 0) continue;
    const hours = minutes / 60;
    const rate = Number(e.rate);
    const amount = hours * rate;
    totalMinutes += minutes;
    totalAmount += amount;

    const description = e.description.trim() || "(no description)";
    const key = `${description}|||${e.project_id ?? ""}|||${rate}|||${e.user_id}`;
    const prev = aggregate.get(key);
    if (prev) {
      prev.hours += hours;
      prev.amount += amount;
    } else {
      aggregate.set(key, {
        description,
        project_name: e.project_name,
        user_name: e.user_name,
        hours,
        rate,
        amount,
      });
    }
  }

  if (aggregate.size === 0) {
    return {
      error:
        "No time entries match those filters — pick a different period, user, or project.",
    };
  }

  const lineItems = [...aggregate.values()]
    .map((li) => ({
      ...li,
      hours: Math.round(li.hours * 100) / 100,
      amount: Math.round(li.amount * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
  const totalAmountRounded = Math.round(totalAmount * 100) / 100;

  const { data: numberData, error: numberError } = await supabase.rpc(
    "next_invoice_number",
  );
  if (numberError) return { error: `Number generation failed: ${numberError.message}` };
  const invoiceNumber = numberData as string;

  const { data: inserted, error: insertError } = await supabase
    .from("invoices")
    .insert({
      number: invoiceNumber,
      period_from: periodFrom,
      period_to: periodTo,
      issuer_name: settings.issuer_name,
      issuer_details: settings.issuer_details,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      recipient_details: recipientDetails,
      payment_terms: paymentTerms || settings.default_payment_terms,
      notes,
      currency,
      total_amount: totalAmountRounded,
      total_hours: totalHours,
      line_items: lineItems,
      filter_user_id: filterUserId,
      filter_project_id: filterProjectId,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insertError) return { error: `Insert failed: ${insertError.message}` };

  // Slack notification before redirect.
  const { data: creator } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();
  await notifySlack({
    type: "invoice_created",
    number: invoiceNumber,
    recipient: recipientName,
    amount: totalAmountRounded,
    currency,
    periodFrom,
    periodTo,
    createdBy: creator?.full_name ?? creator?.email ?? user.email ?? "unknown",
  });

  refresh();
  redirect(`/invoices/${inserted.id}`);
}

export async function toggleInvoicePaidAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  const currentlyPaid = str(formData, "paid_at") !== "";

  const patch = currentlyPaid
    ? { paid_at: null }
    : { paid_at: new Date().toISOString().slice(0, 10) };

  const { error } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", id);
  if (error) throw error;

  // Notify Slack only when transitioning to PAID — unmark-paid is silent.
  if (!currentlyPaid) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("number, recipient_name, total_amount, currency")
      .eq("id", id)
      .single();
    if (invoice) {
      await notifySlack({
        type: "invoice_paid",
        number: invoice.number,
        recipient: invoice.recipient_name,
        amount: Number(invoice.total_amount),
        currency: invoice.currency,
      });
    }
  }

  refresh();
}

export async function deleteInvoiceAction(formData: FormData) {
  const { supabase } = await requireUser();
  const id = str(formData, "id");
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
  refresh();
  redirect("/invoices");
}
