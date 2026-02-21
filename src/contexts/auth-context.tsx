'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export type Profile = {
  id: string
  role: 'customer' | 'laundry_owner' | 'admin' | 'driver'
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
}

type AuthContextValue = {
  supabase: ReturnType<typeof createClient>
  user: User | null
  profile: Profile | null
  loading: boolean
  refreshSession: (session?: Session | null) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Keep one Supabase client for the entire app (matches admin app approach)
let singletonClient: ReturnType<typeof createClient> | null = null

async function fetchProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) return null
  return data as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => {
    if (!singletonClient) singletonClient = createClient()
    return singletonClient
  }, [])

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const refreshingRef = useRef(false)

  const refreshSession = async (session?: Session | null) => {
    if (refreshingRef.current) return
    refreshingRef.current = true

    try {
      const nextUser = session?.user ?? (await supabase.auth.getUser()).data.user ?? null
      setUser(nextUser)

      if (!nextUser) {
        setProfile(null)
        return
      }

      const nextProfile = await fetchProfile(supabase, nextUser.id)
      setProfile(nextProfile)
    } finally {
      setLoading(false)
      refreshingRef.current = false
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  useEffect(() => {
    // Hydrate once on mount from Supabase (single getSession)
    supabase.auth
      .getSession()
      .then(({ data }) => refreshSession(data.session))
      .catch(() => setLoading(false))

    // Supabase handles session; we only sync auth state to React when it changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        refreshSession(session)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AuthContext.Provider value={{ supabase, user, profile, loading, refreshSession, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

