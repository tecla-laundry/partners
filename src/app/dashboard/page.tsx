import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const kpis = [
  { label: 'Pending Orders', value: '12' },
  { label: 'Accepted Today', value: '8' },
  { label: 'In Washing', value: '5' },
  { label: 'Ready for Delivery', value: '3' },
  { label: 'Earnings Today', value: 'R1,250' },
  { label: 'Capacity Used', value: '68%' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Live view of your orders, capacity, and earnings.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* TODO: charts, realtime order feed, activity timeline */}
    </div>
  )
}

