import { getCurrentProfile } from "@/lib/auth";
import {
  fetchInvoiceSettings,
  fetchInvoices,
  fetchProfiles,
  fetchProjects,
} from "@/lib/db";
import { rangeFromPreset } from "@/lib/range";
import { InvoiceCreateForm } from "@/components/invoice-create-form";
import { InvoiceList } from "@/components/invoice-list";
import { InvoiceSettingsForm } from "@/components/invoice-settings-form";

export const dynamic = "force-dynamic";

function isoDate(d: Date | null): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export default async function InvoicesPage() {
  const profile = await getCurrentProfile();

  const [settings, invoices, profiles, projects] = await Promise.all([
    fetchInvoiceSettings(),
    fetchInvoices(),
    fetchProfiles(),
    fetchProjects(),
  ]);

  // Default the new-invoice period picker to "last month" — most common
  // billing cadence.
  const lastMonth = rangeFromPreset("lastMonth");
  const defaultFrom = isoDate(lastMonth.from);
  // lastMonth.to is exclusive (start of this month) — invoice expects inclusive.
  const toExclusive = lastMonth.to ?? new Date();
  const inclusive = new Date(toExclusive.getTime() - 24 * 60 * 60 * 1000);
  const defaultTo = isoDate(inclusive);

  return (
    <main>
      <div className="hero">
        <h1>Invoices</h1>
        <p>
          Generate invoices from time entries. Each invoice freezes a snapshot
          of its line items, so editing entries later doesn&rsquo;t change a
          past invoice. Print or save as PDF — send the PDF to the recipient.
        </p>
      </div>

      {profile.is_admin && (
        <section>
          <div className="section-head">
            <div className="section-num">
              <b>01 /</b> Settings
            </div>
            <div className="section-num mute">admin only</div>
          </div>
          <InvoiceSettingsForm settings={settings} />
        </section>
      )}

      {profile.is_admin && (
        <section>
          <div className="section-head">
            <div className="section-num">
              <b>02 /</b> Create invoice
            </div>
          </div>
          <InvoiceCreateForm
            settings={settings}
            profiles={profiles}
            projects={projects}
            defaultPeriodFrom={defaultFrom}
            defaultPeriodTo={defaultTo}
          />
        </section>
      )}

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>{profile.is_admin ? "03 /" : "01 /"}</b> All invoices
          </div>
        </div>
        <InvoiceList invoices={invoices} isAdmin={profile.is_admin} />
      </section>
    </main>
  );
}
