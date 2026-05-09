import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { fetchInvoiceById } from "@/lib/db";
import { formatDate, formatMoney, formatNum } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { ClientConfirmDelete } from "@/components/client-confirm-delete";
import {
  deleteInvoiceAction,
  toggleInvoicePaidAction,
} from "@/app/actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function InvoicePage({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await requireAdmin();
  const invoice = await fetchInvoiceById(id);
  if (!invoice) notFound();

  // Are line items from multiple users? If so, render a "Who" column.
  const distinctUsers = new Set(invoice.line_items.map((li) => li.user_name));
  const showUserCol = distinctUsers.size > 1;

  // Are there multiple projects? Then render a Project column too.
  const distinctProjects = new Set(
    invoice.line_items.map((li) => li.project_name ?? ""),
  );
  const showProjectCol = distinctProjects.size > 1;

  // Decide grid template based on optional columns.
  const cols = [
    "minmax(0, 2fr)", // description
    showProjectCol ? "1fr" : "",
    showUserCol ? "0.8fr" : "",
    "0.7fr", // hours
    "0.7fr", // rate
    "0.9fr", // amount
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main>
      {/* Toolbar — hidden on print */}
      <div className="no-print" style={{ marginBottom: 24 }}>
        <div
          className="filters"
          style={{ marginBottom: 12, justifyContent: "space-between" }}
        >
          <Link href="/invoices" className="btn">
            ← Invoices
          </Link>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <PrintButton />
            {profile.is_admin && (
              <>
                <form action={toggleInvoicePaidAction}>
                  <input type="hidden" name="id" value={invoice.id} />
                  <input
                    type="hidden"
                    name="paid_at"
                    value={invoice.paid_at ?? ""}
                  />
                  <button
                    type="submit"
                    className={`btn ${invoice.paid_at ? "" : "primary"}`}
                  >
                    {invoice.paid_at ? "Mark unpaid" : "Mark paid"}
                  </button>
                </form>
                <DeleteForm id={invoice.id} number={invoice.number} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Printable invoice body */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
            marginBottom: 32,
          }}
        >
          <div>
            <div className="brand">§ Licentium · Invoice</div>
            <h1
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 32,
                fontWeight: 500,
                marginTop: 8,
                letterSpacing: "0.02em",
              }}
            >
              {invoice.number}
            </h1>
            <div className="mute" style={{ marginTop: 4 }}>
              Issued {formatDate(invoice.issued_at)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="card-label">Status</div>
            <div
              className="card-value"
              style={{
                color: invoice.paid_at
                  ? "var(--positive)"
                  : "var(--warning)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {invoice.paid_at ? "PAID" : "UNPAID"}
            </div>
            {invoice.paid_at && (
              <div className="card-sub">on {formatDate(invoice.paid_at)}</div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            marginBottom: 32,
          }}
        >
          <div>
            <div className="card-label" style={{ marginBottom: 8 }}>
              From
            </div>
            <div style={{ fontWeight: 500 }}>{invoice.issuer_name}</div>
            {invoice.issuer_details && (
              <div
                className="mute"
                style={{ whiteSpace: "pre-line", fontSize: 13, marginTop: 4 }}
              >
                {invoice.issuer_details}
              </div>
            )}
          </div>
          <div>
            <div className="card-label" style={{ marginBottom: 8 }}>
              Bill to
            </div>
            <div style={{ fontWeight: 500 }}>{invoice.recipient_name}</div>
            {invoice.recipient_email && (
              <div className="mute" style={{ fontSize: 13, marginTop: 2 }}>
                {invoice.recipient_email}
              </div>
            )}
            {invoice.recipient_details && (
              <div
                className="mute"
                style={{ whiteSpace: "pre-line", fontSize: 13, marginTop: 4 }}
              >
                {invoice.recipient_details}
              </div>
            )}
          </div>
        </div>

        <div
          className="card-label"
          style={{ marginBottom: 8, fontFamily: "var(--font-mono)" }}
        >
          Period: {formatDate(invoice.period_from)} →{" "}
          {formatDate(invoice.period_to)}
        </div>

        <div className="ledger" style={{ marginTop: 16 }}>
          <div
            className="ledger-row head"
            style={{ gridTemplateColumns: cols }}
          >
            <div>Description</div>
            {showProjectCol && <div>Project</div>}
            {showUserCol && <div>Who</div>}
            <div className="num">Hours</div>
            <div className="num">Rate</div>
            <div className="num">Amount</div>
          </div>
          {invoice.line_items.map((li, i) => (
            <div
              key={i}
              className="ledger-row"
              style={{ gridTemplateColumns: cols }}
            >
              <div className="label-cell">{li.description}</div>
              {showProjectCol && (
                <div className={li.project_name ? "" : "mute"}>
                  {li.project_name ?? "—"}
                </div>
              )}
              {showUserCol && (
                <div>
                  <span className="pill user">{li.user_name}</span>
                </div>
              )}
              <div className="num">{formatNum(li.hours)}</div>
              <div className="num mute">{formatMoney(li.rate)}/hr</div>
              <div className="num">{formatMoney(li.amount)}</div>
            </div>
          ))}
          <div
            className="ledger-row foot"
            style={{ gridTemplateColumns: cols }}
          >
            <div>Total</div>
            {showProjectCol && <div></div>}
            {showUserCol && <div></div>}
            <div className="num">{formatNum(invoice.total_hours)}</div>
            <div></div>
            <div className="num" style={{ fontSize: 16 }}>
              {formatMoney(invoice.total_amount)}{" "}
              <span className="dim" style={{ fontSize: 11, marginLeft: 4 }}>
                {invoice.currency}
              </span>
            </div>
          </div>
        </div>

        {invoice.payment_terms && (
          <div style={{ marginTop: 24 }}>
            <div className="card-label" style={{ marginBottom: 6 }}>
              Payment terms
            </div>
            <div>{invoice.payment_terms}</div>
          </div>
        )}

        {invoice.notes && (
          <div style={{ marginTop: 24 }}>
            <div className="card-label" style={{ marginBottom: 6 }}>
              Notes
            </div>
            <div style={{ whiteSpace: "pre-line" }}>{invoice.notes}</div>
          </div>
        )}
      </div>
    </main>
  );
}

function DeleteForm({ id, number }: { id: string; number: string }) {
  return (
    <form action={deleteInvoiceAction} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={id} />
      <ClientConfirmDelete
        label="Delete"
        promptText={`Delete invoice ${number}? This is permanent.`}
      />
    </form>
  );
}
