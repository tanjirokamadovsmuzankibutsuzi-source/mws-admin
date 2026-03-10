// lib/parser.ts — MWS v2 parser with UID + uploader_id

import { DbItem, encodeLink, generateUID } from './github'
import { fetchTmdbFromImdb, fetchTmdbDirectly, TmdbMeta } from './tmdb'

const LANG_CODES: Record<string, string> = {
  hin: 'Hindi', eng: 'English', tam: 'Tamil', tel: 'Telugu',
  kan: 'Kannada', mal: 'Malayalam', jap: 'Japanese', jpn: 'Japanese',
  kor: 'Korean', chi: 'Chinese', spa: 'Spanish', fre: 'French',
  ger: 'German', ita: 'Italian', por: 'Portuguese', rus: 'Russian',
  ara: 'Arabic', ben: 'Bengali',
}

function detectAudio(fullText: string, name: string): string {
  const combined = (fullText + ' ' + name).toUpperCase()
  const manualMatch = fullText.match(/-?audLang\s*=\s*([a-z,]+)/i)
  if (manualMatch) {
    return manualMatch[1].toLowerCase().split(',')
      .map((c: string) => LANG_CODES[c.trim()] || c.trim().charAt(0).toUpperCase() + c.trim().slice(1))
      .join(' | ')
  }
  if (combined.includes('MULTI')) return 'Multi Audio'
  if (combined.includes('DUAL')) return 'Dual Audio'
  const detected: string[] = []
  if (/\bHIN\b/.test(name.toUpperCase())) detected.push('Hindi')
  if (/\bENG\b/.test(name.toUpperCase())) detected.push('English')
  if (/\bTAM\b/.test(name.toUpperCase())) detected.push('Tamil')
  if (/\bTEL\b/.test(name.toUpperCase())) detected.push('Telugu')
  if (/\bKAN\b/.test(name.toUpperCase())) detected.push('Kannada')
  if (/\bMAL\b/.test(name.toUpperCase())) detected.push('Malayalam')
  return detected.length ? detected.join(' | ') : 'Hindi Dubbed'
}

function extractTags(text: string): string[] {
  const tags: string[] = []
  if (/\b#?Exclusive\b/i.test(text)) tags.push('exclusive')
  if (/\b#?Trending\b/i.test(text)) tags.push('trending')
  if (/\b#?FirstOnNet\b/i.test(text)) tags.push('firstonnet')
  if (/\b#?New\b/i.test(text)) tags.push('new')
  return tags
}

function extractIds(text: string): { imdbId: string | null; tmdbId: string | null } {
  const imdbMatch = text.match(/-imdb\s*=\s*(tt\d{7,})/i)
  if (imdbMatch) return { imdbId: imdbMatch[1], tmdbId: null }
  const tmdbMatch = text.match(/-tmdb\s*=\s*(\d+)/i)
  if (tmdbMatch) return { imdbId: null, tmdbId: tmdbMatch[1] }
  const standalone = text.match(/\b(tt\d{7,})\b/)
  if (standalone) return { imdbId: standalone[1], tmdbId: null }
  return { imdbId: null, tmdbId: null }
}

export async function parseInput(
  text: string,
  uploaderId: string
): Promise<{ meta: Partial<TmdbMeta>; files: Partial<DbItem>[] }> {
  const lines = text.trim().split('\n')
  const { imdbId, tmdbId } = extractIds(text)
  let meta: Partial<TmdbMeta> = {}
  if (imdbId) meta = (await fetchTmdbFromImdb(imdbId)) || {}
  else if (tmdbId) meta = (await fetchTmdbDirectly(tmdbId, 'movie')) || (await fetchTmdbDirectly(tmdbId, 'tv')) || {}

  const files: Partial<DbItem>[] = []
  let currentFile: Partial<DbItem> | null = null
  let bulkAudio: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^-audLang\s*=/i.test(trimmed) && !/\[.*(?:GB|MB|TB).*\]/i.test(trimmed)) { bulkAudio = trimmed; break }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line === bulkAudio) continue
    if (/^-(?:imdb|tmdb)\s*=/i.test(line)) continue
    if (/^tt\d{7,}$/.test(line)) continue

    const dlbtnMatch = line.match(/^-dlbtn(\d+)<([^>]+)>\s*=\s*(.+)$/i)
    if (dlbtnMatch && currentFile) {
      if (!currentFile.custom_buttons) currentFile.custom_buttons = []
      currentFile.custom_buttons.push({ text: dlbtnMatch[2].trim(), url: encodeLink(dlbtnMatch[3].trim()) })
      continue
    }

    if (/^https?:\/\//i.test(line)) {
      if (currentFile) {
        const enc = encodeLink(line)
        const lc = line.toLowerCase()
        if (lc.includes('hub') || lc.includes('hubcloud')) currentFile.hub = enc
        else if (lc.includes('gdf') || lc.includes('gdflix') || lc.includes('drive')) currentFile.gdf = enc
        else if (!currentFile.hub) currentFile.hub = enc
        else if (!currentFile.gdf) currentFile.gdf = enc
      }
      continue
    }

    const fileMatch = line.match(/^(.*?)\s*\[(\d+\.?\d*\s*(?:GB|MB|TB))\](.*)$/i)
    if (fileMatch) {
      if (currentFile) files.push(currentFile)
      const name = fileMatch[1].trim()
      const size = fileMatch[2].trim().toUpperCase()
      let lineForDetection = line
      if (bulkAudio && !/audLang/i.test(line)) lineForDetection = line + ' ' + bulkAudio
      const tags = extractTags(line)
      const now = new Date().toISOString()
      currentFile = {
        uid: generateUID(), name, size,
        audio: detectAudio(lineForDetection, name),
        hub: '', gdf: '', custom_buttons: [],
        tags, tag_added_at: tags.length ? now : undefined,
        is_new: true, uploader_id: uploaderId,
        created_at: now, modified_at: now,
        ...(meta.backdrop && { backdrop: meta.backdrop }),
        ...(meta.imdb_id && { imdb_id: meta.imdb_id }),
        ...(meta.tmdb_id && { tmdb_id: meta.tmdb_id }),
        ...(meta.genres && { genre: meta.genres.split(' | ') }),
        ...(meta.type && { type: meta.type }),
        ...(meta.title && { title: meta.title }),
        ...(meta.year && { year: meta.year }),
        ...(meta.rating && { rating: meta.rating }),
      }
    }
  }
  if (currentFile) files.push(currentFile)
  return { meta, files }
}
