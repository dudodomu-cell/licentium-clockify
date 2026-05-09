"use client";

import { useState } from "react";
import {
  addPaymentAction,
  deletePaymentAction,
  updatePaymentAction,
} from "@/app/actions";
import { formatDate, formatMoney } from "@/lib/format";
import type { PaymentWithUser, Profile } from "@/lib/types";
import { DatePicker } from "./date-picker";

type Props = {
  payments: PaymentWithUser[];
  profiles: Profile[];
  currentUserId: string;
  isAdmin: boolean;
};

export function PaymentsList({
  payments,
  profiles,
  currentUserId,
  isAdmin,
}: Props) {
  return (
    <>
      <NewPaymentForm
        profiles={profiles}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
      {payments.length === 0 ? (
        <div className="form mute" style={{ textAlign: "center" }}>
          No payments logged yet.
        </div>
      ) : (
        <div className="ledger">
          <div
            className="ledger-row head"
            style={{ gridTemplateColumns: "0.7fr 1.2fr 0.8fr 1.6fr auto" }}
          >
            <div>Date</div>
            <div>Who</div>
            <div className="num">Amount</div>
            <div>Note</div>
            <div></div>
          </div>
          {payments.map((p) => (
            <PaymentRow
              key={p.id}
              payment={p}
              canEdit={isAdmin || p.user_id === currentUserId}
            />
          ))}
        </div>
      )}
    </>
  );
}

function NewPaymentForm({
  profiles,
  currentUserId,
  isAdmin,
}: {
  profiles: Profile[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  const handle = async (formData: FormData) => {
    await addPaymentAction(formData);
    setOpen(false);
  };

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button className="btn" onClick={() => setOpen(true)}>
          + Log a payment
        </button>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={handle} className="form">
      <div className="form-grid">
        <label className="field">
          Who got paid
          <select
            className="select"
            name="user_id"
            defaultValue={currentUserId}
            disabled={!isAdmin}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Amount, $
          <input
            className="input num"
            type="number"
            step="0.01"
            min="0"
            name="amount"
            required
            autoFocus
          />
        </label>
        <label className="field">
          Date
          <DatePicker name="paid_at" defaultValue={today} required />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          Note
          <input
            className="input"
            name="note"
            placeholder="e.g. Binance / 5300 UAH"
          />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn primary">
          Save payment
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PaymentRow({
  payment,
  canEdit,
}: {
  payment: PaymentWithUser;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <PaymentEditRow payment={payment} onDone={() => setEditing(false)} />;
  }

  const handleDelete = async (formData: FormData) => {
    if (!confirm("Delete this payment?")) return;
    await deletePaymentAction(formData);
  };

  return (
    <div
      className="ledger-row"
      style={{ gridTemplateColumns: "0.7fr 1.2fr 0.8fr 1.6fr auto" }}
    >
      <div className="date-cell">{formatDate(payment.paid_at)}</div>
      <div>
        <span className="pill user">{payment.user_name}</span>
      </div>
      <div className="num">{formatMoney(payment.amount)}</div>
      <div className={`label-cell ${payment.note ? "" : "mute"}`}>
        {payment.note || "—"}
      </div>
      <div className="row-actions">
        {canEdit && (
          <>
            <button
              type="button"
              className="row-icon"
              onClick={() => setEditing(true)}
              title="Edit"
            >
              ✎
            </button>
            <form action={handleDelete} style={{ display: "inline" }}>
              <input type="hidden" name="id" value={payment.id} />
              <button
                type="submit"
                className="row-icon danger"
                title="Delete"
              >
                ×
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function PaymentEditRow({
  payment,
  onDone,
}: {
  payment: PaymentWithUser;
  onDone: () => void;
}) {
  const handle = async (formData: FormData) => {
    await updatePaymentAction(formData);
    onDone();
  };

  return (
    <form
      action={handle}
      className="form"
      style={{
        margin: 0,
        border: "none",
        borderTop: "1px solid var(--accent)",
        borderBottom: "1px solid var(--accent)",
        borderRadius: 0,
      }}
    >
      <input type="hidden" name="id" value={payment.id} />
      <div className="form-grid">
        <label className="field">
          Date
          <DatePicker
            name="paid_at"
            defaultValue={payment.paid_at}
            required
          />
        </label>
        <label className="field">
          Amount, $
          <input
            className="input num"
            type="number"
            step="0.01"
            min="0"
            name="amount"
            defaultValue={payment.amount}
            required
          />
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}>
          Note
          <input className="input" name="note" defaultValue={payment.note} />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn primary">
          Save
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
