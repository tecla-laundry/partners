'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const AVATAR_PLACEHOLDER = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face'

export type ActivityItem = {
  id: string
  type: 'order' | 'payment' | 'review' | 'system'
  title: string
  description?: string
  time: string
  avatarUrl?: string | null
}

/**
 * Real-time style activity feed with Unsplash avatar placeholders.
 * Optional pulsing ring on latest item for "new" feel.
 */
export function ActivityFeed({
  items,
  loading,
  className,
}: {
  items: ActivityItem[]
  loading?: boolean
  className?: string
}) {
  return (
    <Card glass className={cn('h-fit', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Activity</CardTitle>
        <p className="text-xs text-muted-foreground">Recent orders and updates</p>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2 rounded-lg animate-pulse"
              aria-hidden
            >
              <div className="h-9 w-9 rounded-full bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-2 w-16 rounded bg-muted" />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No recent activity
          </p>
        ) : (
          items.slice(0, 8).map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'flex items-center gap-3 rounded-lg py-2 px-2 -mx-2 transition-colors hover:bg-muted/50',
                index === 0 && 'relative'
              )}
            >
              {index === 0 && (
                <span
                  className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary animate-pulse ring-2 ring-primary/30"
                  aria-hidden
                />
              )}
              <div className="relative h-9 w-9 flex-shrink-0 rounded-full overflow-hidden bg-muted">
                <Image
                  src={item.avatarUrl || AVATAR_PLACEHOLDER}
                  alt=""
                  width={36}
                  height={36}
                  className="object-cover"
                  unoptimized={!!item.avatarUrl}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
