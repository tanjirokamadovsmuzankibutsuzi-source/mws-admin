// app/dashboard/layout.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const token = cookieStore.get('mws_session')?.value

  if (!token) redirect('/login')
  const session = await verifyToken(token)
  if (!session) redirect('/login')

  return <>{children}</>
}
