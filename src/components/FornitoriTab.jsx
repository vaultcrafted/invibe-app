import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import { Plus, X, Check, Trash2, AlertTriangle, Pencil } from 'lucide-react'

const fmtEur = (n) => '€ ' + Math.round(n || 0).toLocaleString('it-IT')
const fmtData = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '—'
const oggiISO = () => new Date().toISOString().slice(0, 10)

export default function FornitoriTab() {
  const [fornitori, setFornitori] = useState([])
  const [saldi, setSaldi] = useState([]) // righe da get_cassa_saldi(): {destination, shift_num, saldo, ...}
  const [loading, setLoading] = useState(true)
  const [filterDest, setFilterDest] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm())

  function blankForm() {
    return { nome: '', destination: '', shift_num: '', importo: '', data_prevista: oggiISO(), note: '', gratis: false }
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: f }, { data: s }] = await Promise.all([
      supabase.from('fornitori_pagamenti').select('*').order('data_prevista', { ascending: true, nullsFirst: false }),
      supabase.rpc('get_cassa_saldi'),
    ])
    setFornitori(f || [])
    setSaldi(s || [])
    setLoading(false)
  }

  // Saldo cassa REALE attuale (calcolato dal database, mai sbagliato per limiti di righe),
  // per una meta (tutte le sue righe/turni sommate) o per tutte le mete insieme.
  function saldoReale(dest) {
    return saldi
      .filter(r => !dest || r.destination === dest)
      .reduce((t, r) => t + Number(r.saldo || 0), 0)
  }

  async function salvaFornitore(e) {
    e.preventDefault()
    if (!form.nome.trim() || !form.importo) return
    const payload = {
      nome: form.nome.trim(),
      destination: form.destination || null,
      shift_num: form.shift_num ? Number(form.shift_num) : null,
      importo: Number(form.importo) || 0,
      data_prevista: form.data_prevista || null,
      note: form.note || null,
      gratis: !!form.gratis,
    }
    if (editing?.id) await supabase.from('fornitori_pagamenti').update(payload).eq('id', editing.id)
    else await supabase.from('fornitori_pagamenti').insert(payload)
    setShowForm(false); setEditing(null); setForm(blankForm())
    load()
  }

  async function segnaPagato(row, data) {
    await supabase.from('fornitori_pagamenti').update({ data_pagamento: data }).eq('id', row.id)
    load()
  }
  async function annullaPagato(row) {
    await supabase.from('fornitori_pagamenti').update({ data_pagamento: null }).eq('id', row.id)
    load()
  }
  async function elimina(row) {
    if (!window.confirm(`Eliminare "${row.nome}"?`)) return
    await supabase.from('fornitori_pagamenti').delete().eq('id', row.id)
    load()
  }
  function apriModifica(row) {
    setEditing(row)
    setForm({
      nome: row.nome, destination: row.destination || '', shift_num: row.shift_num ?? '',
      importo: row.importo, data_prevista: row.data_prevista || oggiISO(), note: row.note || '', gratis: row.gratis,
    })
    setShowForm(true)
  }
  function apriNuovo() {
    setEditing(null)
    setForm({ ...blankForm(), destination: filterDest || '' })
    setShowForm(true)
  }

  const filtered = fornitori.filter(f => !filterDest || f.destination === filterDest || !f.destination)
  const daPagare = filtered.filter(f => !f.data_pagamento && !f.gratis).sort((a, b) => (a.data_prevista || '9999').localeCompare(b.data_prevista || '9999'))
  const pagati = filtered.filter(f => f.data_pagamento).sort((a, b) => (b.data_pagamento || '').localeCompare(a.data_pagamento || ''))
  const gratis = filtered.filter(f => f.gratis && !f.data_pagamento)

  const saldoAttuale = saldoReale(filterDest)
  const totalePianificato = daPagare.reduce((t, f) => t + Number(f.importo), 0)
  let corrente = saldoAttuale
  const proiezione = daPagare.map(f => { corrente -= Number(f.importo); return { ...f, saldoDopo: corrente } })
  const saldoFinale = corrente
  const vaInRosso = proiezione.some(p => p.saldoDopo < 0)
  const primoRosso = proiezione.find(p => p.saldoDopo < 0)

  // dettaglio per turno, solo per la meta selezionata (aiuta a capire "da dove viene" il numero)
  const dettaglioTurni = filterDest ? saldi.filter(r => r.destination === filterDest).sort((a, b) => (a.shift_num || 0) - (b.shift_num || 0)) : []

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Caricamento...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={() => setFilterDest(null)} style={chipStyle(!filterDest)}>Tutte</button>
        {DESTINATIONS.map(d => (
          <button key={d.id} onClick={() => setFilterDest(d.id)} style={chipStyle(filterDest === d.id)}>{d.flag} {d.name}</button>
        ))}
      </div>

      {/* ===== SALDO — un solo numero grande, ben visibile ===== */}
      <div style={{ background: vaInRosso ? '#FEF2F2' : 'var(--bg-primary)', border: '1px solid ' + (vaInRosso ? '#FCA5A5' : 'var(--border)'), borderRadius: 16, padding: 22, marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Cassa {filterDest ? DESTINATIONS.find(d => d.id === filterDest).name : '(tutte le mete)'} — quanto hai davvero oggi
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, color: saldoAttuale >= 0 ? '#16A34A' : '#DC2626', margin: '4px 0' }}>{fmtEur(saldoAttuale)}</div>

        {totalePianificato > 0 && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
            Hai <strong>{fmtEur(totalePianificato)}</strong> di pagamenti in programma non ancora fatti.
            Dopo averli fatti tutti, ti resterebbero <strong style={{ color: saldoFinale >= 0 ? '#16A34A' : '#DC2626' }}>{fmtEur(saldoFinale)}</strong>.
          </div>
        )}

        {vaInRosso && (
          <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', background: '#FEE2E2', borderRadius: 10, padding: '8px 14px', marginTop: 12, fontSize: 12.5, fontWeight: 700, color: '#B91C1C' }}>
            <AlertTriangle size={15} /> Attenzione: pagando "{primoRosso.nome}" ({fmtData(primoRosso.data_prevista)}) andresti in rosso
          </div>
        )}

        {filterDest && dettaglioTurni.length > 0 && (
          <details style={{ marginTop: 14, fontSize: 12, color: 'var(--text-tertiary)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Vedi il dettaglio per turno</summary>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
              {dettaglioTurni.map(r => (
                <div key={r.shift_num} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{shiftLabel(filterDest, r.shift_num)} ({r.movimenti} movimenti)</span>
                  <strong style={{ color: r.saldo >= 0 ? '#16A34A' : '#DC2626' }}>{fmtEur(r.saldo)}</strong>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ===== PAGAMENTI IN PROGRAMMA (solo se ce ne sono) ===== */}
      {daPagare.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', marginBottom: 8 }}>Da pagare, in ordine di data</div>
          <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {proiezione.map((p, i) => (
              <RigaFornitore key={p.id} f={p} isFirst={i === 0} colore="#DC2626" sottotitolo={'previsto ' + fmtData(p.data_prevista)}
                extra={<span style={{ fontSize: 12, color: p.saldoDopo >= 0 ? '#16A34A' : '#DC2626', fontWeight: 600 }}>resta {fmtEur(p.saldoDopo)}</span>}
                onSegnaPagato={segnaPagato} onModifica={apriModifica} onElimina={elimina} />
            ))}
          </div>
        </div>
      )}

      {/* ===== STORICO PAGATI (comprimibile, non ingombra) ===== */}
      {pagati.length > 0 && (
        <details style={{ marginBottom: 20 }}>
          <summary style={{ fontSize: 11.5, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', marginBottom: 8, cursor: 'pointer' }}>Già pagati ({pagati.length})</summary>
          <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginTop: 8 }}>
            {pagati.map(f => (
              <RigaFornitore key={f.id} f={f} colore="#16A34A" sottotitolo={'pagato il ' + fmtData(f.data_pagamento)}
                onAnnulla={annullaPagato} onModifica={apriModifica} onElimina={elimina} />
            ))}
          </div>
        </details>
      )}

      {gratis.length > 0 && (
        <details style={{ marginBottom: 20 }}>
          <summary style={{ fontSize: 11.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 8, cursor: 'pointer' }}>Gratis ({gratis.length})</summary>
          <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginTop: 8 }}>
            {gratis.map(f => (
              <RigaFornitore key={f.id} f={f} colore="#64748B" sottotitolo="nessun costo" onModifica={apriModifica} onElimina={elimina} />
            ))}
          </div>
        </details>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)', fontSize: 13.5 }}>
          Nessun pagamento fornitore ancora registrato{filterDest ? ' per ' + DESTINATIONS.find(d => d.id === filterDest).name : ''}.
        </div>
      )}

      <button onClick={apriNuovo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px', borderRadius: 12, background: 'var(--iv-blue)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 8 }}>
        <Plus size={17} /> Nuovo pagamento fornitore
      </button>

      {showForm && (
        <div onClick={() => { setShowForm(false); setEditing(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <form onClick={e => e.stopPropagation()} onSubmit={salvaFornitore} style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{editing ? 'Modifica pagamento' : 'Nuovo pagamento fornitore'}</div>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
            </div>

            <label style={labelStyle}>Nome fornitore
              <input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="es. Mojito 1, Paleo, 54, City tax Ionian" style={inputStyle} />
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ ...labelStyle, flex: 1 }}>Meta (opzionale)
                <select value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value, shift_num: '' })} style={inputStyle}>
                  <option value="">— trasversale —</option>
                  {DESTINATIONS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label style={{ ...labelStyle, flex: 1 }}>Turno (opzionale)
                <select value={form.shift_num} onChange={e => setForm({ ...form, shift_num: e.target.value })} style={inputStyle} disabled={!form.destination}>
                  <option value="">—</option>
                  {form.destination && SHIFTS[form.destination]?.map(s => <option key={s.num} value={s.num}>{shiftLabel(form.destination, s.num)}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ ...labelStyle, flex: 1 }}>Importo (€)
                <input required type="number" step="0.01" value={form.importo} onChange={e => setForm({ ...form, importo: e.target.value })} style={inputStyle} />
              </label>
              <label style={{ ...labelStyle, flex: 1 }}>Data prevista
                <input type="date" value={form.data_prevista} onChange={e => setForm({ ...form, data_prevista: e.target.value })} style={inputStyle} />
              </label>
            </div>

            <label style={labelStyle}>Note (opzionale)
              <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="es. saldo w3, anticipo..." style={inputStyle} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={form.gratis} onChange={e => setForm({ ...form, gratis: e.target.checked })} />
              Gratis questa volta (nessun costo)
            </label>

            <button type="submit" style={{ marginTop: 6, padding: '11px', borderRadius: 10, background: 'var(--iv-blue)', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }}>
              {editing ? 'Salva modifiche' : 'Aggiungi'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function RigaFornitore({ f, colore, sottotitolo, extra, isFirst, onSegnaPagato, onAnnulla, onModifica, onElimina }) {
  const [data, setData] = useState(oggiISO())
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderTop: !isFirst && !onAnnulla && !extra ? '0.5px solid var(--border)' : (isFirst ? 'none' : '0.5px solid var(--border)') }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
          {f.nome}
          {f.destination && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: 12 }}> · {DESTINATIONS.find(d => d.id === f.destination)?.name}{f.shift_num ? ' ' + f.shift_num : ''}</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sottotitolo}{f.note ? ' · ' + f.note : ''}</div>
      </div>
      {extra}
      <div style={{ fontSize: 13.5, fontWeight: 700, flexShrink: 0, minWidth: 60, textAlign: 'right' }}>{f.gratis ? 'FREE' : fmtEur(f.importo)}</div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {onSegnaPagato && (
          <>
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ fontSize: 11, padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', width: 110 }} />
            <button onClick={() => onSegnaPagato(f, data)} title="Segna come pagato" style={iconBtnStyle('#16A34A')}><Check size={14} /></button>
          </>
        )}
        {onAnnulla && <button onClick={() => onAnnulla(f)} title="Segna come NON pagato" style={iconBtnStyle('#D97706')}>↺</button>}
        <button onClick={() => onModifica(f)} title="Modifica" style={iconBtnStyle('var(--text-secondary)')}><Pencil size={13} /></button>
        <button onClick={() => onElimina(f)} title="Elimina" style={iconBtnStyle('#DC2626')}><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

function chipStyle(active) {
  return { padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: active ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (active ? 'var(--iv-blue)' : 'var(--border)') }
}
function iconBtnStyle(color) {
  return { width: 27, height: 27, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', color, border: 'none', cursor: 'pointer' }
}
const labelStyle = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }
const inputStyle = { padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 13.5, fontFamily: 'inherit' }
