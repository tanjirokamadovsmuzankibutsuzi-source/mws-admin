import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/github'

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dbResult = await getDb()
  if (!dbResult) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  const { data } = dbResult
  const hubCount = data.filter(i => i.hub).length
  const gdfCount = data.filter(i => i.gdf).length

  let totalGb = 0
  for (const item of data) {
    try {
      const upper = item.size.toUpperCase()
      const val = parseFloat(upper.match(/[\d.]+/)?.[0] || '0')
      if (upper.includes('MB')) totalGb += val / 1024
      else if (upper.includes('TB')) totalGb += val * 1024
      else totalGb += val
    } catch { /* skip */ }
  }

  // Support both 'audio' and 'langs' fields
  const audioMap: Record<string, number> = {}
  for (const item of data) {
    const raw = item.audio || (item as unknown as Record<string,string>).langs || 'Unknown'
    // Strip HTML entities like &bull; and normalize
    const cleaned = raw.replace(/&bull;/g, '|').replace(/•/g, '|').replace(/\s*\|\s*/g, ' | ').trim()
    audioMap[cleaned] = (audioMap[cleaned] || 0) + 1
  }

  const uploaderMap: Record<string, number> = {}
  for (const item of data) {
    const u = item.uploader_id || 'unknown'
    uploaderMap[u] = (uploaderMap[u] || 0) + 1
  }

  return NextResponse.json({
    total: data.length, hubCount, gdfCount,
    sizeDisplay: totalGb > 1024 ? `${(totalGb / 1024).toFixed(2)} TB` : `${totalGb.toFixed(2)} GB`,
    audioBreakdown: audioMap,
    uploaderBreakdown: uploaderMap,
    recent: data.slice(0, 5),
  })
}
