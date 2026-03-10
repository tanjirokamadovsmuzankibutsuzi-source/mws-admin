// app/api/migrate-uid/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb, pushDb, generateUID } from '@/lib/github'

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const dbResult = await getDb()
  if (!dbResult) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  const { data, sha } = dbResult
  let migrated = 0
  const now = new Date().toISOString()

  const updated = data.map(item => {
    const changed: Record<string, unknown> = { ...item }
    if (!item.uid) { changed.uid = generateUID(); migrated++ }
    if (!item.uploader_id) changed.uploader_id = 'owner'
    if (!item.created_at) changed.created_at = now
    if (!item.modified_at) changed.modified_at = now
    return changed
  })

  const pushed = await pushDb(updated as never, sha, `Migrate: UID added to ${migrated} entries`)
  if (!pushed) return NextResponse.json({ error: 'Push failed' }, { status: 500 })

  return NextResponse.json({ ok: true, migrated, total: data.length, message: `${migrated} entries updated with UID` })
}

// GET — preview how many need migration
export async function GET(req: NextRequest) {
  const session = await getSession(req)
  if (!session || session.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const dbResult = await getDb()
  if (!dbResult) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  const { data } = dbResult
  const needsUid = data.filter(i => !i.uid).length
  const needsUploader = data.filter(i => !i.uploader_id).length

  return NextResponse.json({ total: data.length, needsUid, needsUploader, alreadyMigrated: data.length - needsUid })
}
