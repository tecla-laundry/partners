'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80'

/**
 * Hero section for dashboard overview: welcome message + today's earnings highlight.
 * Unsplash: modern laundry room (subtle overlay). Fallback gradient if image fails.
 */
export function HeroOverview({
  greeting,
  todayEarnings,
  loading,
}: {
  greeting: string
  todayEarnings: string
  loading?: boolean
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative rounded-2xl overflow-hidden min-h-[180px] md:min-h-[220px]"
      aria-label="Overview hero"
    >
      {/* Background image with 30% dark overlay for contrast */}
      <div className="absolute inset-0 bg-navy-900/30 z-[0]" />
      <div className="absolute inset-0 z-0">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 1200px"
          priority
          placeholder="blur"
          blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI0MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YxZjVmOSIvPjwvc3ZnPg=="
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            const parent = target.parentElement
            if (parent) {
              const fallback = document.createElement('div')
              fallback.className = 'absolute inset-0 bg-gradient-to-br from-sage-100 to-navy-100 dark:from-navy-800 dark:to-navy-900'
              fallback.setAttribute('aria-hidden', 'true')
              parent.appendChild(fallback)
            }
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col justify-end p-6 md:p-8 h-full min-h-[180px] md:min-h-[220px]">
        <p className="text-sm font-medium text-white/90 mb-1">{greeting}</p>
        {loading ? (
          <div className="h-10 w-32 rounded-lg bg-white/20 animate-pulse" aria-hidden />
        ) : (
          <p className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            {todayEarnings}
          </p>
        )}
        <p className="text-xs text-white/70 mt-1">Today&apos;s earnings</p>
      </div>
    </motion.section>
  )
}
