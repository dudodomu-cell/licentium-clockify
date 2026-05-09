"use client";

import { useState } from "react";
import { updateInvoiceSettingsAction } from "@/app/actions";
import type { InvoiceSettings } from "@/lib/types";

export function InvoiceSettingsForm({
  settings,
}: {
  settings: InvoiceSettings;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const handle = async (formData: FormData) => {
    setSaved(false);
    await updateInvoiceSettingsAction(formData);
    setSaved(true);
  };

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button className="btn" onClick={() => setOpen(true)}>
          ▸ Settings: issuer &amp; defaults
        </button>
      </div>
    );
  }

  return (
    <form action={handle} className="form">
      <div className="form-grid">
        <label className="field" style={{ gridColumn: "span 2" }}>
          Issuer name
          <input
            className="input"
            name="issuer_name"
            defaultValue={settings.issuer_name}
            required
          />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          Issuer details (multi-line — address, IBAN, tax ID, email)
          <textarea
            className="textarea"
            name="issuer_details"
            rows={4}
            defaultValue={settings.issuer_details}
          />
        </label>
        <label className="field">
          Default recipient name
          <input
            className="input"
            name="default_recipient_name"
            defaultValue={settings.default_recipient_name}
          />
        </label>
        <label className="field">
          Default recipient email
          <input
            className="input"
            type="email"
            name="default_recipient_email"
            defaultValue={settings.default_recipient_email}
          />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          Default recipient details
          <textarea
            className="textarea"
            name="default_recipient_details"
            rows={3}
            defaultValue={settings.default_recipient_details}
          />
        </label>
        <label className="field">
          Default payment terms
          <input
            className="input"
            name="default_payment_terms"
            defaultValue={settings.default_payment_terms}
          />
        </label>
        <label className="field">
          Default currency
          <input
            className="input mono"
            name="default_currency"
            defaultValue={settings.default_currency}
            maxLength={3}
          />
        </label>
        <label className="field">
          Invoice number prefix
          <input
            className="input mono"
            name="invoice_number_prefix"
            defaultValue={settings.invoice_number_prefix}
            maxLength={10}
          />
        </label>
        <label className="field">
          Next sequence # <span className="dim">(read-only)</span>
          <input
            className="input num"
            value={settings.next_invoice_seq}
            disabled
            readOnly
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn primary">
          Save settings
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Close
        </button>
        {saved && (
          <span
            className="auth-msg ok"
            style={{ margin: 0, padding: "8px 12px" }}
          >
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}
