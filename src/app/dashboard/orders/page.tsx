export default function OrdersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Manage new requests, in-progress loads, and completed orders.
        </p>
      </div>
      {/* TODO: shadcn DataTable with order status tabs and detail drawer */}
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Orders table will go here (tabs: New, Accepted, In Progress, Ready, Completed, Disputed).
      </div>
    </div>
  )
}

