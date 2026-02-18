'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingBag,
  Gauge,
  UserCircle2,
  Wallet,
  Star,
  AlertTriangle,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
  { name: 'Capacity', href: '/dashboard/capacity', icon: Gauge },
  { name: 'Profile', href: '/dashboard/profile', icon: UserCircle2 },
  { name: 'Earnings', href: '/dashboard/earnings', icon: Wallet },
  { name: 'Reviews', href: '/dashboard/reviews', icon: Star },
  { name: 'Disputes', href: '/dashboard/disputes', icon: AlertTriangle },
]

export function Sidebar() {
  const pathname = usePathname()

  // TODO: wire to Supabase auth for laundry_owner sign-out
  const handleSignOut = async () => {
    // placeholder
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Laundry Partner
          </p>
          <h1 className="text-lg font-bold">Partner Dashboard</h1>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}

