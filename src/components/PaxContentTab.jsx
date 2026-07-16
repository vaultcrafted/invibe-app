import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS, SHIFTS } from '../lib/constants'

const DEST_COLORS = { pag: '#1E6BF1', corfu: '#059669', zante: '#D97706', gallipoli: '#DC2626', sardegna: '#7C3AED' }
const POI_CAT = ['Alloggi', 'Spiagge', 'Locali', 'Market', 'Ristoranti', 'Farmacia', 'Ospedale', 'Altro']
const CAT_EMOJI = { Alloggi: '🏠', Spiagge: '🏖️', Locali: '🎶', Market: '🛒', Ristoranti: '🍽️', Farmacia: '💊', Ospedale: '🏥', Altro: '📍' }

// Estrae lat/lng da un link Google Maps COMPLETO (non funziona sui link abbreviati maps.app.goo.gl,
// che non contengono le coordinate nel testo del link).
function extractLatLng(url) {
  if (!url) return null
  const pats = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[?&](?:q|ll|destination|center)=(-?\d+\.\d+),(-?\d+\.\d+)/]
  for (const re of pats) { const m = url.match(re); if (m) return [parseFloat(m[1]), parseFloat(m[2])] }
  return null
}

// Risolve QUALSIASI link Maps, anche quelli abbreviati (maps.app.goo.gl/xxxxx): il browser non può
// leggere da solo dove porta un redirect di un altro sito (blocco di sicurezza), quindi passiamo da
// un proxy pubblico che segue il redirect al posto nostro e ci restituisce l'URL finale (con le
// coordinate). Se il link è già completo, extractLatLng lo trova subito senza bisogno del proxy.
async function resolveMapsUrl(url) {
  if (!url) return null
  const direct = extractLatLng(url)
  if (direct) return direct
  try {
    const proxied = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
    const res = await fetch(proxied)
    if (!res.ok) return null
    const data = await res.json()
    const finalUrl = (data && data.status && data.status.url) || ''
    return extractLatLng(finalUrl) || extractLatLng((data && data.contents) || '')
  } catch (e) {
    return null
  }
}

const input = { width: '100%', padding: '11px 13px', borderRadius: 10, border: '0.5px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 14, color: 'var(--text-primary)', outline: 'none' }

function Segmented({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 12, padding: 4, gap: 4 }}>
      {options.map(([id, label]) => {
        const on = value === id
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            flex: 1, padding: '9px 8px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: 'none',
            background: on ? '#fff' : 'transparent', color: on ? 'var(--iv-blue)' : 'var(--text-secondary)',
            boxShadow: on ? '0 1px 3px rgba(0,0,0,.1)' : 'none', transition: 'all .15s'
          }}>{label}</button>
        )
      })}
    </div>
  )
}

function MetaChips({ meta, setMeta, allowedMetas }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {DESTINATIONS.filter(d => !allowedMetas || allowedMetas.includes(d.id)).map(d => {
        const on = meta === d.id, col = DEST_COLORS[d.id]
        return (
          <button key={d.id} onClick={() => setMeta(d.id)} style={{
            padding: '7px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            background: on ? col : 'var(--bg-secondary)', color: on ? '#fff' : 'var(--text-secondary)',
            border: '0.5px solid ' + (on ? col : 'var(--border)')
          }}>{d.flag} {d.name}</button>
        )
      })}
    </div>
  )
}

// Upload PDF con percentuale reale (Supabase non espone il progress: uso XHR diretto)
async function uploadPdfWithProgress(file, path, onProgress) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token || anon
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${url}/storage/v1/object/pax-programmi/${path}`, true)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', anon)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('Content-Type', 'application/pdf')
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('HTTP ' + xhr.status))
    xhr.onerror = () => reject(new Error('rete'))
    xhr.send(file)
  })
}

export default function PaxContentTab({ scope }) {
  const { profile } = useAuth()
  const scopeMetas = scope ? [...new Set(scope.map(s => s.destination))] : null
  const [section, setSection] = useState('programmi')
  const [meta, setMeta] = useState(scopeMetas ? (scopeMetas[0] || 'corfu') : 'corfu')
  const col = DEST_COLORS[meta]
  const metaShifts = scope ? scope.filter(s => s.destination === meta).map(s => s.shift_num) : null

  const autore = profile ? `${profile.nome} ${profile.cognome}` : null
  async function onLog(tipo, azione, extra = {}) {
    try {
      await supabase.from('pax_log').insert({ tipo, azione, destination: extra.destination ?? meta, shift_num: extra.shift_num ?? null, dettaglio: extra.dettaglio ?? null, autore })
    } catch (e) { /* il log non deve mai bloccare un'azione */ }
  }

  return (
    <div style={{ padding: '14px 16px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionNav value={section} onChange={setSection} />
      {section !== 'log' && (
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 2px 8px' }}>Meta</div>
          <MetaChips meta={meta} setMeta={setMeta} allowedMetas={scopeMetas} />
        </div>
      )}
      {section === 'programmi' && <Programmi meta={meta} col={col} onLog={onLog} allowedShifts={metaShifts} />}
      {section === 'poi' && <Poi meta={meta} col={col} onLog={onLog} />}
      {section === 'log' && <LogSection />}
    </div>
  )
}

function SectionNav({ value, onChange }) {
  const items = [
    ['programmi', 'Programmi', 'Cerca il PDF del day by day', (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M14 3v4a1 1 0 0 0 1 1h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M9 13h6M9 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    )],
    ['poi', "Punti d'interesse", 'Alloggi, locali, market, numeri', (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2"/></svg>
    )],
    ['log', 'Log', 'Storico modifiche', (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    )],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
      {items.map(([id, label, sub, icon]) => {
        const on = value === id
        return (
          <button key={id} onClick={() => onChange(id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '15px 8px 13px', borderRadius: 16, cursor: 'pointer', textAlign: 'center',
            background: on ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: on ? '#fff' : 'var(--text-secondary)',
            border: '0.5px solid ' + (on ? 'var(--iv-blue)' : 'var(--border)'),
            boxShadow: on ? '0 6px 18px rgba(30,107,241,0.28)' : 'none', transition: 'all .15s',
          }}>
            {icon}
            <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.1 }}>{label}</div>
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- PROGRAMMI ---------------- */
function Programmi({ meta, col, onLog, allowedShifts }) {
  const allShifts = SHIFTS[meta] || []
  const shifts = allowedShifts ? allShifts.filter(s => allowedShifts.includes(s.num)) : allShifts
  const metaName = DESTINATIONS.find(d => d.id === meta)?.name || ''
  const [turno, setTurno] = useState(shifts[0]?.num || 1)
  const [all, setAll] = useState([])          // tutti i programmi della meta
  const [titolo, setTitolo] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [drag, setDrag] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => { setTurno(shifts[0]?.num || 1) }, [meta])
  useEffect(() => { loadAll() }, [meta])
  useEffect(() => { const r = all.find(x => x.shift_num === turno); setTitolo(r?.titolo || ''); setMsg(null) }, [turno, all])

  async function loadAll() {
    const { data } = await supabase.from('pax_programmi').select('*').eq('destination', meta)
    setAll(data || [])
  }
  const row = all.find(x => x.shift_num === turno) || null
  const hasPdf = (n) => all.some(x => x.shift_num === n && x.pdf_path)
  const done = shifts.filter(s => hasPdf(s.num)).length
  const pdfUrl = row?.pdf_path ? supabase.storage.from('pax-programmi').getPublicUrl(row.pdf_path).data.publicUrl : null

  async function handleFile(file) {
    if (!file) return
    if (file.type !== 'application/pdf') { setMsg({ t: 'err', m: 'Serve un file PDF.' }); return }
    const wasThere = !!row?.pdf_path
    setBusy(true); setProgress(0); setMsg(null)
    const path = `${meta}/${meta}-${turno}.pdf`
    try {
      await uploadPdfWithProgress(file, path, pct => setProgress(pct))
    } catch (e) {
      setBusy(false); setProgress(0); setMsg({ t: 'err', m: 'Upload fallito: ' + e.message }); return
    }
    const { error: dbErr } = await supabase.from('pax_programmi')
      .upsert({ destination: meta, shift_num: turno, titolo: titolo || null, pdf_path: path, updated_at: new Date().toISOString() }, { onConflict: 'destination,shift_num' })
    setBusy(false); setProgress(0)
    if (dbErr) { setMsg({ t: 'err', m: 'Salvataggio fallito: ' + dbErr.message }); return }
    setMsg({ t: 'ok', m: 'Programma caricato ✓' }); loadAll()
    onLog?.('programma', wasThere ? 'sostituito' : 'caricato', { destination: meta, shift_num: turno, dettaglio: `${metaName} ${turno}` })
  }
  async function saveTitolo() { if (row) { await supabase.from('pax_programmi').update({ titolo: titolo || null }).eq('id', row.id); loadAll() } }
  async function remove() {
    if (!row) return
    if (row.pdf_path) await supabase.storage.from('pax-programmi').remove([row.pdf_path])
    await supabase.from('pax_programmi').delete().eq('id', row.id)
    setMsg(null); loadAll()
    onLog?.('programma', 'rimosso', { destination: meta, shift_num: turno, dettaglio: `${metaName} ${turno}` })
  }

  return (
    <>
      {/* progresso meta */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
        <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
          <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="22" cy="22" r="18" fill="none" stroke="var(--bg-tertiary)" strokeWidth="5" />
            <circle cx="22" cy="22" r="18" fill="none" stroke={col} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 18} strokeDashoffset={2 * Math.PI * 18 * (1 - done / shifts.length)} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: col }}>{done}/{shifts.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Programmi caricati</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{done === shifts.length ? 'Tutti i turni completi 🎉' : `${shifts.length - done} turni ancora da caricare`}</div>
        </div>
      </div>

      {/* turni: griglia con stato caricato/mancante */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {shifts.map(s => {
          const on = turno === s.num, ok = hasPdf(s.num)
          return (
            <button key={s.num} onClick={() => setTurno(s.num)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, padding: '11px 12px', borderRadius: 13, cursor: 'pointer', textAlign: 'left',
              background: on ? col : 'var(--bg-secondary)', color: on ? '#fff' : 'var(--text-primary)',
              border: '1px solid ' + (on ? col : (ok ? 'var(--success)' : 'var(--border)')),
              boxShadow: on ? `0 5px 14px ${col}44` : 'none', transition: 'all .15s',
            }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{metaName} {s.num}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? (on ? '#fff' : 'var(--success)') : (on ? 'rgba(255,255,255,.5)' : 'var(--border-mid)') }} />
                <span style={{ color: on ? 'rgba(255,255,255,.9)' : (ok ? 'var(--success)' : 'var(--text-tertiary)') }}>{ok ? 'Caricato' : 'Mancante'}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* card upload */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{metaName} {turno}</div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: pdfUrl ? 'var(--success-light)' : 'var(--bg-tertiary)', color: pdfUrl ? 'var(--success)' : 'var(--text-tertiary)' }}>
            {pdfUrl ? '● Caricato' : '○ Da caricare'}
          </span>
        </div>

        <input style={{ ...input, marginBottom: 12 }} placeholder="Titolo (opzionale, es. Day by Day Corfù 1)" value={titolo} onChange={e => setTitolo(e.target.value)} onBlur={saveTitolo} />

        <div
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}
          onClick={() => !busy && fileRef.current?.click()}
          style={{
            border: '2px dashed ' + (drag ? col : 'var(--border-mid)'), borderRadius: 14, padding: '26px 16px', textAlign: 'center',
            background: drag ? col + '0f' : 'var(--bg-secondary)', cursor: busy ? 'wait' : 'pointer', transition: 'all .15s'
          }}>
          <div style={{ fontSize: 30, marginBottom: 6 }}>{busy ? '⏳' : '📄'}</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
            {busy ? `Carico… ${progress}%` : (pdfUrl ? 'Sostituisci il PDF' : 'Trascina il PDF o tocca per scegliere')}
          </div>
          {busy
            ? <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-tertiary)', overflow: 'hidden', marginTop: 10, maxWidth: 240, marginLeft: 'auto', marginRight: 'auto' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: col, borderRadius: 999, transition: 'width .15s' }} />
              </div>
            : <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>Solo file PDF</div>}
          <input ref={fileRef} type="file" accept="application/pdf" onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }} disabled={busy} style={{ display: 'none' }} />
        </div>

        {pdfUrl && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: col }}>👁 Anteprima PDF</a>
            <button onClick={remove} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Rimuovi</button>
          </div>
        )}
        {msg && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: msg.t === 'ok' ? 'var(--success)' : 'var(--danger)' }}>{msg.m}</div>}
      </div>
    </>
  )
}

/* ---------------- POI ---------------- */
function Poi({ meta, col, onLog }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const empty = { categoria: 'Spiagge', nome: '', descrizione: '', maps_url: '', lat: '', lng: '', telefono: '', foto: [] }
  const [form, setForm] = useState(empty)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editId, setEditId] = useState(null)
  const [resolvingForm, setResolvingForm] = useState(false)
  const [bulkResolving, setBulkResolving] = useState(null) // { done, total, falliti }

  useEffect(() => { load() }, [meta])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('pax_poi').select('*').eq('destination', meta).order('ordine', { ascending: true })
    setList(data || []); setLoading(false)
  }
  function startEdit(p) {
    setForm({ categoria: p.categoria, nome: p.nome || '', descrizione: p.descrizione || '', maps_url: p.maps_url || '', lat: p.lat != null ? String(p.lat) : '', lng: p.lng != null ? String(p.lng) : '', telefono: p.telefono || '', foto: Array.isArray(p.foto) ? p.foto : [] })
    setEditId(p.id); setOpen(true)
  }
  function cancelForm() { setForm(empty); setEditId(null); setOpen(false) }

  async function uploadFotos(files) {
    if (!files || !files.length) return
    setUploading(true)
    const added = []
    for (const file of Array.from(files)) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${meta}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage.from('poi-foto').upload(path, file, { upsert: false, contentType: file.type })
      if (!error) added.push(path)
    }
    setForm(f => ({ ...f, foto: [...(f.foto || []), ...added] }))
    setUploading(false)
  }
  async function removeFoto(path) {
    setForm(f => ({ ...f, foto: (f.foto || []).filter(x => x !== path) }))
    supabase.storage.from('poi-foto').remove([path])
  }
  const fotoUrl = (path) => supabase.storage.from('poi-foto').getPublicUrl(path).data.publicUrl
  async function save() {
    if (!form.nome.trim()) return
    setBusy(true)
    const lat = form.lat !== '' ? parseFloat(String(form.lat).replace(',', '.')) : null
    const lng = form.lng !== '' ? parseFloat(String(form.lng).replace(',', '.')) : null
    const payload = { categoria: form.categoria, nome: form.nome.trim(), descrizione: form.descrizione || null, maps_url: form.maps_url || null, lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null, telefono: form.telefono || null, foto: form.foto || [] }
    if (editId) {
      await supabase.from('pax_poi').update(payload).eq('id', editId)
      onLog?.('poi', 'modificato', { destination: meta, dettaglio: `${form.categoria} · ${form.nome.trim()}` })
    } else {
      await supabase.from('pax_poi').insert({ destination: meta, ...payload, ordine: list.length, attivo: true })
      onLog?.('poi', 'aggiunto', { destination: meta, dettaglio: `${form.categoria} · ${form.nome.trim()}` })
    }
    setBusy(false); cancelForm(); load()
  }
  async function del(id) {
    const p = list.find(x => x.id === id)
    await supabase.from('pax_poi').delete().eq('id', id)
    onLog?.('poi', 'rimosso', { destination: meta, dettaglio: p?.nome }); load()
  }
  async function toggle(p) {
    await supabase.from('pax_poi').update({ attivo: !p.attivo }).eq('id', p.id)
    onLog?.('poi', 'modificato', { destination: meta, dettaglio: `${p.nome} → ${!p.attivo ? 'visibile' : 'nascosto'}` }); load()
  }

  // Risolve in blocco la posizione di TUTTI i punti di questa meta che hanno un link Maps
  // ma nessuna coordinata (anche i link abbreviati) — un click al posto di farlo uno per uno.
  const daRisolvere = list.filter(p => p.maps_url && (p.lat == null || p.lng == null))
  async function bulkResolveMissing() {
    const targets = daRisolvere
    if (targets.length === 0) return
    setBulkResolving({ done: 0, total: targets.length, falliti: 0 })
    let falliti = 0
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i]
      const coords = await resolveMapsUrl(p.maps_url)
      if (coords) {
        await supabase.from('pax_poi').update({ lat: coords[0], lng: coords[1] }).eq('id', p.id)
      } else {
        falliti++
      }
      setBulkResolving({ done: i + 1, total: targets.length, falliti })
      await new Promise(r => setTimeout(r, 350)) // non bombardo il servizio di risoluzione
    }
    onLog?.('poi', 'modificato', { destination: meta, dettaglio: `Posizioni risolte in blocco: ${targets.length - falliti}/${targets.length}` })
    load()
    setTimeout(() => setBulkResolving(null), 5000)
  }

  const formCard = (
        <div className="card" style={{ border: '1px solid ' + col }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{editId ? 'Modifica punto' : "Nuovo punto d'interesse"}</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
            {POI_CAT.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, categoria: c }))} style={{
                padding: '6px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: form.categoria === c ? col : 'var(--bg-secondary)', color: form.categoria === c ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (form.categoria === c ? col : 'var(--border)')
              }}>{CAT_EMOJI[c]} {c}</button>
            ))}
          </div>
          <input style={{ ...input, marginBottom: 8 }} placeholder="Nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          <input style={{ ...input, marginBottom: 8 }} placeholder="Descrizione breve" value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
            <div style={{ position: 'relative' }}>
              <input style={input} placeholder="Link Google Maps" value={form.maps_url} onChange={e => {
                const url = e.target.value
                setForm(f => ({ ...f, maps_url: url }))
              }} onBlur={async e => {
                const url = e.target.value
                if (!url || (form.lat && form.lng)) return
                setResolvingForm(true)
                const coords = await resolveMapsUrl(url)
                setResolvingForm(false)
                if (coords) setForm(f => (f.maps_url === url ? { ...f, lat: String(coords[0]), lng: String(coords[1]) } : f))
              }} />
              {resolvingForm && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10.5, color: 'var(--text-tertiary)' }}>risolvo...</span>}
            </div>
            <input style={input} placeholder="Telefono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
            <input style={input} placeholder="Latitudine (es. 39.6243)" value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
            <input style={input} placeholder="Longitudine (es. 19.9217)" value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.4 }}>
            Incolla il link Maps (anche abbreviato): l'app prova a trovare da sola le coordinate quando esci dal campo. Se non ci riesce, inseriscile a mano — apri il punto su Google Maps, tieni premuto sul locale, in basso compaiono le coordinate, tocca per copiarle.
          </div>

          {/* Foto (galleria) */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 7, color: 'var(--text-secondary)' }}>Foto {form.foto?.length ? `(${form.foto.length})` : ''}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(form.foto || []).map(path => (
                <div key={path} style={{ position: 'relative', width: 76, height: 76, borderRadius: 10, overflow: 'hidden', border: '0.5px solid var(--border)' }}>
                  <img src={fotoUrl(path)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button onClick={() => removeFoto(path)} style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
              <label style={{ width: 76, height: 76, borderRadius: 10, border: '1px dashed var(--border-mid)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 11, background: 'var(--bg-secondary)' }}>
                {uploading ? '…' : <><span style={{ fontSize: 20, lineHeight: 1 }}>＋</span>Foto</>}
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { uploadFotos(e.target.files); e.target.value = '' }} />
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={save} disabled={busy || !form.nome.trim()} style={{ opacity: busy || !form.nome.trim() ? 0.6 : 1 }}>Salva</button>
            <button onClick={cancelForm} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: 10, padding: '0 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Annulla</button>
          </div>
        </div>
  )

  return (
    <>
      {!open && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
          <button className="btn-primary" onClick={() => { setForm(empty); setEditId(null); setOpen(true) }} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7 }}>＋ Aggiungi punto</button>
          {daRisolvere.length > 0 && !bulkResolving && (
            <button onClick={bulkResolveMissing} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--bg-secondary)', color: col, border: '0.5px solid ' + col }}>
              📍 Trova posizione automatica ({daRisolvere.length} mancanti)
            </button>
          )}
        </div>
      )}
      {bulkResolving && (
        <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '10px 13px', marginBottom: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {bulkResolving.done < bulkResolving.total
            ? `Risolvo le posizioni... ${bulkResolving.done}/${bulkResolving.total}`
            : `Fatto: ${bulkResolving.total - bulkResolving.falliti}/${bulkResolving.total} risolti automaticamente${bulkResolving.falliti > 0 ? ` — ${bulkResolving.falliti} da inserire a mano (link non risolvibile)` : ''}`}
          <div style={{ height: 4, borderRadius: 4, background: 'var(--border)', marginTop: 7, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(bulkResolving.done / bulkResolving.total) * 100}%`, background: col, transition: 'width .2s' }} />
          </div>
        </div>
      )}

      {open && !editId && formCard}

      {loading ? <div className="spinner" style={{ margin: '20px auto' }} /> : list.length === 0
        ? <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 20 }}>Nessun punto per questa meta.</div>
        : list.map(p => (
          <div key={p.id}>
          <div className="card" style={{ opacity: p.attivo ? 1 : 0.55, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{CAT_EMOJI[p.categoria] || '📍'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.categoria}</div>
                <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {p.nome}
                  {(p.lat == null || p.lng == null) && (
                    <span title="Nessuna posizione: non comparirà come pin sulla mappa dei pax" style={{ fontSize: 9.5, fontWeight: 700, color: '#B45309', background: '#FEF3C7', border: '0.5px solid #FDE68A', padding: '1px 6px', borderRadius: 999 }}>senza posizione</span>
                  )}
                </div>
                {p.descrizione && <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descrizione}</div>}
              </div>
              <button onClick={() => startEdit(p)} title="Modifica" style={{ background: 'none', border: 'none', color: col, cursor: 'pointer', flexShrink: 0, padding: 4, display: 'flex' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={() => toggle(p)} title={p.attivo ? 'Visibile' : 'Nascosto'} style={{ width: 40, height: 23, borderRadius: 20, border: 'none', cursor: 'pointer', background: p.attivo ? 'var(--success)' : 'var(--border-mid)', position: 'relative', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 2.5, left: p.attivo ? 20 : 2.5, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
              </button>
              <button onClick={() => del(p.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 20, flexShrink: 0 }}>×</button>
            </div>
          </div>
          {open && editId === p.id && <div style={{ marginTop: 8 }}>{formCard}</div>}
          </div>
        ))}
    </>
  )
}

/* ---------------- NUMERI ---------------- */
function Numeri({ meta, col, onLog }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ etichetta: '', numero: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [meta])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('pax_numeri').select('*').eq('destination', meta).order('ordine', { ascending: true })
    setList(data || []); setLoading(false)
  }
  async function add() {
    if (!form.etichetta.trim() || !form.numero.trim()) return
    setBusy(true)
    await supabase.from('pax_numeri').insert({ destination: meta, etichetta: form.etichetta.trim(), numero: form.numero.trim(), ordine: list.length, attivo: true })
    setBusy(false); onLog?.('numero', 'aggiunto', { destination: meta, dettaglio: `${form.etichetta.trim()} · ${form.numero.trim()}` }); setForm({ etichetta: '', numero: '' }); load()
  }
  async function del(id) {
    const n = list.find(x => x.id === id)
    await supabase.from('pax_numeri').delete().eq('id', id)
    onLog?.('numero', 'rimosso', { destination: meta, dettaglio: n?.etichetta }); load()
  }
  async function toggle(n) {
    await supabase.from('pax_numeri').update({ attivo: !n.attivo }).eq('id', n.id)
    onLog?.('numero', 'modificato', { destination: meta, dettaglio: `${n.etichetta} → ${!n.attivo ? 'visibile' : 'nascosto'}` }); load()
  }

  return (
    <>
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Nuovo numero utile</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <input style={input} placeholder="Etichetta (es. Taxi)" value={form.etichetta} onChange={e => setForm(f => ({ ...f, etichetta: e.target.value }))} />
          <input style={input} placeholder="Numero" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
        </div>
        <button className="btn-primary" onClick={add} disabled={busy || !form.etichetta.trim() || !form.numero.trim()} style={{ opacity: busy || !form.etichetta.trim() || !form.numero.trim() ? 0.6 : 1 }}>Aggiungi</button>
      </div>

      {loading ? <div className="spinner" style={{ margin: '20px auto' }} /> : list.length === 0
        ? <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 20 }}>Nessun numero per questa meta.</div>
        : list.map(n => (
          <div key={n.id} className="card" style={{ opacity: n.attivo ? 1 : 0.55, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📞</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{n.etichetta}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{n.numero}</div>
              </div>
              <button onClick={() => toggle(n)} title={n.attivo ? 'Visibile' : 'Nascosto'} style={{ width: 40, height: 23, borderRadius: 20, border: 'none', cursor: 'pointer', background: n.attivo ? 'var(--success)' : 'var(--border-mid)', position: 'relative', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 2.5, left: n.attivo ? 20 : 2.5, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
              </button>
              <button onClick={() => del(n.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 20, flexShrink: 0 }}>×</button>
            </div>
          </div>
        ))}
    </>
  )
}

/* ---------------- LOG (tempo reale) ---------------- */
const AZIONE_STYLE = {
  caricato: { bg: 'var(--success-light)', c: 'var(--success)', e: '⬆️' },
  sostituito: { bg: '#FEF3C7', c: '#92400E', e: '🔄' },
  rimosso: { bg: 'var(--danger-light)', c: 'var(--danger)', e: '🗑️' },
  aggiunto: { bg: 'var(--success-light)', c: 'var(--success)', e: '＋' },
  modificato: { bg: '#DBEAFE', c: '#1E40AF', e: '✏️' },
}
const TIPO_LABEL = { programma: 'Programma', poi: 'Punto', numero: 'Numero' }

function fmtTime(ts) {
  const d = new Date(ts)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const hm = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return 'oggi ' + hm
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) + ' ' + hm
}

function LogSection() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.from('pax_log').select('*').order('ts', { ascending: false }).limit(150)
      .then(({ data }) => { if (alive) { setRows(data || []); setLoading(false) } })

    const ch = supabase.channel('pax_log_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pax_log' }, payload => {
        setRows(prev => [payload.new, ...prev].slice(0, 200))
      })
      .subscribe(status => { if (status === 'SUBSCRIBED') setLive(true) })

    return () => { alive = false; supabase.removeChannel(ch) }
  }, [])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: live ? 'var(--success)' : 'var(--text-tertiary)', animation: live ? 'pulse 1.2s infinite' : 'none' }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{live ? 'In ascolto in tempo reale' : 'Connessione…'}</span>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
      </div>

      {loading ? <div className="spinner" style={{ margin: '20px auto' }} />
        : rows.length === 0 ? <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 20 }}>Nessuna modifica registrata.</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map(r => {
              const a = AZIONE_STYLE[r.azione] || { bg: 'var(--bg-tertiary)', c: 'var(--text-secondary)', e: '•' }
              const dest = DESTINATIONS.find(d => d.id === r.destination)
              return (
                <div key={r.id} className="card" style={{ padding: '11px 13px', margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: a.bg, color: a.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{a.e}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                        {TIPO_LABEL[r.tipo] || r.tipo} <span style={{ color: a.c }}>{r.azione}</span>
                        {dest && <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}> · {dest.flag} {dest.name}</span>}
                      </div>
                      {r.dettaglio && <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.dettaglio}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtTime(r.ts)}</div>
                      {r.autore && <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{r.autore}</div>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </>
  )
}
