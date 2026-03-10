// app/api/logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLogs } from '@/lib/github'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })
  const result = await getLogs()
  if (!result) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  return NextResponse.json({ logs: result.data })
}
