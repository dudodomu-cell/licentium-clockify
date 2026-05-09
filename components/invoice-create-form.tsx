"use client";

import { useActionState, useState } from "react";
import { createInvoiceAction, type CreateInvoiceState } from "@/app/actions";
import type { InvoiceSettings, Profile, Project } from "@/lib/types";
import { DatePicker } from "./date-picker";

const INITIAL_STATE: CreateInvoiceState = { error: null };

export function InvoiceCreateForm({
  settings,
  profiles,
  projects,
  defaultPeriodFrom,
  defaultPeriodTo,
}: {
  settings: InvoiceSettings;
  profiles: Profile[];
  projects: Project[];
  defaultPeriodFrom: string;
  defaultPeriodTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    createInvoiceAction,
    INITIAL_STATE,
  );

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => setOpen(true)}>
          + Create invoice
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="form">
      <div className="form-grid">
        <label className="field">
          Period from
          <DatePicker
            name="period_from"
            defaultValue={defaultPeriodFrom}
            required
          />
        </label>
        <label className="field">
          Period to
          <DatePicker
            name="period_to"
            defaultValue={defaultPeriodTo}
            required
          />
        </label>
        <label className="field">
          User filter
          <select
            className="select"
            name="filter_user_id"
            defaultValue=""
          >
            <option value="">Everyone</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Project filter
          <select
            className="select"
            name="filter_project_id"
            defaultValue=""
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Currency
          <input
            className="input mono"
            name="currency"
            defaultValue={settings.default_currency}
            maxLength={3}
          />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          Recipient name
          <input
            className="input"
            name="recipient_name"
            defaultValue={settings.default_recipient_name}
            required
          />
        </label>
        <label className="field">
          Recipient email
          <input
            className="input"
            type="email"
            name="recipient_email"
            defaultValue={settings.default_recipient_email}
          />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          Recipient details
          <textarea
            className="textarea"
            name="recipient_details"
            rows={3}
            defaultValue={settings.default_recipient_details}
          />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          Payment terms
          <input
            className="input"
            name="payment_terms"
            defaultValue={settings.default_payment_terms}
          />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          Notes (optional, shown at bottom of invoice)
          <textarea className="textarea" name="notes" rows={2} />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Generating…" : "Generate invoice"}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {state.error && (
        <div
          className="auth-msg err"
          style={{ marginTop: 12 }}
          role="alert"
        >
          {state.error}
        </div>
      )}
    </form>
  );
}
