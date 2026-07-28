import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import { Plus, X, Check, Trash2, AlertTriangle } from 'lucide-react'

const fmtEur = (n) => '€ ' + Math.round(n || 0).toLocaleString('it-IT')
const fmtData = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '—'
const oggiISO = () => new Date().toISOString().slice(0, 10)

export default function FornitoriTab() {
  const [fornitori, setFornitori] = useState([])
  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDest, setFilterDest] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null) // riga in modifica (segna pagato / elimina)
  const [form, setForm] = useState(blankForm())

  function blankForm() {
    return { nome: '', destination: '', shift_num: '', importo: '', data_prevista: oggiISO(), note: '', gratis: false }
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: f }, { data: m }] = await Promise.all([
      supabase.from('fornitori_pagamenti').select('*').order('data_prevista', { ascending: true, nullsFirst: false }),
      supabase.from('cassa_movimenti').select('destination, shift_num, tipo, importo'),
    ])
    setFornitori(f || [])
    setMovimenti(m || [])
    setLoading(false)
  }

  // Saldo cassa REALE attuale (da movimenti veri), per meta+turno o per tutta la meta
  function saldoReale(dest, shift) {
    return movimenti
      .filter(m => (!dest || m.destination === dest) && (shift == null || m.shift_num === shift))
      .reduce((t, m) => t + (m.tipo === 'entrata' ? Number(m.importo) : -Number(m.importo)), 0)
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
    if (editing?.id) {
      await supabase.from('fornitori_pagamenti').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('fornitori_pagamenti').insert(payload)
    }
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

  const filtered = fornitori.filter(f => !filterDest || f.destination === filterDest || !f.destination)
  const daPagare = filtered.filter(f => !f.data_pagamento && !f.gratis).sort((a, b) => (a.data_prevista || '9999').localeCompare(b.data_prevista || '9999'))
  const pagati = filtered.filter(f => f.data_pagamento)
  const gratis = filtered.filter(f => f.gratis && !f.data_pagamento)

  // ---- Previsione: saldo attuale meno pagamenti pianificati (non ancora pagati), in ordine di data ----
  const saldoAttuale = saldoReale(filterDest, null)
  let saldoCorrente = saldoAttuale
  const proiezione = daPagare.map(f => {
    saldoCorrente -= Number(f.importo)
    return { ...f, saldoDopo: saldoCorrente }
  })
  const vaInRosso = proiezione.some(p => p.saldoDopo < 0)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Caricamento...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setFilterDest(null)} style={chipStyle(!filterDest)}>Tutte</button>
        {DESTINATIONS.map(d => (
          <button key={d.id} onClick={() => setFilterDest(d.id)} style={chipStyle(filterDest === d.id)}>{d.flag} {d.name}</button>
        ))}
      </div>

      {/* ===== PREVISIONE CASSA ===== */}
      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 12 }}>
          Previsione cassa {filterDest ? '· ' + DESTINATIONS.find(d => d.id === filterDest).name : '(tutte le mete)'}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160, background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Saldo cassa oggi</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: saldoAttuale >= 0 ? '#16A34A' : '#DC2626' }}>{fmtEur(saldoAttuale)}</div>
          </div>
          <div style={{ flex: 1, minWidth: 160, background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Da pagare (pianificato)</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{fmtEur(daPagare.reduce((t, f) => t + Number(f.importo), 0))}</div>
          </div>
          <div style={{ flex: 1, minWidth: 160, background: vaInRosso ? '#FEF2F2' : '#ECFDF5', border: '1px solid ' + (vaInRosso ? '#FCA5A5' : '#16A34A33'), borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>Saldo dopo tutti i pagamenti</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: saldoCorrente >= 0 ? '#16A34A' : '#DC2626' }}>{fmtEur(saldoCorrente)}</div>
          </div>
        </div>

        {vaInRosso && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: '#B91C1C' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Attenzione: seguendo l'ordine delle date previste, la cassa va in rosso ad un certo punto — vedi sotto da quale pagamento in poi.</span>
          </div>
        )}

        {proiezione.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun pagamento pianificato in sospeso.</div>
        ) : proiezione.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: '0.5px solid var(--border)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome} {p.destination && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>· {DESTINATIONS.find(d => d.id === p.destination)?.name}{p.shift_num ? ' ' + p.shift_num : ''}</span>}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>previsto {fmtData(p.data_prevista)}{p.note ? ' · ' + p.note : ''}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>-{fmtEur(p.importo)}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: p.saldoDopo >= 0 ? '#16A34A' : '#DC2626', minWidth: 80, textAlign: 'right' }}>{fmtEur(p.saldoDopo)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ===== FORNITORI & PAGAMENTI ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fornitori & pagamenti</div>
        <button onClick={() => { setEditing(null); setForm(blankForm()); setShowForm(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'var(--iv-blue)', color: '#fff', fontSize: 12.5, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          <Plus size={15} /> Nuovo pagamento
        </button>
      </div>

      <FornitoriLista titolo="Da pagare" righe={daPagare} colore="#DC2626" onPagato={segnaPagato} onModifica={apriModifica} onElimina={elimina} />
      <FornitoriLista titolo="Pagati" righe={pagati} colore="#16A34A" pagatoView onAnnulla={annullaPagato} onModifica={apriModifica} onElimina={elimina} />
      {gratis.length > 0 && <FornitoriLista titolo="Gratis (nessun costo)" righe={gratis} colore="#64748B" onModifica={apriModifica} onElimina={elimina} />}

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
                <select value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} style={inputStyle}>
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
              Gratis questa volta (FREE, nessun costo)
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

function FornitoriLista({ titolo, righe, colore, pagatoView, onPagato, onAnnulla, onModifica, onElimina }) {
  const [dataPagamento, setDataPagamento] = useState({})
  if (!righe.length) return null
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: colore, textTransform: 'uppercase', marginBottom: 8 }}>{titolo} ({righe.length})</div>
      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {righe.map((f, i) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{f.nome} {f.destination && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: 12 }}>· {DESTINATIONS.find(d => d.id === f.destination)?.name}{f.shift_num ? ' ' + f.shift_num : ''}</span>}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {pagatoView ? 'pagato il ' + fmtData(f.data_pagamento) : 'previsto ' + fmtData(f.data_prevista)}
                {f.note ? ' · ' + f.note : ''}
              </div>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, flexShrink: 0 }}>{f.gratis ? 'FREE' : fmtEur(f.importo)}</div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {!pagatoView && !f.gratis && (
                <>
                  <input type="date" value={dataPagamento[f.id] || oggiISO()} onChange={e => setDataPagamento(p => ({ ...p, [f.id]: e.target.value }))} style={{ fontSize: 11, padding: '5px 6px', borderRadius: 6, border: '1px solid var(--border)', width: 118 }} />
                  <button onClick={() => onPagato(f, dataPagamento[f.id] || oggiISO())} title="Segna come pagato" style={iconBtnStyle('#16A34A')}><Check size={14} /></button>
                </>
              )}
              {pagatoView && (
                <button onClick={() => onAnnulla(f)} title="Segna come NON pagato" style={iconBtnStyle('#D97706')}>↺</button>
              )}
              <button onClick={() => onModifica(f)} title="Modifica" style={iconBtnStyle('var(--text-secondary)')}>✎</button>
              <button onClick={() => onElimina(f)} title="Elimina" style={iconBtnStyle('#DC2626')}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function chipStyle(active) {
  return { padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: active ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (active ? 'var(--iv-blue)' : 'var(--border)') }
}
function iconBtnStyle(color) {
  return { width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', color, border: 'none', cursor: 'pointer', fontSize: 13 }
}
const labelStyle = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }
const inputStyle = { padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 13.5, fontFamily: 'inherit' }
