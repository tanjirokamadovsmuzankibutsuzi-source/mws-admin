// app/api/getlink/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, decodeLink } from '@/lib/github'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q') || ''
  const uid = req.nextUrl.searchParams.get('uid') || ''
  const source = req.nextUrl.searchParams.get('source') || 'both'

  const dbResult = await getDb()
  if (!dbResult) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  const { data } = dbResult

  // Search mode
  if (q && !uid) {
    const lower = q.toLowerCase()
    const results = data
      .filter(i => i.name.toLowerCase().includes(lower) || i.title?.toLowerCase().includes(lower))
      .slice(0, 20)
      .map(i => ({ uid: i.uid, name: i.name, size: i.size, audio: i.audio, title: i.title }))
    return NextResponse.json({ results })
  }

  // Get links by UID
  if (uid) {
    const item = data.find(i => i.uid === uid)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const out: Record<string, unknown> = { name: item.name, size: item.size, audio: item.audio }
    if ((source === 'hub' || source === 'both') && item.hub) {
      try { out.hub = decodeLink(item.hub) } catch { out.hub = null }
    }
    if ((source === 'gdf' || source === 'both') && item.gdf) {
      try { out.gdf = decodeLink(item.gdf) } catch { out.gdf = null }
    }
    if (item.custom_buttons?.length) {
      out.custom_buttons = item.custom_buttons.map(btn => ({
        text: btn.text,
        url: (() => { try { return decodeLink(btn.url) } catch { return null } })()
      }))
    }
    return NextResponse.json({ link: out })
  }

  return NextResponse.json({ error: 'q or uid required' }, { status: 400 })
}
