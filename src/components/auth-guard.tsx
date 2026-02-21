'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/auth-context'

type LaundryRow = {
  id: string
  status: 'pending_approval' | 'active' | 'rejected' | 'more_info_needed'
  rejection_reason?: string | null
}

async function fetchMyLaundry(
  supabase: ReturnType<typeof import('@/lib/supabase/client').createClient>,
  userId: string
): Promise<LaundryRow | null> {
  const { data, error } = await supabase
    .from('laundries')
    .select('id,status,rejection_reason')
    .eq('owner_user_id', userId)
    .maybeSingle()

  if (error) return null
  return data as LaundryRow | null
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const { data: laundry, isLoading: laundryLoading } = useQuery({
    queryKey: ['me', 'laundry', user?.id],
    queryFn: () => fetchMyLaundry(supabase, user!.id),
    enabled: !!user,
  })

  useEffect(() => {
    if (loading) return

    // Not signed in
    if (!user) {
      router.replace('/sign-in')
      return
    }

    // Wait for profile
    if (!profile) return

    // Not a laundry owner
    if (profile.role !== 'laundry_owner') {
      router.replace('/')
      return
    }

    // If we're on dashboard routes, enforce laundry status gating
    if (pathname.startsWith('/dashboard')) {
      if (laundryLoading) return

      if (!laundry) {
        router.replace('/onboarding')
        return
      }

      if (laundry.status === 'active') return

      if (laundry.status === 'pending_approval' || laundry.status === 'more_info_needed') {
        router.replace('/onboarding/pending')
        return
      }

      if (laundry.status === 'rejected') {
        router.replace('/onboarding/rejected')
        return
      }
    }
  }, [loading, user, profile, pathname, laundry, laundryLoading, router])

  if (loading || (user && !profile) || (pathname.startsWith('/dashboard') && user && laundryLoading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect is happening
  if (!user || (profile && profile.role !== 'laundry_owner')) return null
  if (pathname.startsWith('/dashboard')) {
    if (!laundry || laundry.status !== 'active') return null
  }

  return <>{children}</>
}

