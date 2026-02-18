export default function EarningsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Earnings & Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Track your laundry earnings, commissions, and payout history.
        </p>
      </div>
      {/* TODO: charts, payout table, CSV/PDF export actions */}
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Earnings breakdown and payout history will go here.
      </div>
    </div>
  )
}

