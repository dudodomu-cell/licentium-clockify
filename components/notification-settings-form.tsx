"use client";

import { useState } from "react";
import { updateNotificationSettingsAction } from "@/app/actions";
import type { NotificationSettings } from "@/lib/types";

export function NotificationSettingsForm({
  settings,
  webhookConfigured,
}: {
  settings: NotificationSettings;
  webhookConfigured: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const handle = async (formData: FormData) => {
    setSaved(false);
    await updateNotificationSettingsAction(formData);
    setSaved(true);
  };

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button className="btn" onClick={() => setOpen(true)}>
          ▸ Notifications: Slack
          {webhookConfigured ? (
            settings.slack_enabled ? (
              <span style={{ color: "var(--accent)", marginLeft: 6 }}>· on</span>
            ) : (
              <span className="dim" style={{ marginLeft: 6 }}>· muted</span>
            )
          ) : (
            <span
              style={{ color: "var(--warning)", marginLeft: 6 }}
              title="SLACK_WEBHOOK_URL env var not set"
            >
              · webhook missing
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <form action={handle} className="form">
      {!webhookConfigured && (
        <div
          className="auth-msg err"
          style={{ marginBottom: 12 }}
          role="alert"
        >
          <b>SLACK_WEBHOOK_URL</b> env var is not set in Vercel — toggles below
          have no effect until it&rsquo;s configured. Add the Slack Incoming
          Webhook URL to the project&rsquo;s production environment variables
          and redeploy.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Toggle
          name="slack_enabled"
          defaultChecked={settings.slack_enabled}
          label="Slack notifications enabled"
          hint="Master switch. Off = nothing posts to Slack regardless of per-event toggles."
        />
        <div
          style={{
            paddingLeft: 16,
            borderLeft: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <Toggle
            name="slack_notify_invoice_created"
            defaultChecked={settings.slack_notify_invoice_created}
            label="Invoice created"
            hint="Posts when a new invoice is generated."
          />
          <Toggle
            name="slack_notify_invoice_paid"
            defaultChecked={settings.slack_notify_invoice_paid}
            label="Invoice paid"
            hint="Posts when an invoice is marked as paid (silent on un-mark)."
          />
          <Toggle
            name="slack_notify_payment_logged"
            defaultChecked={settings.slack_notify_payment_logged}
            label="Payment logged"
            hint="Posts when someone records a received payment."
          />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn primary">
          Save
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

function Toggle({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        style={{ marginTop: 4 }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span>{label}</span>
        {hint && (
          <span className="dim" style={{ fontSize: 12 }}>
            {hint}
          </span>
        )}
      </div>
    </label>
  );
}
