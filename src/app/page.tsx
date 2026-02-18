import { redirect } from 'next/navigation'

export default function Home() {
  // For now, send partners straight to the main dashboard overview.
  redirect('/dashboard')
}
