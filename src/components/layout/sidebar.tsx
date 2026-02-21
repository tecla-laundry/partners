'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
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
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Orders', href: '/dashboard/orders', icon: ShoppingBag },
  { name: 'Capacity', href: '/dashboard/capacity', icon: Gauge },
  { name: 'Profile', href: '/dashboard/profile', icon: UserCircle2 },
  { name: 'Earnings', href: '/dashboard/earnings', icon: Wallet },
  { name: 'Reviews', href: '/dashboard/reviews', icon: Star },
  { name: 'Disputes', href: '/dashboard/disputes', icon: AlertTriangle },
]

/**
 * Sidebar: desktop vertical nav; on mobile becomes fixed bottom nav (Stripe-style).
 * Rounded-xl nav items, hover scale via Framer Motion.
 */
export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
      router.push('/')
      router.refresh()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to sign out')
    }
  }

  return (
    <>
      {/* Desktop sidebar — hidden on small screens */}
      <aside
        className="hidden h-full w-64 flex-col border-r bg-card md:flex"
        aria-label="Main navigation"
      >
        <div className="flex h-16 items-center border-b px-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Laundry Partner
          </p>
          <h2 className="sr-only">Partner Dashboard</h2>
        </div>
        <nav className="flex-1 space-y-1 p-4" role="navigation">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors min-h-[48px]',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-4">
          <Button
            variant="ghost"
            className="w-full justify-start rounded-xl min-h-[48px]"
            onClick={handleSignOut}
            aria-label="Sign out"
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile bottom nav — 6 items, min 48px tap targets */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-card/95 backdrop-blur md:hidden"
        role="navigation"
        aria-label="Mobile navigation"
      >
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="truncate max-w-[56px]">{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
