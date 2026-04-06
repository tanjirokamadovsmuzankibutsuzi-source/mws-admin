// app/api/getfile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, decodeLink } from '@/lib/github'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const fmt = req.nextUrl.searchParams.get('format') || 'json'
  const dbResult = await getDb()
  if (!dbResult) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  const { data } = dbResult

  if (fmt === 'txt') {
    const lines = data.map(i => {
      let out = `[+] ${i.name} [${i.size}]\n`
      if (i.hub) { try { out += decodeLink(i.hub) + '\n' } catch { /* skip */ } }
      if (i.gdf) { try { out += decodeLink(i.gdf) + '\n' } catch { /* skip */ } }
      return out
    }).join('\n')
    return new NextResponse(lines, {
      headers: { 'Content-Type': 'text/plain', 'Content-Disposition': `attachment; filename="mws_db_${Date.now()}.txt"` }
    })
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="mws_db_${Date.now()}.json"` }
  })
}
