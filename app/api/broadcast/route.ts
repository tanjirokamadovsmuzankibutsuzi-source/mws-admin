import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { addLog } from '@/lib/github'

const BOT_TOKEN = process.env.BOT_TOKEN!
const TARGET_CHANNELS = (process.env.TARGET_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean)

export async function POST(req: NextRequest) {
  const session = await getSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, photoUrl, buttons } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })
  if (!TARGET_CHANNELS.length) return NextResponse.json({ error: 'No target channels configured' }, { status: 400 })

  let success = 0
  const errors: string[] = []

  for (const chatId of TARGET_CHANNELS) {
    try {
      const base = `https://api.telegram.org/bot${BOT_TOKEN}`
      const markup = buttons?.length ? { inline_keyboard: buttons } : undefined
      let res
      if (photoUrl) {
        res = await fetch(`${base}/sendPhoto`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: message, parse_mode: 'HTML', reply_markup: markup })
        })
      } else {
        res = await fetch(`${base}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML', reply_markup: markup, disable_web_page_preview: false })
        })
      }
      if (res.ok) success++
      else { const err = await res.json(); errors.push(`${chatId}: ${err.description}`) }
    } catch (e) { errors.push(`${chatId}: ${String(e)}`) }
  }

  await addLog(session.username, `Broadcast: ${success}/${TARGET_CHANNELS.length} channels`)
  return NextResponse.json({ ok: true, success, total: TARGET_CHANNELS.length, errors })
}
