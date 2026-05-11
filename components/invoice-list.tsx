"use client";

import Link from "next/link";
import {
  deleteInvoiceAction,
  toggleInvoicePaidAction,
} from "@/app/actions";
import { formatDate, formatMoney } from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { useViewerTz } from "./viewer-tz-provider";

export function InvoiceList({
  invoices,
  isAdmin,
}: {
  invoices: Invoice[];
  isAdmin: boolean;
}) {
  const viewerTz = useViewerTz();
  if (invoices.length === 0) {
    return (
      <div className="form mute" style={{ textAlign: "center" }}>
        No invoices yet.
      </div>
    );
  }

  return (
    <div className="ledger">
      <div
        className="ledger-row head"
        style={{
          gridTemplateColumns: "0.9fr 0.7fr 1fr 1.4fr 0.8fr 0.7fr auto",
        }}
      >
        <div>Number</div>
        <div>Issued</div>
        <div>Period</div>
        <div>Recipient</div>
        <div className="num">Total</div>
        <div>Status</div>
        <div></div>
      </div>
      {invoices.map((inv) => (
        <div
          key={inv.id}
          className="ledger-row"
          style={{
            gridTemplateColumns: "0.9fr 0.7fr 1fr 1.4fr 0.8fr 0.7fr auto",
          }}
        >
          <div className="label-cell" style={{ fontFamily: "var(--font-mono)" }}>
            <Link href={`/invoices/${inv.id}`}>{inv.number}</Link>
          </div>
          <div className="date-cell">{formatDate(inv.issued_at, viewerTz)}</div>
          <div className="date-cell">
            {formatDate(inv.period_from, viewerTz)} → {formatDate(inv.period_to, viewerTz)}
          </div>
          <div className="label-cell">{inv.recipient_name}</div>
          <div className="num">
            {formatMoney(inv.total_amount)}
            <span className="dim" style={{ fontSize: 10, marginLeft: 4 }}>
              {inv.currency}
            </span>
          </div>
          <div>
            {inv.paid_at ? (
              <span
                className="pill solid"
                style={{ color: "var(--positive)", borderColor: "var(--positive)" }}
              >
                paid
              </span>
            ) : (
              <span
                className="pill solid"
                style={{ color: "var(--warning)", borderColor: "var(--warning)" }}
              >
                unpaid
              </span>
            )}
          </div>
          <div className="row-actions">
            {isAdmin && (
              <>
                <form action={toggleInvoicePaidAction} style={{ display: "inline" }}>
                  <input type="hidden" name="id" value={inv.id} />
                  <input
                    type="hidden"
                    name="paid_at"
                    value={inv.paid_at ?? ""}
                  />
                  <button
                    type="submit"
                    className="row-icon"
                    title={inv.paid_at ? "Mark as unpaid" : "Mark as paid"}
                  >
                    {inv.paid_at ? "↺" : "✓"}
                  </button>
                </form>
                <DeleteInvoiceButton id={inv.id} number={inv.number} />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DeleteInvoiceButton({ id, number }: { id: string; number: string }) {
  return (
    <form
      action={deleteInvoiceAction}
      style={{ display: "inline" }}
      onSubmit={(e) => {
        if (
          !confirm(
            `Delete invoice ${number}? This is permanent and cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="row-icon danger" title="Delete invoice">
        ×
      </button>
    </form>
  );
}
