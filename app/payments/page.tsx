import { getCurrentProfile } from "@/lib/auth";
import { computeBalances, fetchPayments, fetchProfiles } from "@/lib/db";
import { BalanceStats } from "@/components/balance-stats";
import { PaymentsList } from "@/components/payments-list";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const profile = await getCurrentProfile();
  const [profiles, payments, balances] = await Promise.all([
    fetchProfiles(),
    fetchPayments({}),
    computeBalances(),
  ]);

  return (
    <main>
      <div className="hero">
        <h1>Payments</h1>
        <p>
          Money out: who got paid, when, how much. Compared to logged hours,
          this gives the running balance per person.
        </p>
      </div>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>01 /</b> Balance
          </div>
          <div className="section-num mute">all time</div>
        </div>
        <BalanceStats balances={balances} />
      </section>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>02 /</b> Payments
          </div>
        </div>
        <PaymentsList
          payments={payments}
          profiles={profiles}
          currentUserId={profile.id}
          isAdmin={profile.is_admin}
        />
      </section>
    </main>
  );
}
