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
  const [dbResult, binResult] = await Promise.all([getDb(), getBin()])
  if (!dbResult || !binResult) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  const { data: db, sha: dbSha } = dbResult
  const { data: bin, sha: binSha } = binResult

  const idx = bin.findIndex(i => i.uid === uid)
  if (idx === -1) return NextResponse.json({ error: 'Not found in bin' }, { status: 404 })

  const item = bin[idx]
  if (session.role !== 'owner' && item.uploader_id !== session.username) {
    return NextResponse.json({ error: 'Not your entry' }, { status: 403 })
  }

  const { deleted_at: _da, deleted_by: _db2, ...restored } = item
  bin.splice(idx, 1)
  db.unshift({ ...restored, is_new: false, modified_at: new Date().toISOString() } as DbItem)

  await Promise.all([
    pushDb(db, dbSha, `Restore: ${item.name}`),
    pushBin(bin, binSha, `Bin: -${item.name}`)
  ])

  await addLog(session.username, `Restore: "${item.name}"`)
  return NextResponse.json({ ok: true })
}

// DELETE — permanent delete from bin
export async function DELETE(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uid } = await req.json()
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
  await pushBin(bin, sha, `Permanent delete: ${item.name}`)
  await addLog(session.username, `Permanent delete: "${item.name}"`)
  return NextResponse.json({ ok: true })
}
