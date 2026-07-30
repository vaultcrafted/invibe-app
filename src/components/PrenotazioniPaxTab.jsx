import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel, getServices, capogruppoCode } from '../lib/constants'

const DEST_COLORS = { pag: '#F97316', corfu: '#1E6BF1', zante: '#059669', gallipoli: '#A855F7', sardegna: '#DC2626' }

const STATI = [
  { id: 'nuova', label: 'Da riscuotere', colore: '#D97706', bg: '#FEF3C7' },
  { id: 'confermata', label: 'Riscosse', colore: '#15803D', bg: '#DCFCE7' },
  { id: 'annullata', label: 'Annullate', colore: '#64748B', bg: '#F1F5F9' },
]

export default function PrenotazioniPaxTab() {
  const navigate = useNavigate()
  const [righe, setRighe] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroMeta, setFiltroMeta] = useState(null)
  const [filtroTurno, setFiltroTurno] = useState(null)
  const [filtroStato, setFiltroStato] = useState('nuova')
  const [inCorso, setInCorso] = useState({})

  useEffect(() => {
    carica()
    const ch = supabase.channel('pax-prenotazioni')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pax_prenotazioni' }, carica)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function carica() {
    setLoading(true)
    const { data } = await supabase.from('pax_prenotazioni').select('*').order('created_at', { ascending: false })
    setRighe(data || [])
    setLoading(false)
  }

  // prezzo e nome leggibile del servizio: stessa logica dell'app (per meta e turno)
  function servizioInfo(r) {
    const sv = getServices(r.destination, r.shift_num).find(s => s.id === r.servizio)
    return { label: sv?.label || r.servizio, prezzo: sv?.prezzo || 0 }
  }

  async function cambiaStato(r, nuovoStato) {
    setInCorso(p => ({ ...p, [r.id]: true }))
    const { error } = await supabase.from('pax_prenotazioni')
      .update({ stato: nuovoStato, chiusa_at: new Date().toISOString() })
      .eq('id', r.id)
    setInCorso(p => { const n = { ...p }; delete n[r.id]; return n })
    if (!error) setRighe(prev => prev.map(x => x.id === r.id ? { ...x, stato: nuovoStato } : x))
  }

  const filtrate = useMemo(() => righe.filter(r =>
    (!filtroMeta || r.destination === filtroMeta) &&
    (!filtroTurno || r.shift_num === filtroTurno) &&
    (!filtroStato || r.stato === filtroStato)
  ), [righe, filtroMeta, filtroTurno, filtroStato])

  // raggruppo per invio (batch): il capogruppo ha confermato piu' servizi insieme
  const batch = useMemo(() => {
    const m = new Map()
    for (const r of filtrate) {
      if (!m.has(r.batch_id)) m.set(r.batch_id, [])
      m.get(r.batch_id).push(r)
    }
    return [...m.values()]
  }, [filtrate])

  const totaleStimato = filtrate.reduce((s, r) => s + r.quantita * servizioInfo(r).prezzo, 0)
  const turniDisponibili = filtroMeta
    ? [...new Set(righe.filter(r => r.destination === filtroMeta).map(r => r.shift_num))].sort((a, b) => a - b)
    : []
  const conteggi = STATI.reduce((acc, s) => {
    acc[s.id] = righe.filter(r => r.stato === s.id &&
      (!filtroMeta || r.destination === filtroMeta) && (!filtroTurno || r.shift_num === filtroTurno)).length
    return acc
  }, {})

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
        Prenotazioni fatte dai capogruppo dall'app pax. <b>Non sono ancora incassi</b>: quando il
        Capo Meta riscuote, registra il servizio nel gruppo come sempre e poi segna qui la riga come riscossa.
      </div>

      {/* stato */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
        {STATI.map(s => (
          <button key={s.id} onClick={() => setFiltroStato(filtroStato === s.id ? null : s.id)} style={{
            padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: filtroStato === s.id ? s.colore : s.bg,
            color: filtroStato === s.id ? '#fff' : s.colore,
            border: '0.5px solid ' + (filtroStato === s.id ? s.colore : s.bg),
          }}>{s.label} · {conteggi[s.id] || 0}</button>
        ))}
      </div>

      {/* meta */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <button onClick={() => { setFiltroMeta(null); setFiltroTurno(null) }} style={chip(!filtroMeta, 'var(--iv-blue)')}>Tutte</button>
        {DESTINATIONS.map(d => (
          <button key={d.id} onClick={() => { setFiltroMeta(filtroMeta === d.id ? null : d.id); setFiltroTurno(null) }}
            style={chip(filtroMeta === d.id, DEST_COLORS[d.id])}>{d.name}</button>
        ))}
      </div>

      {filtroMeta && turniDisponibili.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <button onClick={() => setFiltroTurno(null)} style={chip(!filtroTurno, DEST_COLORS[filtroMeta])}>Tutti</button>
          {turniDisponibili.map(n => (
            <button key={n} onClick={() => setFiltroTurno(filtroTurno === n ? null : n)}
              style={chip(filtroTurno === n, DEST_COLORS[filtroMeta])}>{shiftLabel(filtroMeta, n)}</button>
          ))}
        </div>
      )}

      {filtrate.length > 0 && (
        <div className="card" style={{ padding: '11px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>Da riscuotere</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>€{totaleStimato}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {batch.length} {batch.length === 1 ? 'prenotazione' : 'prenotazioni'} · {filtrate.length} {filtrate.length === 1 ? 'servizio' : 'servizi'}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : batch.length === 0 ? (
        <div className="empty-state"><p>Nessuna prenotazione in questo elenco.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {batch.map(gruppo => {
            const r0 = gruppo[0]
            const colore = DEST_COLORS[r0.destination] || 'var(--iv-blue)'
            const tot = gruppo.reduce((s, r) => s + r.quantita * servizioInfo(r).prezzo, 0)
            const quando = new Date(r0.created_at)
            return (
              <div className="card" key={r0.batch_id} style={{ padding: 14, borderLeft: '3px solid ' + colore }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                      {capogruppoCode(r0.capogruppo_code) && <span className="code-chip" style={{ marginRight: 6 }}>{capogruppoCode(r0.capogruppo_code)}</span>}
                      {r0.capogruppo || r0.capogruppo_code}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {DESTINATIONS.find(d => d.id === r0.destination)?.name} · {shiftLabel(r0.destination, r0.shift_num)}
                      {' · '}{quando.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} {quando.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: colore, flexShrink: 0 }}>€{tot}</div>
                </div>

                {gruppo.map(r => {
                  const info = servizioInfo(r)
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13 }}>
                      <span style={{ fontWeight: 700, minWidth: 26 }}>{r.quantita}×</span>
                      <span style={{ flex: 1 }}>{info.label}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>€{info.prezzo} · €{r.quantita * info.prezzo}</span>
                    </div>
                  )
                })}

                {r0.nota && (
                  <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 9, fontSize: 12.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    “{r0.nota}”
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {r0.group_id && (
                    <button onClick={() => navigate(`/group/${r0.group_id}`)} style={btn('var(--bg-secondary)', 'var(--text-primary)')}>
                      Apri il gruppo
                    </button>
                  )}
                  {r0.stato === 'nuova' ? (
                    <>
                      <button disabled={!!inCorso[r0.id]}
                        onClick={() => gruppo.forEach(r => cambiaStato(r, 'confermata'))}
                        style={btn('#16A34A', '#fff')}>Riscossa</button>
                      <button disabled={!!inCorso[r0.id]}
                        onClick={() => gruppo.forEach(r => cambiaStato(r, 'annullata'))}
                        style={btn('transparent', '#DC2626', '#FCA5A5')}>Annulla</button>
                    </>
                  ) : (
                    <button onClick={() => gruppo.forEach(r => cambiaStato(r, 'nuova'))}
                      style={btn('transparent', 'var(--text-secondary)', 'var(--border)')}>Rimetti da riscuotere</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function chip(active, color) {
  return {
    padding: '5px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    background: active ? color : 'var(--bg-secondary)',
    color: active ? '#fff' : 'var(--text-secondary)',
    border: '0.5px solid ' + (active ? color : 'var(--border)'),
  }
}

function btn(bg, color, borderColor) {
  return {
    padding: '9px 15px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    background: bg, color: color, border: '0.5px solid ' + (borderColor || bg),
  }
}
