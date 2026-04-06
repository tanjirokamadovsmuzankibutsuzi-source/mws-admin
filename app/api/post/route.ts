import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, pushDb, DbItem, addLog } from '@/lib/github'
import { parseInput } from '@/lib/parser'
import { broadcastToChannels } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { text, broadcast = true, previewOnly = false } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'No input text' }, { status: 400 })

    const { meta, files } = await parseInput(text, session.username)
    if (!files.length) return NextResponse.json({ error: 'No valid files found.' }, { status: 400 })

    // Preview only mode
    if (previewOnly) {
      return NextResponse.json({ preview: { meta, files } })
    }

    const dbResult = await getDb()
    if (!dbResult) return NextResponse.json({ error: 'GitHub DB error' }, { status: 500 })

    const { data: db, sha } = dbResult
    let added = 0, updated = 0

    for (const newFile of [...files].reverse()) {
      const existingIdx = db.findIndex(old =>
        old.name.trim().toLowerCase() === newFile.name?.trim().toLowerCase()
      )
      if (existingIdx !== -1) {
        const old = db[existingIdx]
        if (session.role !== 'owner' && old.uploader_id !== session.username) continue
        if (newFile.hub) old.hub = newFile.hub
        if (newFile.gdf) old.gdf = newFile.gdf
        if (newFile.size) old.size = newFile.size!
        if (newFile.audio) old.audio = newFile.audio!
        if (newFile.backdrop) old.backdrop = newFile.backdrop
        if (newFile.tags?.length) { old.tags = newFile.tags; old.tag_added_at = newFile.tag_added_at }
        old.is_new = true
        old.modified_at = new Date().toISOString()
        db.splice(existingIdx, 1)
        db.unshift(old)
        updated++
      } else {
        db.unshift(newFile as DbItem)
        added++
      }
    }

    const pushed = await pushDb(db, sha, `Web: +${added} ~${updated} by ${session.username}`)
    if (!pushed) return NextResponse.json({ error: 'GitHub push failed' }, { status: 500 })

    await addLog(session.username, `Post: +${added} new, ~${updated} updated | ${meta.title || files[0]?.name || ''}`)

    let broadcastResult = null
    if (broadcast) broadcastResult = await broadcastToChannels(meta, files)

    return NextResponse.json({
      ok: true, added, updated, files: files.length,
      meta: { title: meta.title, year: meta.year, backdrop: meta.backdrop },
      broadcast: broadcastResult
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
