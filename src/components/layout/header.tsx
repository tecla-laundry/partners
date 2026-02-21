'use client'

import { useTheme } from 'next-themes'
import { Search, Moon, Sun } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

/**
 * Sticky top nav: logo, search, theme toggle, user avatar with online status dot.
 * Min tap target 48px for accessibility.
 */
export function Header() {
  const { theme, setTheme } = useTheme()
  const { profile } = useAuth()

  return (
    <header
      className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6"
      role="banner"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          aria-hidden
        >
          <span className="text-sm font-bold">L</span>
        </div>
        <span className="hidden font-semibold text-foreground sm:inline-block">
          Partner
        </span>
      </div>

      {/* Search — max-width on larger screens */}
      <div className="relative flex-1 max-w-md">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search orders, customers..."
          className="h-10 min-h-[48px] w-full rounded-xl border bg-muted/50 pl-10 focus:bg-background md:min-h-[40px]"
          aria-label="Search orders and customers"
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle — 48px tap target on touch */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-xl md:h-9 md:w-9"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* User avatar with online status dot */}
        <div
          className="relative flex h-10 w-10 min-h-[48px] min-w-[48px] items-center justify-center rounded-full border-2 border-border bg-muted text-sm font-medium text-muted-foreground md:min-h-[40px] md:min-w-[40px]"
          role="img"
          aria-label={profile?.full_name || 'User menu'}
        >
          {profile?.full_name ? (
            profile.full_name.slice(0, 2).toUpperCase()
          ) : (
            profile?.email?.slice(0, 2).toUpperCase() ?? '—'
          )}
          <span
            className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
            aria-hidden
            title="Online"
          />
        </div>
      </div>
    </header>
  )
}
