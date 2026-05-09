import { fetchNotificationSettings } from "./db";
import type { NotificationSettings } from "./types";

// Slack notifications, two layers of "off":
//   1. SLACK_WEBHOOK_URL env unset → integration is dead, no DB query, no UI effect
//   2. notification_settings.slack_enabled = false → integration is muted from the UI
// Per-event toggles live in the same row. Failures (Slack down, bad URL,
// timeout) are logged but never propagate — Slack must never break the
// surrounding action (invoice creation, payment, etc).

export type SlackEvent =
  | {
      type: "invoice_created";
      number: string;
      recipient: string;
      amount: number;
      currency: string;
      periodFrom: string;
      periodTo: string;
      createdBy: string;
    }
  | {
      type: "invoice_paid";
      number: string;
      recipient: string;
      amount: number;
      currency: string;
    }
  | {
      type: "payment_logged";
      userName: string;
      amount: number;
      paidAt: string;
      note: string;
      loggedBy: string;
      isSelfLog: boolean;
    };

const EVENT_TO_FLAG: Record<
  SlackEvent["type"],
  keyof Pick<
    NotificationSettings,
    | "slack_notify_invoice_created"
    | "slack_notify_invoice_paid"
    | "slack_notify_payment_logged"
  >
> = {
  invoice_created: "slack_notify_invoice_created",
  invoice_paid: "slack_notify_invoice_paid",
  payment_logged: "slack_notify_payment_logged",
};

function fmtMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatMessage(event: SlackEvent): string {
  switch (event.type) {
    case "invoice_created":
      return [
        `:receipt: *New invoice* \`${event.number}\` to *${event.recipient}*`,
        `Amount: *${fmtMoney(event.amount, event.currency)}*`,
        `Period: ${event.periodFrom} → ${event.periodTo}`,
        `_Created by ${event.createdBy}_`,
      ].join("\n");
    case "invoice_paid":
      return [
        `:moneybag: *Invoice paid* \`${event.number}\``,
        `From: ${event.recipient}`,
        `Amount: *${fmtMoney(event.amount, event.currency)}*`,
      ].join("\n");
    case "payment_logged": {
      const verb = event.isSelfLog ? "logged a payment" : "got paid";
      return [
        `:dollar: *${event.userName}* ${verb}`,
        `Amount: *$${event.amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}*`,
        `Date: ${event.paidAt}`,
        event.note ? `Note: ${event.note}` : null,
        event.isSelfLog ? null : `_Recorded by ${event.loggedBy}_`,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }
}

export async function notifySlack(event: SlackEvent): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;

  let settings: NotificationSettings;
  try {
    settings = await fetchNotificationSettings();
  } catch (err) {
    console.error("[slack] failed to read notification_settings:", err);
    return;
  }

  if (!settings.slack_enabled) return;
  if (!settings[EVENT_TO_FLAG[event.type]]) return;

  const text = formatMessage(event);

  // 3-second timeout — never block the user-facing action on slack latency.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[slack] webhook ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error("[slack] notify failed:", err);
  } finally {
    clearTimeout(timer);
  }
}
