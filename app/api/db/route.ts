// app/api/db/route.ts — Database manager CRUD
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, pushDb, getBin, pushBin, BinItem, addLog, encodeLink } from '@/lib/github'

// GET — fetch entries
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q') || ''
  const page = parseInt(req.nextUrl.searchParams.get('page') || '1')
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '25')

  const dbResult = await getDb()
  if (!dbResult) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  let { data } = dbResult
  if (session.role !== 'owner') data = data.filter(item => item.uploader_id === session.username)

  if (q) {
    const lower = q.toLowerCase()
    data = data.filter(item =>
      item.name.toLowerCase().includes(lower) ||
      item.title?.toLowerCase().includes(lower) ||
      (item.audio || item.langs || '').toLowerCase().includes(lower) ||
      item.uid?.toLowerCase().includes(lower)
    )
  }

  const total = data.length
  const paged = data.slice((page - 1) * limit, page * limit)
  return NextResponse.json({ results: paged, total, page, pages: Math.ceil(total / limit) })
}

// PATCH — edit a field
export async function PATCH(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uid, field, value } = await req.json()
  if (!uid || !field) return NextResponse.json({ error: 'uid and field required' }, { status: 400 })

  if (['uid', 'uploader_id', 'created_at'].includes(field)) {
    return NextResponse.json({ error: `Cannot edit ${field}` }, { status: 403 })
  }

  const dbResult = await getDb()
  if (!dbResult) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  const { data, sha } = dbResult
  const item = data.find(i => i.uid === uid)
  if (!item) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

  if (session.role !== 'owner' && item.uploader_id !== session.username) {
    return NextResponse.json({ error: 'Not your entry' }, { status: 403 })
  }

  const itemAny = item as unknown as Record<string, unknown>
  if (field === 'hub' || field === 'gdf') {
    itemAny[field] = value ? encodeLink(value) : ''
  } else if (field === 'tags') {
    item.tags = Array.isArray(value) ? value : value.split(',').map((s: string) => s.trim()).filter(Boolean)
    item.tag_added_at = (item.tags ?? []).length ? new Date().toISOString() : undefined
  } else if (field === 'genre') {
    item.genre = typeof value === 'string' ? value.split(',').map((s: string) => s.trim()) : value
  } else {
    itemAny[field] = value
  }

  item.modified_at = new Date().toISOString()
  const pushed = await pushDb(data, sha, `Edit: ${item.name} [${field}] by ${session.username}`)
  if (!pushed) return NextResponse.json({ error: 'Push failed' }, { status: 500 })

  await addLog(session.username, `Edit: "${item.name}" field: ${field}`)
  return NextResponse.json({ ok: true, item })
}

// DELETE — soft delete single or bulk
export async function DELETE(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // Support single uid or array of uids
  const uids: string[] = Array.isArray(body.uids) ? body.uids : body.uid ? [body.uid] : []
  if (!uids.length) return NextResponse.json({ error: 'uid or uids required' }, { status: 400 })

  // Fetch fresh DB and Bin sequentially to avoid SHA conflicts
  const dbResult = await getDb()
  if (!dbResult) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  const binResult = await getBin()
  if (!binResult) return NextResponse.json({ error: 'Bin error' }, { status: 500 })

  const { data: db, sha: dbSha } = dbResult
  const { data: bin, sha: binSha } = binResult

  const toAdd: BinItem[] = []
  const deleted: string[] = []

  for (const uid of uids) {
    const idx = db.findIndex(i => i.uid === uid)
    if (idx === -1) continue
    const item = db[idx]
    if (session.role !== 'owner' && item.uploader_id !== session.username) continue
    toAdd.push({ ...item, deleted_at: new Date().toISOString(), deleted_by: session.username })
    deleted.push(item.name)
    db.splice(idx, 1)
  }

  if (!deleted.length) return NextResponse.json({ error: 'No entries deleted (permission or not found)' }, { status: 403 })

  // Push DB first, then Bin sequentially
  const p1 = await pushDb(db, dbSha, `Delete: ${deleted.length} entries by ${session.username}`)
  if (!p1) return NextResponse.json({ error: 'DB push failed' }, { status: 500 })

  const p2 = await pushBin([...toAdd, ...bin], binSha, `Bin: +${deleted.length} entries`)
  if (!p2) return NextResponse.json({ error: 'Bin push failed (DB already updated)' }, { status: 500 })

  await addLog(session.username, `Soft delete: ${deleted.length} entries`)
  return NextResponse.json({ ok: true, deleted: deleted.length })
}
