export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile & Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your laundry details, services, pricing, and payout information.
        </p>
      </div>
      {/* TODO: multi-section form with re-approval flow indicators */}
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Partner profile form and approval status will go here.
      </div>
    </div>
  )
}

