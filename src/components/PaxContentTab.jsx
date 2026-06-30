import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS } from '../lib/constants'

const DEST_COLORS = { pag: '#1E6BF1', corfu: '#059669', zante: '#D97706', gallipoli: '#DC2626', sardegna: '#7C3AED' }
const POI_CAT = ['Spiagge', 'Locali', 'Market', 'Ristoranti', 'Farmacia', 'Ospedale', 'Altro']

const input = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 14, color: 'var(--text-primary)', outline: 'none' }
const chip = (on, col) => ({ padding: '6px 13px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: on ? col : 'var(--bg-secondary)', color: on ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (on ? col : 'var(--border)') })

export default function PaxContentTab() {
  const [section, setSection] = useState('programmi')
  const [meta, setMeta] = useState('corfu')
  const col = DEST_COLORS[meta]

  return (
    <div style={{ padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {[['programmi', 'Programmi'], ['poi', 'Punti d\'interesse'], ['numeri', 'Numeri']].map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)} style={chip(section === id, 'var(--iv-blue)')}>{label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {DESTINATIONS.map(d => (
          <button key={d.id} onClick={() => setMeta(d.id)} style={chip(meta === d.id, DEST_COLORS[d.id])}>{d.flag} {d.name}</button>
        ))}
      </div>

      {section === 'programmi' && <Programmi meta={meta} col={col} />}
      {section === 'poi' && <Poi meta={meta} col={col} />}
      {section === 'numeri' && <Numeri meta={meta} col={col} />}
    </div>
  )
}

/* ---------------- PROGRAMMI (PDF per meta+turno) ---------------- */
function Programmi({ meta, col }) {
  const shifts = SHIFTS[meta] || []
  const [turno, setTurno] = useState(shifts[0]?.num || 1)
  const [row, setRow] = useState(null)
  const [titolo, setTitolo] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { setTurno(shifts[0]?.num || 1) }, [meta])
  useEffect(() => { load() }, [meta, turno])

  async function load() {
    setMsg(null)
    const { data } = await supabase.from('pax_programmi').select('*').eq('destination', meta).eq('shift_num', turno).maybeSingle()
    setRow(data || null); setTitolo(data?.titolo || '')
  }

  const pdfUrl = row?.pdf_path ? supabase.storage.from('pax-programmi').getPublicUrl(row.pdf_path).data.publicUrl : null

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { setMsg({ t: 'err', m: 'Carica un file PDF.' }); return }
    setBusy(true); setMsg(null)
    const path = `${meta}/${meta}-${turno}.pdf`
    const { error: upErr } = await supabase.storage.from('pax-programmi').upload(path, file, { upsert: true, contentType: 'application/pdf' })
    if (upErr) { setBusy(false); setMsg({ t: 'err', m: 'Upload fallito: ' + upErr.message }); return }
    const { error: dbErr } = await supabase.from('pax_programmi')
      .upsert({ destination: meta, shift_num: turno, titolo: titolo || null, pdf_path: path, updated_at: new Date().toISOString() }, { onConflict: 'destination,shift_num' })
    setBusy(false)
    if (dbErr) { setMsg({ t: 'err', m: 'Salvataggio fallito: ' + dbErr.message }); return }
    setMsg({ t: 'ok', m: 'Programma caricato ✓' })
    e.target.value = ''
    load()
  }

  async function saveTitolo() {
    if (!row) return
    await supabase.from('pax_programmi').update({ titolo: titolo || null }).eq('id', row.id)
    setMsg({ t: 'ok', m: 'Titolo salvato ✓' }); load()
  }

  async function remove() {
    if (!row) return
    if (row.pdf_path) await supabase.storage.from('pax-programmi').remove([row.pdf_path])
    await supabase.from('pax_programmi').delete().eq('id', row.id)
    setMsg({ t: 'ok', m: 'Programma rimosso.' }); load()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {shifts.map(s => (
          <button key={s.num} onClick={() => setTurno(s.num)} style={chip(turno === s.num, col)}>T{s.num}</button>
        ))}
      </div>

      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Programma — turno {turno}</div>
        {pdfUrl
          ? <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>PDF attuale: <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ color: col, fontWeight: 600 }}>apri</a></div>
          : <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 12 }}>Nessun PDF caricato per questo turno.</div>}

        <input style={{ ...input, marginBottom: 10 }} placeholder="Titolo (opzionale, es. Day by Day Corfù 1)" value={titolo} onChange={e => setTitolo(e.target.value)} onBlur={saveTitolo} />

        <label className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Carico…' : (pdfUrl ? 'Sostituisci PDF' : 'Carica PDF')}
          <input type="file" accept="application/pdf" onChange={onFile} disabled={busy} style={{ display: 'none' }} />
        </label>
        {pdfUrl && <button onClick={remove} style={{ marginLeft: 10, background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Rimuovi</button>}

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
    setBusy(false); setForm(empty); load()
  }
  async function del(id) { await supabase.from('pax_poi').delete().eq('id', id); load() }
  async function toggle(p) { await supabase.from('pax_poi').update({ attivo: !p.attivo }).eq('id', p.id); load() }

  return (
    <>
      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Nuovo punto d'interesse</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <select style={input} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
            {POI_CAT.map(c => <option key={c}>{c}</option>)}
          </select>
          <input style={input} placeholder="Nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
        </div>
        <input style={{ ...input, marginBottom: 8 }} placeholder="Descrizione breve" value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <input style={input} placeholder="Link Google Maps" value={form.maps_url} onChange={e => setForm(f => ({ ...f, maps_url: e.target.value }))} />
          <input style={input} placeholder="Telefono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
        </div>
        <button className="btn-primary" onClick={add} disabled={busy || !form.nome.trim()} style={{ opacity: busy || !form.nome.trim() ? 0.6 : 1 }}>Aggiungi</button>
      </div>

      {loading ? <div className="spinner" style={{ margin: '20px auto' }} /> : list.length === 0
        ? <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 16 }}>Nessun punto per questa meta.</div>
        : list.map(p => (
          <div key={p.id} className="card" style={{ opacity: p.attivo ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.categoria}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.nome}</div>
                {p.descrizione && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.descrizione}</div>}
              </div>
              <button onClick={() => toggle(p)} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: p.attivo ? 'var(--success)' : 'var(--text-tertiary)', cursor: 'pointer' }}>{p.attivo ? 'Visibile' : 'Nascosto'}</button>
              <button onClick={() => del(p.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18 }}>×</button>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <input style={input} placeholder="Etichetta (es. Taxi)" value={form.etichetta} onChange={e => setForm(f => ({ ...f, etichetta: e.target.value }))} />
          <input style={input} placeholder="Numero" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
        </div>
        <button className="btn-primary" onClick={add} disabled={busy || !form.etichetta.trim() || !form.numero.trim()} style={{ opacity: busy || !form.etichetta.trim() || !form.numero.trim() ? 0.6 : 1 }}>Aggiungi</button>
      </div>

      {loading ? <div className="spinner" style={{ margin: '20px auto' }} /> : list.length === 0
        ? <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 16 }}>Nessun numero per questa meta.</div>
        : list.map(n => (
          <div key={n.id} className="card" style={{ opacity: n.attivo ? 1 : 0.5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{n.etichetta}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{n.numero}</div>
              </div>
              <button onClick={() => toggle(n)} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: n.attivo ? 'var(--success)' : 'var(--text-tertiary)', cursor: 'pointer' }}>{n.attivo ? 'Visibile' : 'Nascosto'}</button>
              <button onClick={() => del(n.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
          </div>
        ))}
    </>
  )
}
