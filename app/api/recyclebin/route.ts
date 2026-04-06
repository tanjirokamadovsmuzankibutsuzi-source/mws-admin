// app/api/recyclebin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, pushDb, getBin, pushBin, DbItem, addLog } from '@/lib/github'

// GET — fetch bin
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const binResult = await getBin()
  if (!binResult) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  let { data } = binResult
  if (session.role !== 'owner') {
    data = data.filter(item => item.uploader_id === session.username)
  }

  return NextResponse.json({ items: data, total: data.length })
}

// POST — restore item
export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uid } = await req.json()
  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

  // Fetch fresh data sequentially to avoid SHA conflicts
  const binResult = await getBin()
  if (!binResult) return NextResponse.json({ error: 'Bin fetch error' }, { status: 500 })

  const { data: bin, sha: binSha } = binResult

  const idx = bin.findIndex(i => i.uid === uid)
  if (idx === -1) return NextResponse.json({ error: 'Not found in bin' }, { status: 404 })

  const item = bin[idx]
  if (session.role !== 'owner' && item.uploader_id !== session.username) {
    return NextResponse.json({ error: 'Not your entry' }, { status: 403 })
  }

  // Remove from bin first
  bin.splice(idx, 1)
  const binPushed = await pushBin(bin, binSha, `Bin: -${item.name}`)
  if (!binPushed) return NextResponse.json({ error: 'Bin push failed' }, { status: 500 })

  // Fetch fresh DB after bin push
  const dbResult = await getDb()
  if (!dbResult) return NextResponse.json({ error: 'DB fetch error' }, { status: 500 })

  const { data: db, sha: dbSha } = dbResult

  // Build restored item without bin-specific fields
  const { deleted_at: _, deleted_by: __, ...restored } = item
  const restoredItem: DbItem = {
    ...restored,
    is_new: false,
    modified_at: new Date().toISOString(),
  }

  db.unshift(restoredItem)
  const dbPushed = await pushDb(db, dbSha, `Restore: ${item.name}`)
  if (!dbPushed) return NextResponse.json({ error: 'DB push failed (item removed from bin already)' }, { status: 500 })

  await addLog(session.username, `Restore: "${item.name}"`)
  return NextResponse.json({ ok: true })
}

// DELETE — permanent delete from bin
export async function DELETE(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uid } = await req.json()
  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 })

  const binResult = await getBin()
  if (!binResult) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  const { data: bin, sha } = binResult
  const idx = bin.findIndex(i => i.uid === uid)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const item = bin[idx]
  if (session.role !== 'owner' && item.uploader_id !== session.username) {
    return NextResponse.json({ error: 'Not your entry' }, { status: 403 })
  }

  bin.splice(idx, 1)
  const pushed = await pushBin(bin, sha, `Permanent delete: ${item.name}`)
  if (!pushed) return NextResponse.json({ error: 'Push failed' }, { status: 500 })

  await addLog(session.username, `Permanent delete: "${item.name}"`)
  return NextResponse.json({ ok: true })
}
