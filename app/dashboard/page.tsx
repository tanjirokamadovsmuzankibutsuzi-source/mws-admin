'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

interface DbItem {
  uid: string; name: string; size: string; audio?: string; langs?: string; hub: string; gdf: string
  custom_buttons?: { text: string; url: string }[]
  tags?: string[]; is_new?: boolean; backdrop?: string; imdb_id?: string
  title?: string; year?: string; rating?: string; genre?: string[]; type?: string
  uploader_id: string; created_at: string; modified_at: string
}
interface BinItem extends DbItem { deleted_at: string; deleted_by: string }
interface LogEntry { date: string; user: string; action: string }
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info' }
interface PostResult { added: number; updated: number; files: number; meta?: { title?: string; year?: string; backdrop?: string }; broadcast?: { success: number; total: number } }

const Icon = {
  post: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M12 5v14M5 12l7-7 7 7"/></svg>,
  db: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  link: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  stats: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  bin: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  edit: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>,
  copy: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  restore: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M3 12a9 9 0 109-9H3"/><polyline points="3 3 3 9 9 9"/></svg>,
  eye: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  check: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg>,
}

function Toasts({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full px-4 md:px-0">
      {toasts.map(t => (
        <div key={t.id} className={`toast-enter flex items-start gap-3 px-4 py-3 rounded-xl text-sm shadow-xl border ${t.type==='success'?'bg-green-500/10 border-green-500/30 text-green-400':t.type==='error'?'bg-red-500/10 border-red-500/30 text-red-400':'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
          <span>{t.type==='success'?'✅':t.type==='error'?'❌':'ℹ️'}</span>
          <span className="flex-1 text-xs">{t.message}</span>
          <button onClick={() => remove(t.id)} className="opacity-50 hover:opacity-100">×</button>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [tab, setTab] = useState<'post'|'db'|'link'|'stats'|'bin'>('post')
  const [user, setUser] = useState<{username:string;role:string}|null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const tid = useRef(0)

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++tid.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])
  const removeToast = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), [])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error) window.location.href = '/login'
      else setUser(d)
    })
  }, [])

  if (!user) return <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" /></div>

  const tabs = [
    { id: 'post' as const, label: 'Post', icon: Icon.post },
    { id: 'db' as const, label: 'Database', icon: Icon.db },
    { id: 'link' as const, label: 'Links', icon: Icon.link },
    { id: 'stats' as const, label: 'Stats', icon: Icon.stats },
    { id: 'bin' as const, label: 'Bin', icon: Icon.bin },
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex">
      <Toasts toasts={toasts} remove={removeToast} />
      <aside className="hidden md:flex w-56 shrink-0 border-r border-[#1E1E2A] flex-col bg-[#111118] fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-5 border-b border-[#1E1E2A]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#E50914]/10 border border-[#E50914]/30 flex items-center justify-center">
              <span className="text-[#E50914] text-sm font-bold">M</span>
            </div>
            <div><p className="font-bold text-white text-sm">MWS Admin</p><p className="text-[#6B6B80] text-xs">v2.0</p></div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1">
          {tabs.map(({ id, label, icon: Ic }) => (
            <button key={id} onClick={() => setTab(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${tab===id?'bg-[#E50914]/10 text-[#E50914] border border-[#E50914]/20':'text-[#6B6B80] hover:text-white hover:bg-white/5'}`}>
              <Ic />{label}
            </button>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-[#1E1E2A]">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-7 h-7 rounded-lg bg-[#E50914]/20 flex items-center justify-center shrink-0">
              <span className="text-[#E50914] text-xs font-bold uppercase">{user.username[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user.username}</p>
              <p className="text-[#6B6B80] text-xs capitalize">{user.role}</p>
            </div>
            <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login' }} className="text-[#6B6B80] hover:text-red-400 text-xs">⏻</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-56 pb-20 md:pb-0 overflow-x-hidden">
        {tab === 'post' && <PostTab toast={toast} role={user.role} username={user.username} />}
        {tab === 'db' && <DbTab toast={toast} role={user.role} username={user.username} />}
        {tab === 'link' && <LinkTab toast={toast} />}
        {tab === 'stats' && <StatsTab role={user.role} />}
        {tab === 'bin' && <BinTab toast={toast} role={user.role} username={user.username} />}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#111118] border-t border-[#1E1E2A] z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex">
          {tabs.map(({ id, label, icon: Ic }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex-1 flex flex-col items-center gap-1 py-3 transition-all ${tab===id?'text-[#E50914]':'text-[#6B6B80]'}`}>
              <Ic />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

// ── POST TAB ──────────────────────────────────────────────────────────────────
function PostTab({ toast, role: _r, username: _u }: { toast: (m:string,t?:Toast['type'])=>void; role:string; username:string }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState<'post'|'broadcast'|null>(null)
  const [result, setResult] = useState<PostResult|null>(null)
  const [previewMode, setPreviewMode] = useState<'telegram'|'json'|'web'|null>(null)
  const [parsedPreview, setParsedPreview] = useState<{meta:Record<string,unknown>;files:Record<string,unknown>[]}|null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  async function handlePreview(mode: 'telegram'|'json'|'web') {
    if (!text.trim()) return toast('Input empty!', 'error')
    setPreviewMode(mode); setPreviewLoading(true)
    try {
      const res = await fetch('/api/post', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text, broadcast:false, previewOnly:true }) })
      const data = await res.json()
      if (res.ok && data.preview) setParsedPreview(data.preview)
      else { toast(data.error||'Parse failed','error'); setPreviewMode(null) }
    } catch { toast('Preview failed','error'); setPreviewMode(null) }
    finally { setPreviewLoading(false) }
  }

  async function handlePost(withBroadcast: boolean) {
    if (!text.trim()) return toast('Input empty!', 'error')
    setLoading(withBroadcast ? 'broadcast' : 'post'); setResult(null)
    try {
      const res = await fetch('/api/post', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text, broadcast: withBroadcast }) })
      const data = await res.json()
      if (!res.ok) toast(data.error||'Failed','error')
      else {
        setResult(data as PostResult)
        toast(withBroadcast ? `✅ Posted & Broadcast: ${data.broadcast?.success??0} channels` : `✅ Added: ${data.added} | Updated: ${data.updated}`, 'success')
        setText('')
      }
    } catch { toast('Network error','error') }
    finally { setLoading(null) }
  }

  const EXAMPLES = [
    `tt0816692\nInterstellar [25GB] -audLang=hin,eng\nhttps://hubcloud.example/file1\nhttps://gdflix.example/file1`,
    `The Batman [15GB] #Exclusive\nhttps://hubcloud.example/batman`,
    `Movie 1 [4GB]\nhttps://link1\nMovie 2 [6GB]\nhttps://link2\n-audLang=hin,eng,tam`,
  ]

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6"><h1 className="text-xl md:text-2xl font-bold text-white">Post Files</h1><p className="text-[#6B6B80] text-sm mt-1">Add to DB & broadcast to Telegram</p></div>

      <div className="glass rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-[#6B6B80] uppercase tracking-widest">Input</span>
          <div className="flex gap-1.5">
            {EXAMPLES.map((ex,i) => <button key={i} onClick={() => setText(ex)} className="text-xs bg-white/5 hover:bg-white/10 text-[#6B6B80] hover:text-white px-2.5 py-1 rounded-lg transition-all">Ex {i+1}</button>)}
          </div>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder={`tt0816692\nMovie Name [25GB] -audLang=hin,eng\nhttps://hubcloud-link\nhttps://gdflix-link`} rows={10}
          className="w-full bg-[#0A0A0F] border border-[#1E1E2A] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#6B6B80]/50 font-mono focus:outline-none focus:border-[#E50914]/40 resize-none transition-all" />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {(['telegram','json','web'] as const).map(mode => (
          <button key={mode} onClick={() => handlePreview(mode)} disabled={previewLoading}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#1E1E2A] text-[#6B6B80] hover:text-white hover:border-white/20 text-xs font-medium transition-all disabled:opacity-40">
            <Icon.eye />{mode==='telegram'?'📱 TG Preview':mode==='json'?'📄 JSON':'🌐 Web'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => handlePost(false)} disabled={!!loading||!text.trim()}
          className="flex items-center justify-center gap-2 bg-[#1E1E2A] hover:bg-[#2a2a3a] border border-[#2a2a3a] hover:border-white/20 disabled:opacity-40 text-white text-sm font-semibold py-3 rounded-xl transition-all">
          {loading==='post' ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : '💾'}
          Post to DB
        </button>
        <button onClick={() => handlePost(true)} disabled={!!loading||!text.trim()}
          className="flex items-center justify-center gap-2 bg-[#E50914] hover:bg-red-700 disabled:opacity-40 text-white text-sm font-semibold py-3 rounded-xl transition-all glow-red">
          {loading==='broadcast' ? <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : '📢'}
          Broadcast to TG
        </button>
      </div>

      {result && (
        <div className="mt-4 glass rounded-2xl p-4 border border-green-500/20 animate-fade-in">
          <p className="text-green-400 font-semibold text-sm mb-3">✅ Success!</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {([['🆕 Added',result.added],['🔄 Updated',result.updated],['📂 Files',result.files]] as [string,number][]).map(([l,v]) => (
              <div key={l} className="bg-[#0A0A0F] rounded-xl p-2.5 text-center">
                <div className="text-xl font-bold text-white">{v}</div>
                <div className="text-[#6B6B80] text-xs mt-0.5">{l}</div>
              </div>
            ))}
          </div>
          {result.meta?.title && (
            <div className="flex items-center gap-3 bg-[#0A0A0F] rounded-xl p-2.5">
              {result.meta?.backdrop && <img src={result.meta.backdrop} alt="" className="w-12 h-7 object-cover rounded-lg shrink-0" />}
              <div><p className="text-white text-xs font-medium">{result.meta.title}</p><p className="text-[#6B6B80] text-xs">{result.meta.year}</p></div>
            </div>
          )}
          {result.broadcast && <p className="text-[#6B6B80] text-xs mt-2">📢 {result.broadcast.success}/{result.broadcast.total} channels</p>}
        </div>
      )}

      {previewMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col p-4" onClick={() => setPreviewMode(null)}>
          <div className="flex-1 overflow-auto max-w-lg mx-auto w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">{previewMode==='telegram'?'📱 Telegram':previewMode==='json'?'📄 JSON':'🌐 Web'} Preview</h3>
              <button onClick={() => setPreviewMode(null)} className="text-[#6B6B80] hover:text-white text-2xl">×</button>
            </div>
            {previewLoading ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" /></div>
            ) : parsedPreview ? (
              <>
                {previewMode==='telegram' && <TelegramPreview meta={parsedPreview.meta} files={parsedPreview.files} />}
                {previewMode==='json' && <div className="bg-[#0A0A0F] rounded-xl p-4 overflow-auto max-h-[70vh]"><pre className="text-xs text-green-400 whitespace-pre-wrap">{JSON.stringify(parsedPreview.files,null,2)}</pre></div>}
                {previewMode==='web' && <WebPreview meta={parsedPreview.meta} files={parsedPreview.files} />}
              </>
            ) : <p className="text-[#6B6B80] text-center py-8">No preview</p>}
          </div>
        </div>
      )}

      <div className="mt-4 glass rounded-2xl p-4">
        <p className="text-xs font-semibold text-[#6B6B80] uppercase tracking-widest mb-3">Format Guide</p>
        <div className="grid grid-cols-1 gap-2 text-xs font-mono">
          {([['With IMDB','tt1234567\nFilename [25GB]\nhttps://hub-link'],['Bulk Audio','Movie1 [2GB]\nhttps://link1\nMovie2 [3GB]\nhttps://link2\n-audLang=hin,eng'],['Tags','Movie [4GB] #Exclusive\nhttps://link'],['Audio codes','hin eng tam tel kan mal\njap kor chi spa fre']] as [string,string][]).map(([t,c]) => (
            <div key={t} className="bg-[#0A0A0F] rounded-xl p-3">
              <p className="text-[#E50914] text-xs mb-1.5 font-sans font-semibold">{t}</p>
              <pre className="text-[#6B6B80] text-xs whitespace-pre-wrap leading-relaxed">{c}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TelegramPreview({ meta, files }: { meta:Record<string,unknown>; files:Record<string,unknown>[] }) {
  return (
    <div className="bg-[#17212B] rounded-2xl overflow-hidden text-white max-w-sm mx-auto">
      {(meta.backdrop as string) && <img src={meta.backdrop as string} alt="" className="w-full h-40 object-cover" />}
      <div className="p-4 text-sm">
        {(meta.title as string) ? (
          <>
            <p className="font-bold text-base">{meta.title as string} {meta.year && `(${meta.year})`}</p>
            {(meta.rating as string) && <p className="text-yellow-400 text-xs mt-1">⭐️ {meta.rating as string}/10 {(meta.genres as string) && `| 🎭 ${meta.genres}`}</p>}
            <div className="border-t border-white/10 my-2" />
          </>
        ) : <p className="font-bold">⌬ New Upload</p>}
        {(files as Record<string,string>[]).map((f,i) => (
          <div key={i} className="mb-2 text-xs">
            <p className="font-semibold text-sm">📂 {f.name}</p>
            <p className="text-gray-300">└ 💾 {f.size} • 🎵 {f.audio||f.langs||''}</p>
          </div>
        ))}
        <div className="mt-3 border-t border-white/10 pt-2 text-xs text-gray-400">© MWS - Dev END!</div>
      </div>
    </div>
  )
}

function WebPreview({ meta, files }: { meta:Record<string,unknown>; files:Record<string,unknown>[] }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      {(meta.backdrop as string) && <img src={meta.backdrop as string} alt="" className="w-full h-36 object-cover" />}
      <div className="p-4">
        {(meta.title as string) && <div className="mb-3"><h2 className="text-white font-bold text-lg">{meta.title as string} {meta.year && <span className="text-[#6B6B80] text-sm">({meta.year as string})</span>}</h2>{(meta.rating as string) && <p className="text-yellow-400 text-sm">⭐ {meta.rating as string}/10</p>}</div>}
        {(files as Record<string,string>[]).map((f,i) => (
          <div key={i} className="bg-[#0A0A0F] rounded-xl p-3 mb-2">
            <p className="text-white text-sm font-medium truncate">{f.name}</p>
            <p className="text-[#6B6B80] text-xs mt-1">💾 {f.size} • 🎵 {f.audio||f.langs||''}</p>
            <div className="flex gap-2 mt-2">
              {f.hub && <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded-lg">☁️ HubCloud</span>}
              {f.gdf && <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded-lg">⚡ GDFliX</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── DATABASE TAB ──────────────────────────────────────────────────────────────
function DbTab({ toast, role, username }: { toast:(m:string,t?:Toast['type'])=>void; role:string; username:string }) {
  const [items, setItems] = useState<DbItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [editItem, setEditItem] = useState<DbItem|null>(null)
  const [editField, setEditField] = useState('')
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  async function load(p=1, search=q) {
    setLoading(true)
    try {
      const res = await fetch(`/api/db?q=${encodeURIComponent(search)}&page=${p}&limit=20`)
      const data = await res.json()
      setItems(data.results||[]); setTotal(data.total||0); setPage(data.page||1); setPages(data.pages||1)
      setSelected(new Set())
    } catch { toast('Load failed','error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load(1) }, [])

  async function softDelete(uid: string) {
    if (!confirm('Move to recycle bin?')) return
    const res = await fetch('/api/db', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ uid }) })
    if (res.ok) { toast('Moved to bin','success'); load(page) }
    else { const d = await res.json(); toast(d.error,'error') }
  }

  async function bulkDelete() {
    if (!selected.size) return
    if (!confirm(`Move ${selected.size} entries to recycle bin?`)) return
    setBulkDeleting(true)
    const res = await fetch('/api/db', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ uids: Array.from(selected) }) })
    const data = await res.json()
    if (res.ok) { toast(`Moved ${data.deleted} to bin`,'success'); load(page) }
    else toast(data.error,'error')
    setBulkDeleting(false)
  }

  function toggleSelect(uid: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(uid)) n.delete(uid); else n.add(uid); return n })
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set())
    else setSelected(new Set(items.map(i => i.uid)))
  }

  function startEdit(item: DbItem, field: string) {
    setEditItem(item); setEditField(field)
    const val = (item as unknown as Record<string,unknown>)[field]
    if (field==='hub'||field==='gdf') setEditValue('')
    else if (field==='genre'||field==='tags') setEditValue(Array.isArray(val)?(val as string[]).join(', '):'')
    else setEditValue((val as string)||'')
  }

  async function saveEdit() {
    if (!editItem) return
    setSaving(true)
    try {
      const res = await fetch('/api/db', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ uid:editItem.uid, field:editField, value:editValue }) })
      const data = await res.json()
      if (res.ok) { toast('Saved!','success'); setEditItem(null); load(page) }
      else toast(data.error,'error')
    } catch { toast('Save failed','error') }
    finally { setSaving(false) }
  }

  const EDITABLE_FIELDS = [
    {key:'name',label:'Name'},{key:'title',label:'Title'},{key:'year',label:'Year'},
    {key:'size',label:'Size'},{key:'audio',label:'Audio'},{key:'langs',label:'Langs'},
    {key:'hub',label:'Hub URL (raw)'},{key:'gdf',label:'GDF URL (raw)'},
    {key:'backdrop',label:'Backdrop URL'},{key:'genre',label:'Genres (comma)'},
    {key:'tags',label:'Tags (comma)'},{key:'rating',label:'Rating'},
    {key:'type',label:'Type (movie/tv)'},{key:'imdb_id',label:'IMDB ID'},{key:'tmdb_id',label:'TMDB ID'},
  ]

  const canEdit = (item: DbItem) => role==='owner' || item.uploader_id===username

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-xl md:text-2xl font-bold text-white">Database Manager</h1><p className="text-[#6B6B80] text-sm mt-0.5">{total} entries {role!=='owner'&&'(yours)'}</p></div>
        {role==='owner' && (
          <div className="flex gap-2">
            <button onClick={() => window.open('/api/getfile?format=json','_blank')} className="text-xs bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-xl border border-[#1E1E2A] transition-all">⬇ JSON</button>
            <button onClick={() => window.open('/api/getfile?format=txt','_blank')} className="text-xs bg-white/5 hover:bg-white/10 text-white px-3 py-2 rounded-xl border border-[#1E1E2A] transition-all">⬇ TXT</button>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==='Enter'&&load(1,q)}
          placeholder="Search name, title, audio, UID..."
          className="flex-1 bg-[#111118] border border-[#1E1E2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6B6B80]/50 focus:outline-none focus:border-[#E50914]/40 transition-all" />
        <button onClick={() => load(1,q)} disabled={loading} className="bg-[#E50914] hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0">{loading?'...':'🔍'}</button>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-[#E50914]/10 border border-[#E50914]/30 rounded-xl px-4 py-2.5 mb-3 animate-fade-in">
          <span className="text-[#E50914] text-sm font-semibold">{selected.size} selected</span>
          <button onClick={bulkDelete} disabled={bulkDeleting}
            className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-all ml-auto disabled:opacity-50">
            <Icon.trash />{bulkDeleting?'Deleting...':'Delete All'}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-[#6B6B80] hover:text-white px-2 py-1.5 transition-all">✕</button>
        </div>
      )}

      {/* Select all */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <button onClick={toggleAll} className="text-xs text-[#6B6B80] hover:text-white flex items-center gap-1.5 transition-all">
            <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${selected.size===items.length?'bg-[#E50914] border-[#E50914]':'border-[#1E1E2A]'}`}>
              {selected.size===items.length && <Icon.check />}
            </div>
            Select All
          </button>
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.uid} className={`glass rounded-xl p-3 md:p-4 transition-all ${selected.has(item.uid)?'border-[#E50914]/30':''}`}>
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              {canEdit(item) && (
                <button onClick={() => toggleSelect(item.uid)} className="shrink-0 mt-1">
                  <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${selected.has(item.uid)?'bg-[#E50914] border-[#E50914]':'border-[#1E1E2A]'}`}>
                    {selected.has(item.uid) && <Icon.check />}
                  </div>
                </button>
              )}
              {item.backdrop && <img src={item.backdrop} alt="" className="w-14 h-9 object-cover rounded-lg shrink-0 hidden sm:block" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium leading-tight">{item.name}</p>
                    {item.title && <p className="text-[#6B6B80] text-xs mt-0.5">🎬 {item.title} {item.year&&`(${item.year})`}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      <span className="text-[#6B6B80] text-xs">💾 {item.size}</span>
                      <span className="text-[#6B6B80] text-xs">🎵 {item.audio||item.langs||'—'}</span>
                      <span className="text-[#6B6B80] text-xs">👤 {item.uploader_id}</span>
                      {item.hub && <span className="text-green-400 text-xs">☁️</span>}
                      {item.gdf && <span className="text-blue-400 text-xs">⚡</span>}
                    </div>
                    {item.tags?.length ? <div className="flex flex-wrap gap-1 mt-1">{item.tags.map(t => <span key={t} className="text-xs bg-[#E50914]/10 text-[#E50914] px-1.5 py-0.5 rounded">#{t}</span>)}</div> : null}
                  </div>
                  {canEdit(item) && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => { setEditItem(item); setEditField(''); setEditValue('') }}
                        className="flex items-center gap-1 text-xs text-[#6B6B80] hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-all">
                        <Icon.edit /> Edit
                      </button>
                      <button onClick={() => softDelete(item.uid)}
                        className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg transition-all">
                        <Icon.trash /> Delete
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[#6B6B80]/40 text-xs mt-1.5 font-mono truncate">uid: {item.uid}</p>
              </div>
            </div>
          </div>
        ))}
        {!loading && !items.length && <div className="text-center py-16 text-[#6B6B80]"><p className="text-4xl mb-2">📭</p><p className="text-sm">No entries</p></div>}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => { const p=page-1; setPage(p); load(p) }} disabled={page===1} className="px-4 py-2 rounded-xl text-sm border border-[#1E1E2A] text-[#6B6B80] hover:text-white disabled:opacity-30 transition-all">←</button>
          <span className="px-4 py-2 text-sm text-[#6B6B80]">{page}/{pages}</span>
          <button onClick={() => { const p=page+1; setPage(p); load(p) }} disabled={page===pages} className="px-4 py-2 rounded-xl text-sm border border-[#1E1E2A] text-[#6B6B80] hover:text-white disabled:opacity-30 transition-all">→</button>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4">
          <div className="glass-strong rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-auto animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base">Edit Entry</h3>
              <button onClick={() => setEditItem(null)} className="text-[#6B6B80] hover:text-white text-xl">×</button>
            </div>
            <p className="text-[#6B6B80] text-xs mb-4 truncate font-mono">{editItem.uid}</p>
            {!editField ? (
              <div className="grid grid-cols-2 gap-2">
                {EDITABLE_FIELDS.map(f => (
                  <button key={f.key} onClick={() => startEdit(editItem, f.key)}
                    className="text-left px-3 py-2.5 bg-[#0A0A0F] hover:bg-[#E50914]/10 hover:border-[#E50914]/30 border border-[#1E1E2A] rounded-xl text-sm text-white transition-all">
                    {f.label}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <button onClick={() => setEditField('')} className="text-xs text-[#6B6B80] hover:text-white mb-3 flex items-center gap-1">← Back</button>
                <label className="text-xs text-[#6B6B80] uppercase tracking-widest mb-2 block">{EDITABLE_FIELDS.find(f=>f.key===editField)?.label||editField}</label>
                {(editField==='hub'||editField==='gdf') && <p className="text-xs text-amber-400 mb-2">⚠️ Enter raw URL (auto-encoded)</p>}
                <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={3}
                  className="w-full bg-[#0A0A0F] border border-[#1E1E2A] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#E50914]/40 resize-none mb-3" />
                <div className="flex gap-2">
                  <button onClick={() => setEditField('')} className="flex-1 py-2.5 rounded-xl border border-[#1E1E2A] text-[#6B6B80] text-sm hover:text-white transition-all">Cancel</button>
                  <button onClick={saveEdit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#E50914] text-white text-sm font-semibold hover:bg-red-700 transition-all disabled:opacity-50">{saving?'Saving...':'Save'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── LINK TAB ──────────────────────────────────────────────────────────────────
function LinkTab({ toast }: { toast:(m:string,t?:Toast['type'])=>void }) {
  const [q, setQ] = useState('')
  const [source, setSource] = useState<'hub'|'gdf'|'both'>('both')
  const [suggestions, setSuggestions] = useState<{uid:string;name:string;size:string;audio:string}[]>([])
  const [selected, setSelected] = useState<{uid:string;name:string;size:string;audio:string}[]>([])
  const [linkMap, setLinkMap] = useState<Record<string,Record<string,unknown>>>({})
  const [loading, setLoading] = useState(false)
  const [withMeta, setWithMeta] = useState(true)

  async function search() {
    if (!q.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/getlink?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSuggestions(data.results||[])
    } catch { toast('Search failed','error') }
    finally { setLoading(false) }
  }

  async function addToSelected(item: {uid:string;name:string;size:string;audio:string}) {
    if (selected.find(s => s.uid===item.uid)) return
    const newSel = [...selected, item]
    setSelected(newSel); setSuggestions([])
    // Fetch links for this item
    try {
      const res = await fetch(`/api/getlink?uid=${item.uid}&source=${source}`)
      const data = await res.json()
      if (res.ok) setLinkMap(prev => ({ ...prev, [item.uid]: data.link }))
    } catch { toast('Failed to fetch links','error') }
  }

  function removeSelected(uid: string) { setSelected(prev => prev.filter(s => s.uid!==uid)) }

  function copyAll() {
    if (!selected.length) return toast('No files selected','error')
    let text = ''
    for (const item of selected) {
      const links = linkMap[item.uid]
      if (!links) continue
      if (withMeta) text += `${item.name} [${item.size}]\n`
      if (source==='hub'||source==='both') { if (links.hub) text += `${links.hub}\n` }
      if (source==='gdf'||source==='both') { if (links.gdf) text += `${links.gdf}\n` }
      text += '\n'
    }
    navigator.clipboard.writeText(text.trim())
    toast(`Copied ${selected.length} file(s)!`,'success')
  }

  function copySingle(item: {uid:string;name:string;size:string;audio:string}) {
    const links = linkMap[item.uid]
    if (!links) return toast('Links not loaded','error')
    let text = ''
    if (withMeta) text += `${item.name} [${item.size}]\n`
    if (source==='hub'||source==='both') { if (links.hub) text += `${links.hub as string}\n` }
    if (source==='gdf'||source==='both') { if (links.gdf) text += `${links.gdf as string}\n` }
    navigator.clipboard.writeText(text.trim())
    toast('Copied!','success')
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6"><h1 className="text-xl md:text-2xl font-bold text-white">Get Links</h1><p className="text-[#6B6B80] text-sm mt-1">Search, select multiple files & copy links</p></div>

      {/* Source + Meta toggle */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(['both','hub','gdf'] as const).map(s => (
          <button key={s} onClick={() => setSource(s)} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${source===s?'bg-[#E50914] text-white':'bg-white/5 text-[#6B6B80] hover:text-white'}`}>
            {s==='both'?'🌟 Both':s==='hub'?'☁️ HubCloud':'⚡ GDFliX'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[#6B6B80]">With name & size</span>
          <div onClick={() => setWithMeta(!withMeta)} className={`relative w-9 h-5 rounded-full transition-all cursor-pointer ${withMeta?'bg-[#E50914]':'bg-[#1E1E2A]'}`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${withMeta?'left-4':'left-0.5'}`} />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass rounded-2xl p-4 mb-4">
        <div className="flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key==='Enter'&&search()}
            placeholder="Search filename or title..."
            className="flex-1 bg-[#0A0A0F] border border-[#1E1E2A] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#6B6B80]/50 focus:outline-none focus:border-[#E50914]/40 transition-all" />
          <button onClick={search} disabled={loading} className="bg-[#E50914] hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50">{loading?'...':'🔍'}</button>
        </div>
        {suggestions.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {suggestions.map(s => (
              <button key={s.uid} onClick={() => addToSelected(s)}
                className="w-full text-left px-3 py-2.5 bg-[#0A0A0F] hover:bg-[#E50914]/10 rounded-xl border border-[#1E1E2A] hover:border-[#E50914]/30 transition-all">
                <p className="text-white text-sm font-medium truncate">{s.name}</p>
                <p className="text-[#6B6B80] text-xs">{s.size} • {s.audio}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected files */}
      {selected.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-[#6B6B80] font-semibold uppercase tracking-widest">{selected.length} file(s) selected</p>
            <button onClick={copyAll} className="flex items-center gap-1.5 bg-[#E50914] hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all">
              <Icon.copy /> Copy All
            </button>
          </div>
          {selected.map(item => {
            const links = linkMap[item.uid]
            return (
              <div key={item.uid} className="glass rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-white text-sm font-medium flex-1 truncate">{item.name}</p>
                  <button onClick={() => copySingle(item)} className="shrink-0 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all"><Icon.copy /></button>
                  <button onClick={() => removeSelected(item.uid)} className="shrink-0 text-[#6B6B80] hover:text-red-400 transition-all text-sm">×</button>
                </div>
                {!links ? (
                  <p className="text-[#6B6B80] text-xs">Loading links...</p>
                ) : (
                  <div className="space-y-1.5">
                    {(links.hub as string) && (source==='hub'||source==='both') && (
                      <div className="bg-[#0A0A0F] rounded-lg p-2 flex items-center gap-2">
                        <span className="text-green-400 text-xs shrink-0">☁️</span>
                        <code className="flex-1 text-xs text-green-400 break-all">{links.hub as string}</code>
                      </div>
                    )}
                    {(links.gdf as string) && (source==='gdf'||source==='both') && (
                      <div className="bg-[#0A0A0F] rounded-lg p-2 flex items-center gap-2">
                        <span className="text-blue-400 text-xs shrink-0">⚡</span>
                        <code className="flex-1 text-xs text-blue-400 break-all">{links.gdf as string}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── STATS TAB ─────────────────────────────────────────────────────────────────
function StatsTab({ role }: { role:string }) {
  const [stats, setStats] = useState<Record<string,unknown>|null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [section, setSection] = useState<'stats'|'logs'|'migrate'>('stats')
  const [migrateInfo, setMigrateInfo] = useState<Record<string,number>|null>(null)
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState<string|null>(null)

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats)
    if (role==='owner') fetch('/api/logs').then(r => r.json()).then(d => setLogs(d.logs||[]))
  }, [role])

  async function checkMigrate() { const res = await fetch('/api/migrate-uid'); const d = await res.json(); setMigrateInfo(d) }
  async function runMigrate() {
    setMigrating(true)
    const res = await fetch('/api/migrate-uid',{method:'POST'}); const d = await res.json()
    setMigrateResult(d.ok?`✅ ${d.message}`:`❌ ${d.error}`)
    setMigrating(false); checkMigrate()
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-xl md:text-2xl font-bold text-white mb-5">Statistics</h1>
      {role==='owner' && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {(['stats','logs','migrate'] as const).map(s => (
            <button key={s} onClick={() => { setSection(s); if(s==='migrate') checkMigrate() }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${section===s?'bg-[#E50914] text-white':'bg-white/5 text-[#6B6B80] hover:text-white'}`}>
              {s==='stats'?'📊 Stats':s==='logs'?'📋 Logs':'🔑 UID Migration'}
            </button>
          ))}
        </div>
      )}

      {section==='stats' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([['Total Files',stats.total as number,'📂'],['Total Size',stats.sizeDisplay as string,'💾'],['HubCloud',stats.hubCount as number,'☁️'],['GDFliX',stats.gdfCount as number,'⚡']] as [string,string|number,string][]).map(([l,v,i]) => (
              <div key={l} className="glass rounded-2xl p-4"><p className="text-[#6B6B80] text-xs uppercase tracking-widest">{l}</p><div className="flex items-center justify-between mt-2"><span className="text-white text-2xl font-bold">{v}</span><span className="text-2xl">{i}</span></div></div>
            ))}
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-xs font-semibold text-[#6B6B80] uppercase tracking-widest mb-3">Audio / Language Distribution</p>
            <div className="space-y-2">
              {Object.entries(stats.audioBreakdown as Record<string,number>).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([audio,count]) => (
                <div key={audio}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-white truncate max-w-[70%]">{audio}</span><span className="text-[#6B6B80]">{count}</span></div>
                  <div className="h-1.5 bg-[#1E1E2A] rounded-full"><div className="h-full bg-gradient-to-r from-[#E50914] to-[#FF6B35] rounded-full" style={{width:`${(count/(stats.total as number))*100}%`}} /></div>
                </div>
              ))}
            </div>
          </div>
          {role==='owner' && Object.keys(stats.uploaderBreakdown as Record<string,number>).length > 0 && (
            <div className="glass rounded-2xl p-4">
              <p className="text-xs font-semibold text-[#6B6B80] uppercase tracking-widest mb-3">By Uploader</p>
              {Object.entries(stats.uploaderBreakdown as Record<string,number>).sort((a,b)=>b[1]-a[1]).map(([u,c]) => (
                <div key={u} className="flex items-center justify-between py-1.5 border-b border-[#1E1E2A] last:border-0">
                  <span className="text-white text-sm">👤 {u}</span><span className="text-[#6B6B80] text-sm">{c} files</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section==='logs' && role==='owner' && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="max-h-[60vh] overflow-auto">
            {logs.slice(0,100).map((log,i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-[#1E1E2A] last:border-0">
                <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#E50914] mt-2" />
                <div className="flex-1 min-w-0"><p className="text-white text-sm">{log.action}</p><div className="flex gap-2 mt-0.5"><span className="text-[#6B6B80] text-xs">👤 {log.user}</span><span className="text-[#6B6B80] text-xs">{new Date(log.date).toLocaleString()}</span></div></div>
              </div>
            ))}
            {!logs.length && <p className="text-[#6B6B80] text-center py-8 text-sm">No logs yet</p>}
          </div>
        </div>
      )}

      {section==='migrate' && role==='owner' && (
        <div className="glass rounded-2xl p-5 space-y-4">
          <div><h3 className="text-white font-bold mb-1">🔑 UID Migration Tool</h3><p className="text-[#6B6B80] text-sm">Run once to add UIDs to entries that don&apos;t have them.</p></div>
          {migrateInfo && (
            <div className="grid grid-cols-3 gap-3">
              {([['Total',migrateInfo.total],['Need UID',migrateInfo.needsUid],['Done',migrateInfo.alreadyMigrated]] as [string,number][]).map(([l,v]) => (
                <div key={l} className="bg-[#0A0A0F] rounded-xl p-3 text-center"><p className="text-white font-bold text-xl">{v}</p><p className="text-[#6B6B80] text-xs mt-0.5">{l}</p></div>
              ))}
            </div>
          )}
          {migrateResult && <div className={`px-4 py-3 rounded-xl text-sm ${migrateResult.startsWith('✅')?'bg-green-500/10 text-green-400':'bg-red-500/10 text-red-400'}`}>{migrateResult}</div>}
          <button onClick={runMigrate} disabled={migrating||(migrateInfo?.needsUid===0)}
            className="w-full py-3 bg-[#E50914] hover:bg-red-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-all">
            {migrating?'Running...':migrateInfo?.needsUid===0?'✅ All done':`Run Migration (${migrateInfo?.needsUid??'?'} entries)`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── BIN TAB ───────────────────────────────────────────────────────────────────
function BinTab({ toast, role, username }: { toast:(m:string,t?:Toast['type'])=>void; role:string; username:string }) {
  const [items, setItems] = useState<BinItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try { const res = await fetch('/api/recyclebin'); const d = await res.json(); setItems(d.items||[]) }
    catch { toast('Load failed','error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function restore(uid: string) {
    const res = await fetch('/api/recyclebin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid})})
    if (res.ok) { toast('Restored!','success'); load() }
    else { const d = await res.json(); toast(d.error,'error') }
  }

  async function permDelete(uid: string) {
    if (!confirm('Permanently delete? Cannot undo!')) return
    const res = await fetch('/api/recyclebin',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({uid})})
    if (res.ok) { toast('Permanently deleted','success'); load() }
    else { const d = await res.json(); toast(d.error,'error') }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5 flex items-center justify-between">
        <div><h1 className="text-xl md:text-2xl font-bold text-white">Recycle Bin</h1><p className="text-[#6B6B80] text-sm mt-0.5">{items.length} deleted items</p></div>
        <button onClick={load} className="text-xs bg-white/5 hover:bg-white/10 text-[#6B6B80] hover:text-white px-3 py-2 rounded-xl border border-[#1E1E2A] transition-all">🔄</button>
      </div>
      {loading ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" /></div>
       : !items.length ? <div className="text-center py-16 text-[#6B6B80]"><p className="text-4xl mb-2">🗑️</p><p className="text-sm">Bin is empty</p></div>
       : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.uid} className="glass rounded-xl p-3 md:p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{item.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    <span className="text-[#6B6B80] text-xs">💾 {item.size}</span>
                    <span className="text-[#6B6B80] text-xs">🎵 {item.audio||item.langs||'—'}</span>
                    <span className="text-[#6B6B80] text-xs">👤 {item.uploader_id}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <span className="text-red-400 text-xs">🗑 {new Date(item.deleted_at).toLocaleDateString()}</span>
                    <span className="text-[#6B6B80] text-xs">by {item.deleted_by}</span>
                  </div>
                </div>
                {(role==='owner'||item.uploader_id===username) && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => restore(item.uid)} className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 hover:bg-green-500/20 px-2.5 py-1.5 rounded-lg transition-all"><Icon.restore /> Restore</button>
                    {role==='owner' && <button onClick={() => permDelete(item.uid)} className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg transition-all"><Icon.trash /> Delete</button>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
       )}
    </div>
  )
}
