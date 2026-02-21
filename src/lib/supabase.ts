// Re-export browser client for client components
// Server components should import from '@/lib/supabase/server'
export { createClient } from './supabase/client'

export async function callEdgeFunction(functionName: string, body: unknown) {
  const { createClient } = await import('./supabase/client')
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${functionName}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'x-user-token': session.access_token,
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
    throw new Error(error.error?.message || `Edge function failed: ${response.statusText}`)
  }

  return response.json()
}
