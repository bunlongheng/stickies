import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await admin.auth.admin.listUsers()
  if (error) return NextResponse.json({ exists: false, provider: null })

  const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) return NextResponse.json({ exists: false, provider: null })

  const providers = user.identities?.map(i => i.provider) ?? []
  const isGoogleOnly = providers.includes('google') && !providers.includes('email')

  return NextResponse.json({ exists: true, provider: isGoogleOnly ? 'google' : 'email' })
}
