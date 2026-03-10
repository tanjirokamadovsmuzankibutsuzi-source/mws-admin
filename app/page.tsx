// app/page.tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'

export default async function Root() {
  const cookieStore = cookies()
  const token = cookieStore.get('mws_session')?.value

  if (token) {
    const session = await verifyToken(token)
    if (session) redirect('/dashboard')
  }

  redirect('/login')
}
