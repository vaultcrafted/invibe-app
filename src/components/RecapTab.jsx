import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DESTINATIONS } from '../lib/constants'

const PREFISSI = { pag: 'P', corfu: 'C', zante: 'Z', gallipoli: 'G', sardegna: 'S' }
const eur = n => '€' + Number(n || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })

// Le categorie raggruppate in famiglie, per leggere il recap a colpo d'occhio.
// I giroconti stanno a parte apposta: sono le rimanenze che passano da una week
// all'altra, quasi mezzo milione di euro che gira, e mischiarli col resto
// renderebbe illeggibile ogni totale.
const GESTIONE = ['Rimborso spesa', 'Spesa', 'Rimborsi', 'Bolt', 'Benzina', 'Rimborso wifi', 'Transfer aeroporto']
const GIRO = ['Cassa (week precedente)', 'Cassa (week successiva)']

const FAMIGLIE = [
  { id: 'servizi',  nome: 'Servizi venduti',    tinta: '#059669',
    test: c => !GESTIONE.includes(c) && !GIRO.includes(c) && c !== 'Altro' },
  { id: 'gestione', nome: 'Spese di gestione',  tinta: '#D97706', test: c => GESTIONE.includes(c) },
  { id: 'altro',    nome: 'Altro',              tinta: '#7C3AED', test: c => c === 'Altro' },
  { id: 'giro',     nome: 'Giroconti di cassa', tinta: '#64748B', test: c => GIRO.includes(c) },
]
const famigliaDi = cat => (FAMIGLIE.find(f => f.test(cat || '')) || FAMIGLIE[0]).id

export default function RecapTab() {
  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState(null)
  const [turno, setTurno] = useState(null)
  const [chiuse, setChiuse] = useState({})

  useEffect(() => { carica() }, [])

  async function carica() {
    setLoading(true)
    // Supabase restituisce al massimo 1000 righe per volta: senza paginare i
    // totali risultano parziali e il recap privo di senso.
    let tutti = [], da = 0
    while (true) {
      const { data } = await supabase.from('cassa_movimenti')
        .select('destination, shift_num, tipo, importo, categoria')
        .range(da, da + 999)
      if (!data || !data.length) break
      tutti = tutti.concat(data)
      if (data.length < 1000) break
      da += 1000
    }
    setMovimenti(tutti)
    setLoading(false)
  }

  const visibili = movimenti.filter(m =>
    (!meta || m.destination === meta) &&
    (!turno || String(m.shift_num) === String(turno)))

  const perCategoria = {}
  visibili.forEach(m => {
    const c = m.categoria || '(senza categoria)'
    if (!perCategoria[c]) perCategoria[c] = { entrate: 0, uscite: 0, n: 0 }
    const v = Number(m.importo) || 0
    if (m.tipo === 'entrata') perCategoria[c].entrate += v
    else perCategoria[c].uscite += v
    perCategoria[c].n++
  })

  const totEntrate = visibili.reduce((t, m) => t + (m.tipo === 'entrata' ? Number(m.importo) : 0), 0)
  const totUscite  = visibili.reduce((t, m) => t + (m.tipo === 'uscita'  ? Number(m.importo) : 0), 0)

  const turniMeta = meta
    ? [...new Set(movimenti.filter(m => m.destination === meta).map(m => m.shift_num))].sort((a, b) => a - b)
    : []

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Caricamento…</div>

  const card = { background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }

  return (
    <div style={{ padding: '14px 16px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={etichetta}>Meta:</span>
        <button onClick={() => { setMeta(null); setTurno(null) }} style={chip(!meta)}>Tutte</button>
        {DESTINATIONS.map(d => (
          <button key={d.id} onClick={() => { setMeta(d.id); setTurno(null) }} style={chip(meta === d.id)}>
            {d.flag} {d.name}
          </button>
        ))}
      </div>

      {meta && turniMeta.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={etichetta}>Turno:</span>
          <button onClick={() => setTurno(null)} style={chip(!turno)}>Tutti</button>
          {turniMeta.map(t => (
            <button key={t} onClick={() => setTurno(t)} style={chip(String(turno) === String(t))}>
              {PREFISSI[meta]}{t}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          { l: 'Entrate', v: totEntrate, c: '#16A34A', bg: '#F0FDF4' },
          { l: 'Uscite',  v: totUscite,  c: '#DC2626', bg: '#FEF2F2' },
          { l: 'Saldo',   v: totEntrate - totUscite, c: 'var(--iv-blue)', bg: '#EFF6FF' },
        ].map(x => (
          <div key={x.l} style={{ ...card, background: x.bg, padding: '13px 15px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: x.c, textTransform: 'uppercase' }}>{x.l}</div>
            <div style={{ fontSize: 23, fontWeight: 800, color: x.c, marginTop: 3 }}>{eur(x.v)}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-tertiary)' }}>
        {visibili.length} movimenti · {Object.keys(perCategoria).length} categorie
      </div>

      {FAMIGLIE.map(f => {
        const cats = Object.entries(perCategoria)
          .filter(([c]) => famigliaDi(c) === f.id)
          .sort((a, b) => (b[1].entrate + b[1].uscite) - (a[1].entrate + a[1].uscite))
        if (!cats.length) return null

        const e = cats.reduce((t, [, v]) => t + v.entrate, 0)
        const u = cats.reduce((t, [, v]) => t + v.uscite, 0)
        const aperta = !chiuse[f.id]

        return (
          <div key={f.id} style={card}>
            <button
              onClick={() => setChiuse(x => ({ ...x, [f.id]: aperta }))}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px',
                background: 'transparent', border: 0, borderLeft: '3px solid ' + f.tinta,
                borderRadius: 'var(--radius-lg)', cursor: 'pointer', font: 'inherit', textAlign: 'left',
              }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{f.nome}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {cats.length} categorie
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {e > 0 && <div style={{ fontSize: 13.5, fontWeight: 700, color: '#16A34A' }}>+{eur(e)}</div>}
                {u > 0 && <div style={{ fontSize: 13.5, fontWeight: 700, color: '#DC2626' }}>−{eur(u)}</div>}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{aperta ? '▾' : '▸'}</span>
            </button>

            {aperta && (
              <div style={{ borderTop: '0.5px solid var(--border)' }}>
                {cats.map(([c, v], i) => (
                  <div key={c} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 15px',
                    borderTop: i > 0 ? '0.5px solid var(--border)' : 'none',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{v.n} movimenti</div>
                    </div>
                    <div style={{ width: 92, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#16A34A' }}>
                      {v.entrate > 0 ? '+' + eur(v.entrate) : ''}
                    </div>
                    <div style={{ width: 92, textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#DC2626' }}>
                      {v.uscite > 0 ? '−' + eur(v.uscite) : ''}
                    </div>
                    <div style={{ width: 92, textAlign: 'right', fontSize: 13.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {eur(v.entrate - v.uscite)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const etichetta = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }

function chip(attivo) {
  return {
    padding: '6px 13px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    border: '1px solid ' + (attivo ? 'var(--iv-blue)' : 'var(--border)'),
    background: attivo ? 'var(--iv-blue)' : 'var(--bg-primary)',
    color: attivo ? '#fff' : 'var(--text-secondary)',
  }
}
