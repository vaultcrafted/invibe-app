import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DESTINATIONS } from '../lib/constants'

const PREFISSI = { pag: 'P', corfu: 'C', zante: 'Z', gallipoli: 'G', sardegna: 'S' }
const eur = n => '€' + Number(n || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })
const eur2 = n => '€' + Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// I giroconti sono le rimanenze che passano da una week all'altra: centinaia di
// migliaia di euro che girano senza essere ne' guadagno ne' costo. Restano
// esclusi dai totali, altrimenti ogni numero perde senso.
const GIRO = ['Cassa (week precedente)', 'Cassa (week successiva)']
const GESTIONE = ['Rimborso spesa', 'Spesa', 'Rimborsi', 'Bolt', 'Benzina', 'Rimborso wifi', 'Transfer aeroporto']

export default function RecapTab() {
  const [movimenti, setMovimenti] = useState([])
  const [gruppi, setGruppi] = useState({})   // id -> riga del gruppo, per leggere le quantita'
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState(null)
  const [turno, setTurno] = useState(null)
  const [dettaglio, setDettaglio] = useState(null)   // categoria aperta

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    // Supabase restituisce max 1000 righe: senza paginare i totali sono parziali.
    let tutti = [], da = 0
    while (true) {
      const { data } = await supabase.from('cassa_movimenti')
        .select('destination, shift_num, tipo, importo, categoria, descrizione, metodo, data, inserito_da, group_id, servizio_id')
        .range(da, da + 999)
      if (!data || !data.length) break
      tutti = tutti.concat(data)
      if (data.length < 1000) break
      da += 1000
    }
    setMovimenti(tutti)

    // I gruppi servono per il numero di pax: ogni movimento automatico porta il
    // servizio, e la quantita' venduta sta nella colonna omonima del gruppo.
    let gg = [], og = 0
    while (true) {
      const { data } = await supabase.from('groups').select('*').range(og, og + 999)
      if (!data || !data.length) break
      gg = gg.concat(data)
      if (data.length < 1000) break
      og += 1000
    }
    const mappa = {}
    gg.forEach(g => { mappa[g.id] = g })
    setGruppi(mappa)
    setLoading(false)
  }

  // Quantita' venduta dietro un movimento: null se non e' un servizio di gruppo
  // (movimenti d'ufficio, pagamenti a fornitori, spese).
  function qtaDi(m) {
    if (!m.group_id || !m.servizio_id) return null
    const g = gruppi[m.group_id]
    if (!g) return null
    const v = Number(g[m.servizio_id])
    return isNaN(v) ? null : v
  }

  const visibili = movimenti.filter(m =>
    (!meta || m.destination === meta) &&
    (!turno || String(m.shift_num) === String(turno)))

  const perCat = {}
  visibili.forEach(m => {
    const c = m.categoria || '(senza categoria)'
    if (!perCat[c]) perCat[c] = { entrate: 0, uscite: 0, n: 0, pax: 0 }
    const v = Number(m.importo) || 0
    if (m.tipo === 'entrata') perCat[c].entrate += v; else perCat[c].uscite += v
    perCat[c].n++
    const q = qtaDi(m)
    if (q != null) perCat[c].pax = (perCat[c].pax || 0) + q
  })

  // Incassi e spese, esclusi i giroconti
  const reali = visibili.filter(m => !GIRO.includes(m.categoria))
  const incassato = reali.reduce((t, m) => t + (m.tipo === 'entrata' ? Number(m.importo) : 0), 0)
  const speso = reali.reduce((t, m) => t + (m.tipo === 'uscita' ? Number(m.importo) : 0), 0)

  const turniMeta = meta
    ? [...new Set(movimenti.filter(m => m.destination === meta).map(m => m.shift_num))].sort((a, b) => a - b)
    : []

  // Una lista sola, ordinata per quanto pesa: prima le voci grosse.
  const lista = Object.entries(perCat)
    .filter(([c]) => !GIRO.includes(c))
    .map(([c, v]) => ({ cat: c, ...v, peso: Math.max(v.entrate, v.uscite), saldo: v.entrate - v.uscite }))
    .sort((a, b) => b.peso - a.peso)
  const massimo = lista.length ? lista[0].peso : 1

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Caricamento…</div>

  const righeDettaglio = dettaglio
    ? visibili.filter(m => (m.categoria || '(senza categoria)') === dettaglio)
        .sort((a, b) => Number(b.importo) - Number(a.importo))
    : []

  return (
    <div style={{ padding: '14px 16px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => { setMeta(null); setTurno(null) }} style={chip(!meta)}>Tutte le mete</button>
        {DESTINATIONS.map(d => (
          <button key={d.id} onClick={() => { setMeta(d.id); setTurno(null) }} style={chip(meta === d.id)}>
            {d.flag} {d.name}
          </button>
        ))}
      </div>

      {meta && turniMeta.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setTurno(null)} style={chipSmall(!turno)}>Tutti</button>
          {turniMeta.map(t => (
            <button key={t} onClick={() => setTurno(t)} style={chipSmall(String(turno) === String(t))}>
              {PREFISSI[meta]}{t}
            </button>
          ))}
        </div>
      )}

      {/* due numeri, non tre: incassato e speso */}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius-lg)', padding: '13px 15px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>Incassato</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A', marginTop: 2 }}>{eur(incassato)}</div>
        </div>
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-lg)', padding: '13px 15px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Speso</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#DC2626', marginTop: 2 }}>{eur(speso)}</div>
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
        Tocca una voce per vedere i movimenti. I giroconti fra week sono esclusi.
      </div>

      {/* lista unica, ordinata per importo */}
      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {lista.map((r, i) => {
          const uscita = r.uscite > r.entrate
          const valore = uscita ? r.uscite : r.entrate
          return (
            <button key={r.cat} onClick={() => setDettaglio(r.cat)}
              style={{
                width: '100%', display: 'block', textAlign: 'left', cursor: 'pointer',
                background: 'transparent', border: 0, padding: '11px 15px', font: 'inherit',
                borderTop: i > 0 ? '0.5px solid var(--border)' : 'none',
              }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {r.cat}
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: uscita ? '#DC2626' : '#16A34A' }}>
                  {uscita ? '−' : '+'}{eur(valore)}
                </div>
              </div>
              {/* barra: quanto pesa questa voce rispetto alla piu' grande */}
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: Math.max(2, (valore / massimo) * 100) + '%',
                              background: uscita ? '#FCA5A5' : '#86EFAC' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {r.n} movimenti{r.pax > 0 && ' · ' + r.pax + ' pax'}
                {r.entrate > 0 && r.uscite > 0 &&
                  <> · in {eur(r.entrate)} · out {eur(r.uscite)} · saldo <b>{eur(r.saldo)}</b></>}
              </div>
            </button>
          )
        })}
        {!lista.length && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            Nessun movimento con questi filtri.
          </div>
        )}
      </div>

      {/* dettaglio della categoria toccata */}
      {dettaglio && (
        <div onClick={() => setDettaglio(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 3000,
                   display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-primary)', width: '100%', maxWidth: 720, maxHeight: '85vh',
                     borderRadius: '18px 18px 0 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800 }}>{dettaglio}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {righeDettaglio.length} movimenti
                  {(() => { const p = righeDettaglio.reduce((t, m) => t + (qtaDi(m) || 0), 0)
                            return p > 0 ? ' · ' + p + ' pax' : '' })()}
                  {meta && ' · ' + (DESTINATIONS.find(d => d.id === meta)?.name || '')}
                  {turno && ' ' + PREFISSI[meta] + turno}
                </div>
              </div>
              <button onClick={() => setDettaglio(null)}
                style={{ background: 'transparent', border: 0, fontSize: 22, cursor: 'pointer',
                         color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {righeDettaglio.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px',
                                      borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                      {m.descrizione || <span style={{ fontStyle: 'italic', color: '#B45309' }}>senza descrizione</span>}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      {PREFISSI[m.destination]}{m.shift_num}
                      {m.data && ' · ' + m.data.slice(8, 10) + '/' + m.data.slice(5, 7)}
                      {m.metodo && m.metodo !== 'Cash' && ' · ' + m.metodo}
                      {m.inserito_da && ' · ' + m.inserito_da}
                    </div>
                  </div>
                  {qtaDi(m) != null && (
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)',
                                  background: 'var(--bg-secondary, #F1F5F9)', borderRadius: 20,
                                  padding: '2px 9px', whiteSpace: 'nowrap' }}>
                      {qtaDi(m)} pax
                    </div>
                  )}
                  <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
                                color: m.tipo === 'entrata' ? '#16A34A' : '#DC2626' }}>
                    {m.tipo === 'entrata' ? '+' : '−'}{eur2(m.importo)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function chip(attivo) {
  return {
    padding: '7px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    border: '1px solid ' + (attivo ? 'var(--iv-blue)' : 'var(--border)'),
    background: attivo ? 'var(--iv-blue)' : 'var(--bg-primary)',
    color: attivo ? '#fff' : 'var(--text-secondary)',
  }
}
function chipSmall(attivo) {
  return { ...chip(attivo), padding: '4px 11px', fontSize: 11.5 }
}
