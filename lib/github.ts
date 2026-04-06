// lib/github.ts — GitHub DB operations for MWS v2

export interface DbItem {
  uid: string; name: string; title?: string; year?: string; type?: string
  tmdb_id?: string; imdb_id?: string; backdrop?: string; genre?: string[]
  rating?: string; size: string; audio?: string; langs?: string; hub: string; gdf: string
  custom_buttons?: { text: string; url: string }[]
  tags?: string[]; tag_added_at?: string; is_new?: boolean
  uploader_id: string; created_at: string; modified_at: string
}

export interface BinItem extends DbItem { deleted_at: string; deleted_by: string }
export interface LogEntry { date: string; user: string; action: string }

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO_NAME = process.env.REPO_NAME

async function ghFetch(path: string) {
  if (!GITHUB_TOKEN || !REPO_NAME) {
    throw new Error(`Missing env vars: TOKEN=${!!GITHUB_TOKEN} REPO=${!!REPO_NAME}`)
  }

  const res = await fetch(`https://api.github.com/repos/${REPO_NAME}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status}`)

  const json = await res.json()
  const sha: string = json.sha

  // GitHub API returns empty content for files > 1MB
  // Use download_url to fetch raw content in that case
  if (!json.content || json.content.trim() === '') {
    if (!json.download_url) throw new Error('No content and no download_url')
    const rawRes = await fetch(json.download_url, { cache: 'no-store' })
    if (!rawRes.ok) throw new Error(`Raw fetch failed: ${rawRes.status}`)
    const data = await rawRes.json()
    return { data, sha }
  }

  const data = JSON.parse(Buffer.from(json.content, 'base64').toString('utf-8'))
  return { data, sha }
}

async function ghPush(path: string, data: unknown, sha: string, message: string) {
  if (!GITHUB_TOKEN || !REPO_NAME) throw new Error('Missing env vars')
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
  const res = await fetch(`https://api.github.com/repos/${REPO_NAME}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content, sha }),
  })
  return res.ok
}

export async function getDb(): Promise<{ data: DbItem[]; sha: string } | null> {
  try {
    const { data, sha } = await ghFetch('database.json')
    const now = new Date()
    const cleaned = (data as DbItem[]).map(item => {
      if (item.tags?.length && item.tag_added_at) {
        const diff = (now.getTime() - new Date(item.tag_added_at).getTime()) / 3600000
        if (diff >= 24) { item.tags = []; delete item.tag_added_at }
      }
      return item
    })
    return { data: cleaned, sha }
  } catch (e) { console.error('getDb error:', e); return null }
}

export async function pushDb(data: DbItem[], sha: string, message = 'Web Update'): Promise<boolean> {
  const updated = data.map((item, i) => ({ ...item, is_new: i < 5 }))
  return ghPush('database.json', updated, sha, message)
}

export async function getBin(): Promise<{ data: BinItem[]; sha: string } | null> {
  try {
    const { data, sha } = await ghFetch('recyclebin.json')
    return { data: data as BinItem[], sha }
  } catch (e) { console.error('getBin error:', e); return null }
}

export async function pushBin(data: BinItem[], sha: string, message = 'Bin Update'): Promise<boolean> {
  return ghPush('recyclebin.json', data, sha, message)
}

export async function getLogs(): Promise<{ data: LogEntry[]; sha: string } | null> {
  try {
    const { data, sha } = await ghFetch('logs.json')
    return { data: data as LogEntry[], sha }
  } catch (e) { console.error('getLogs error:', e); return null }
}

export async function addLog(user: string, action: string): Promise<void> {
  try {
    const result = await getLogs()
    if (!result) return
    const { data, sha } = result
    const newLog: LogEntry = { date: new Date().toISOString(), user, action }
    const updated = [newLog, ...data].slice(0, 500)
    await ghPush('logs.json', updated, sha, `Log: ${action}`)
  } catch (e) { console.error('addLog error:', e) }
}

export function encodeLink(url: string): string { return Buffer.from(url).toString('base64') }
export function decodeLink(b64: string): string { return Buffer.from(b64, 'base64').toString('utf-8') }
export function generateUID(): string { return `mws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }
