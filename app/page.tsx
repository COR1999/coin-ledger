import { AppHeader } from "@/components/app/app-header";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { ForecastChart } from "@/components/dashboard/forecast-chart";
import { ObligationsList } from "@/components/dashboard/obligations-list";
import { SafeToSpendCard, StatCard } from "@/components/dashboard/stat-card";
import { TransactionTable } from "@/components/dashboard/transaction-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SEED_TODAY } from "@/lib/data/seed";
import { computeAlerts } from "@/lib/finance/alerts";
import { buildDashboardData } from "@/lib/finance/dashboard";
import { formatEurosDisplay } from "@/lib/money";
import { getSeedObligations } from "@/lib/repositories/in-memory";
import { getRepositories } from "@/lib/repositories/singleton";
import { getCurrentActor, listActors } from "@/lib/session";

export default async function DashboardPage() {
  const repos = getRepositories();
  const [business, suppliers, transactions, policies, actor] =
    await Promise.all([
      repos.business.get(),
      repos.suppliers.list(),
      repos.transactions.list(),
      repos.policies.get(),
      getCurrentActor(),
    ]);
  const obligations = getSeedObligations();

  const data = buildDashboardData({
    business,
    obligations,
    transactions,
    policies,
    asOf: SEED_TODAY,
  });
  const alerts = computeAlerts({
    safeToSpend: data.safeToSpend,
    suppliers,
    obligations: data.obligations.map((o) => ({
      obligation: o,
      daysUntilDue: o.daysUntilDue,
    })),
  });

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <AppHeader
        businessName={business.name}
        actors={listActors()}
        currentActor={actor}
        active="dashboard"
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Cash overview</h1>
          <p className="text-sm text-muted-foreground">
            What {business.name} can safely do with its money today, as of{" "}
            {SEED_TODAY}.
          </p>
        </div>

        {/* Top stats */}
        <section
          aria-label="Key figures"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            title="Current balance"
            valueCents={data.business.currentBalanceCents}
            hint="Cash available on Arc (demo scale)"
          />
          <StatCard
            title="Obligations (next 30 days)"
            valueCents={data.safeToSpend.obligationsNext30DaysCents}
            hint={`${data.obligations.length} upcoming payments`}
          />
          <StatCard
            title="30-day forecast"
            valueCents={data.forecast.projectedBalanceCents}
            tone={
              data.forecast.projectedBalanceCents <
              data.safeToSpend.minimumReserveCents
                ? "negative"
                : "default"
            }
            hint="Projected cash once obligations clear"
          />
          <SafeToSpendCard b={data.safeToSpend} />
        </section>

        {/* Forecast + alerts */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>30-day cash forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">
                Conservative drawdown from{" "}
                {formatEurosDisplay(data.forecast.startingBalanceCents)} to{" "}
                {formatEurosDisplay(data.forecast.projectedBalanceCents)},
                assuming no new revenue.
              </p>
              <ForecastChart
                series={data.forecastSeries}
                minimumReserveCents={data.safeToSpend.minimumReserveCents}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <AlertsPanel alerts={alerts} />
            </CardContent>
          </Card>
        </section>

        {/* Obligations + transactions */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming obligations</CardTitle>
            </CardHeader>
            <CardContent>
              <ObligationsList obligations={data.obligations} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionTable transactions={data.transactions} />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
