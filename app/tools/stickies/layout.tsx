import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { isLocal } from '@/lib/is-local'

export default async function StickiesLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const host = headersList.get('host') || ''
  // Bypass auth for local/LAN requests
  if (!isLocal(new Request('http://localhost', { headers: { host } }))) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/sign-in')
  }

  return <>{children}</>
}
