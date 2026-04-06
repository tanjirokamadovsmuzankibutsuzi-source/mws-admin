// lib/telegram.ts
const BOT_TOKEN = process.env.BOT_TOKEN!
const TARGET_CHANNELS = (process.env.TARGET_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean)
const WEBSITE_URL = process.env.WEBSITE_URL || ''
const ALERTS_CHANNEL_LINK = process.env.ALERTS_CHANNEL_LINK || ''

export interface TmdbMeta {
  title?: string; year?: string; backdrop?: string; imdb_id?: string
  tmdb_id?: string; genres?: string; type?: string; rating?: string
}

async function sendTelegramMessage(chatId: string, text: string, buttons?: unknown[][], photoUrl?: string) {
  const base = `https://api.telegram.org/bot${BOT_TOKEN}`
  const markup = buttons?.length ? { inline_keyboard: buttons } : undefined

  if (photoUrl) {
    const res = await fetch(`${base}/sendPhoto`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: text, parse_mode: 'HTML', reply_markup: markup })
    })
    if (res.ok) return
  }

  await fetch(`${base}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup: markup, disable_web_page_preview: true })
  })
}

export function formatPost(meta: Partial<TmdbMeta>, files: Partial<{ name: string; size: string; audio: string; tags?: string[] }>[]) {
  let text = ''

  if (meta.title) {
    text += `🎬 <b>${meta.title}</b>`
    if (meta.year) text += ` (${meta.year})`
    text += '\n'
    if (meta.rating) text += `⭐️ <b>${meta.rating}/10</b>`
    if (meta.genres) text += ` | 🎭 ${meta.genres}`
    if (meta.rating || meta.genres) text += '\n'
    text += '\n'
  }

  for (const f of files) {
    const tags = f.tags?.map(t => `#${t}`).join(' ') || ''
    text += `📂 <b>${f.name}</b>\n`
    text += `└ 💾 ${f.size} • 🎵 ${f.audio}`
    if (tags) text += ` • ${tags}`
    text += '\n'
  }

  text += `\n<i>© MWS - Dev END!</i>`
  return text
}

export function createButtons() {
  const buttons: { text: string; url: string }[][] = []
  const row: { text: string; url: string }[] = []
  if (ALERTS_CHANNEL_LINK) row.push({ text: '📢 Join Channel', url: ALERTS_CHANNEL_LINK })
  if (WEBSITE_URL) row.push({ text: '🌐 Website', url: WEBSITE_URL })
  if (row.length) buttons.push(row)
  return buttons
}

export async function broadcastToChannels(
  meta: Partial<TmdbMeta>,
  files: Partial<{ name: string; size: string; audio: string; tags?: string[] }>[]
) {
  if (!TARGET_CHANNELS.length || !BOT_TOKEN) return { success: 0, total: 0 }
  const text = formatPost(meta, files)
  const buttons = createButtons()
  let success = 0

  for (const chatId of TARGET_CHANNELS) {
    try {
      await sendTelegramMessage(chatId, text, buttons, meta.backdrop ?? undefined)
      success++
    } catch (e) { console.error(`Broadcast error to ${chatId}:`, e) }
  }

  return { success, total: TARGET_CHANNELS.length }
}
