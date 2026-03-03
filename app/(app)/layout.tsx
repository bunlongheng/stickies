import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function StickiesLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/sign-in')
  }

  return <>{children}</>
}
