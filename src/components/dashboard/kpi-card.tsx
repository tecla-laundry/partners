'use client'

import { motion } from 'framer-motion'
import CountUp from 'react-countup'
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export type KpiCardProps = {
  label: string
  value: string | number
  /** Optional numeric value for CountUp (e.g. 1250 for R1,250) */
  numericValue?: number
  sublabel?: string
  icon?: React.ReactNode
  /** Mini sparkline data: [{ value: number }] */
  sparklineData?: { value: number }[]
  /** Gradient border accent: sage, muted, etc. */
  accent?: 'sage' | 'muted' | 'sky'
  className?: string
  loading?: boolean
}

const accentBorder: Record<NonNullable<KpiCardProps['accent']>, string> = {
  sage: 'border-l-4 border-l-primary',
  muted: 'border-l-4 border-l-muted-foreground/30',
  sky: 'border-l-4 border-l-sky-400',
}

/**
 * Premium KPI card: large number with optional CountUp, mini sparkline, icon.
 * Uses Framer Motion for hover scale and Tailwind shadow-card-hover.
 */
export function KpiCard({
  label,
  value,
  numericValue,
  sublabel,
  icon,
  sparklineData,
  accent = 'muted',
  className,
  loading,
}: KpiCardProps) {
  const showCountUp = typeof numericValue === 'number' && !loading
  const displayValue = loading ? '—' : (showCountUp ? undefined : value)

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn('min-h-[120px]', className)}
    >
      <Card
        glass
        className={cn(
          'h-full overflow-hidden transition-all duration-200',
          accentBorder[accent]
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
          {icon && (
            <span className="text-muted-foreground" aria-hidden>
              {icon}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-24 mb-1" />
          ) : (
            <div className="text-2xl font-bold tracking-tight">
              {displayValue !== undefined && (
                <span>{displayValue}</span>
              )}
              {showCountUp && (
                <CountUp
                  end={numericValue!}
                  duration={1.2}
                  decimals={value.toString().includes('.') ? 2 : 0}
                  prefix={typeof value === 'string' && value.startsWith('R') ? 'R' : ''}
                  suffix={typeof value === 'string' && value.includes('%') ? '%' : ''}
                />
              )}
            </div>
          )}
          {sublabel && (
            <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
          )}
          {sparklineData && sparklineData.length > 0 && !loading && (
            <div className="h-[36px] w-full mt-3 -mb-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparklineData}>
                  <defs>
                    <linearGradient id="sparkline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip content={<></>} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    fill="url(#sparkline)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
