import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS } from '../lib/constants'

const DEST_COLORS = { pag: '#1E6BF1', corfu: '#059669', zante: '#D97706', gallipoli: '#DC2626', sardegna: '#7C3AED' }
const POI_CAT = ['Spiagge', 'Locali', 'Market', 'Ristoranti', 'Farmacia', 'Ospedale', 'Altro']
const CAT_EMOJI = { Spiagge: '🏖️', Locali: '🎶', Market: '🛒', Ristoranti: '🍽️', Farmacia: '💊', Ospedale: '🏥', Altro: '📍' }

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

function MetaChips({ meta, setMeta }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {DESTINATIONS.map(d => {
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

export default function PaxContentTab() {
  const [section, setSection] = useState('programmi')
  const [meta, setMeta] = useState('corfu')
  const col = DEST_COLORS[meta]

  return (
    <div style={{ padding: '14px 16px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Segmented value={section} onChange={setSection} options={[['programmi', 'Programmi'], ['poi', "Punti d'interesse"], ['numeri', 'Numeri']]} />
      <MetaChips meta={meta} setMeta={setMeta} />
      {section === 'programmi' && <Programmi meta={meta} col={col} />}
      {section === 'poi' && <Poi meta={meta} col={col} />}
      {section === 'numeri' && <Numeri meta={meta} col={col} />}
    </div>
  )
}

/* ---------------- PROGRAMMI ---------------- */
function Programmi({ meta, col }) {
  const shifts = SHIFTS[meta] || []
  const [turno, setTurno] = useState(shifts[0]?.num || 1)
  const [all, setAll] = useState([])          // tutti i programmi della meta
  const [titolo, setTitolo] = useState('')
  const [busy, setBusy] = useState(false)
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
    setBusy(true); setMsg(null)
    const path = `${meta}/${meta}-${turno}.pdf`
    const { error: upErr } = await supabase.storage.from('pax-programmi').upload(path, file, { upsert: true, contentType: 'application/pdf' })
    if (upErr) { setBusy(false); setMsg({ t: 'err', m: 'Upload fallito: ' + upErr.message }); return }
    const { error: dbErr } = await supabase.from('pax_programmi')
      .upsert({ destination: meta, shift_num: turno, titolo: titolo || null, pdf_path: path, updated_at: new Date().toISOString() }, { onConflict: 'destination,shift_num' })
    setBusy(false)
    if (dbErr) { setMsg({ t: 'err', m: 'Salvataggio fallito: ' + dbErr.message }); return }
    setMsg({ t: 'ok', m: 'Programma caricato ✓' }); loadAll()
  }
  async function saveTitolo() { if (row) { await supabase.from('pax_programmi').update({ titolo: titolo || null }).eq('id', row.id); loadAll() } }
  async function remove() {
    if (!row) return
    if (row.pdf_path) await supabase.storage.from('pax-programmi').remove([row.pdf_path])
    await supabase.from('pax_programmi').delete().eq('id', row.id)
    setMsg(null); loadAll()
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

      {/* turni con pallino di stato */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {shifts.map(s => {
          const on = turno === s.num, ok = hasPdf(s.num)
          return (
            <button key={s.num} onClick={() => setTurno(s.num)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              background: on ? col : 'var(--bg-secondary)', color: on ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (on ? col : 'var(--border)')
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: ok ? (on ? '#fff' : 'var(--success)') : (on ? 'rgba(255,255,255,.4)' : 'var(--border-mid)') }} />
              T{s.num} · {s.label}
            </button>
          )
        })}
      </div>

      {/* card upload */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Turno {turno} · {shifts.find(s => s.num === turno)?.label}</div>
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
            {busy ? 'Carico…' : (pdfUrl ? 'Sostituisci il PDF' : 'Trascina il PDF o tocca per scegliere')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>Solo file PDF</div>
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
function Poi({ meta, col }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const empty = { categoria: 'Spiagge', nome: '', descrizione: '', maps_url: '', telefono: '' }
  const [form, setForm] = useState(empty)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [meta])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('pax_poi').select('*').eq('destination', meta).order('ordine', { ascending: true })
    setList(data || []); setLoading(false)
  }
  async function add() {
    if (!form.nome.trim()) return
    setBusy(true)
    await supabase.from('pax_poi').insert({ destination: meta, categoria: form.categoria, nome: form.nome.trim(), descrizione: form.descrizione || null, maps_url: form.maps_url || null, telefono: form.telefono || null, ordine: list.length, attivo: true })
    setBusy(false); setForm(empty); setOpen(false); load()
  }
  async function del(id) { await supabase.from('pax_poi').delete().eq('id', id); load() }
  async function toggle(p) { await supabase.from('pax_poi').update({ attivo: !p.attivo }).eq('id', p.id); load() }

  return (
    <>
      {!open && (
        <button className="btn-primary" onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7 }}>＋ Aggiungi punto</button>
      )}

      {open && (
        <div className="card" style={{ border: '1px solid ' + col }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Nuovo punto d'interesse</div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <input style={input} placeholder="Link Google Maps" value={form.maps_url} onChange={e => setForm(f => ({ ...f, maps_url: e.target.value }))} />
            <input style={input} placeholder="Telefono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={add} disabled={busy || !form.nome.trim()} style={{ opacity: busy || !form.nome.trim() ? 0.6 : 1 }}>Salva</button>
            <button onClick={() => { setOpen(false); setForm(empty) }} style={{ background: 'var(--bg-tertiary)', border: 'none', borderRadius: 10, padding: '0 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>Annulla</button>
          </div>
        </div>
      )}

      {loading ? <div className="spinner" style={{ margin: '20px auto' }} /> : list.length === 0
        ? <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 20 }}>Nessun punto per questa meta.</div>
        : list.map(p => (
          <div key={p.id} className="card" style={{ opacity: p.attivo ? 1 : 0.55, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{CAT_EMOJI[p.categoria] || '📍'}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.categoria}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.nome}</div>
                {p.descrizione && <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descrizione}</div>}
              </div>
              <button onClick={() => toggle(p)} title={p.attivo ? 'Visibile' : 'Nascosto'} style={{ width: 40, height: 23, borderRadius: 20, border: 'none', cursor: 'pointer', background: p.attivo ? 'var(--success)' : 'var(--border-mid)', position: 'relative', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 2.5, left: p.attivo ? 20 : 2.5, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
              </button>
              <button onClick={() => del(p.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 20, flexShrink: 0 }}>×</button>
            </div>
          </div>
        ))}
    </>
  )
}

/* ---------------- NUMERI ---------------- */
function Numeri({ meta, col }) {
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
    setBusy(false); setForm({ etichetta: '', numero: '' }); load()
  }
  async function del(id) { await supabase.from('pax_numeri').delete().eq('id', id); load() }
  async function toggle(n) { await supabase.from('pax_numeri').update({ attivo: !n.attivo }).eq('id', n.id); load() }

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
