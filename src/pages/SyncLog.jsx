import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Topbar from '../components/Topbar'

const SCRIPTS = {
  cm_sync:  { label: 'FILE CM', color: '#1E6BF1', emoji: '📋' },
  prebook:  { label: 'Prebooking', color: '#D97706', emoji: '🎟️' },
  rooming:  { label: 'Rooming', color: '#7C3AED', emoji: '🛏️' },
}
const scriptInfo = (s) => SCRIPTS[s] || { label: s, color: '#64748B', emoji: '⚙️' }

function fmtDateTime(d) {
  const x = new Date(d)
  return x.toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function dayKey(d) {
  return new Date(d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function SyncLog() {
  const { isFullAccess } = useAuth()
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [endpoints, setEndpoints] = useState({})   // script -> {url, token}
  const [running, setRunning] = useState({})        // script -> bool
  const [note, setNote] = useState(null)            // messaggio esito

  useEffect(() => {
    if (!isFullAccess) { navigate('/'); return }
    load()
    supabase.from('sync_endpoints').select('*').then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[r.script] = { url: r.url, token: r.token } })
      setEndpoints(map)
    })
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('sync_logs').select('*').order('finished_at', { ascending: false }).limit(200)
    setLogs(data || [])
    setLoading(false)
  }

  async function runNow(script) {
    const ep = endpoints[script]
    if (!ep) { setNote({ t: 'err', m: 'Endpoint non configurato per ' + script + '. Vedi sync_endpoints.sql.' }); return }
    setNote(null)
    setRunning(r => ({ ...r, [script]: true }))
    const t0 = new Date().toISOString()
    // fa partire lo script (no-cors: non possiamo leggere la risposta, ma lo script parte)
    try {
      await fetch(`${ep.url}?job=${encodeURIComponent(script)}&token=${encodeURIComponent(ep.token)}`, { mode: 'no-cors' })
    } catch (e) { /* no-cors: errore atteso, ignora */ }
    // aspetta che compaia una nuova riga di log per questo script (fino a ~90s)
    let found = null
    for (let i = 0; i < 30 && !found; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const { data } = await supabase.from('sync_logs').select('*')
        .eq('script', script).gt('finished_at', t0).order('finished_at', { ascending: false }).limit(1)
      if (data && data.length) found = data[0]
    }
    setRunning(r => ({ ...r, [script]: false }))
    if (found) {
      setNote({ t: found.status === 'error' ? 'err' : 'ok', m: `${scriptInfo(script).label}: ${found.summary}` })
      load()
    } else {
      setNote({ t: 'wait', m: `Comando inviato a ${scriptInfo(script).label}. Se non compare a breve, premi Aggiorna.` })
      load()
    }
  }

  const filtered = logs.filter(l => filter === 'all' || l.script === filter)

  // raggruppa per giorno
  const byDay = []
  filtered.forEach(l => {
    const k = dayKey(l.finished_at)
    let g = byDay.find(x => x.key === k)
    if (!g) { g = { key: k, items: [] }; byDay.push(g) }
    g.items.push(l)
  })

  return (
    <div className="page">
      <Topbar showBack={false} showAvatar={true} />
      <div style={{ padding: '14px 16px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Log sincronizzazioni</div>
        <button onClick={load} style={{ marginLeft: 'auto', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}>↻ Aggiorna</button>
      </div>
      <div style={{ padding: '0 16px 6px', fontSize: 12, color: 'var(--text-secondary)' }}>Cosa fanno gli script ogni notte (FILE CM, prebooking, rooming).</div>

      {/* Sincronizza ora (on-demand) */}
      <div style={{ padding: '4px 16px 8px' }}>
        <div style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>⚡ Sincronizza ora</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(SCRIPTS).map(([k, v]) => {
              const busy = running[k]
              const configured = !!endpoints[k]
              return (
                <button key={k} onClick={() => runNow(k)} disabled={busy || !configured}
                  title={configured ? '' : 'Endpoint non configurato'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 11, fontSize: 12.5, fontWeight: 700,
                    cursor: busy || !configured ? 'default' : 'pointer',
                    background: busy ? v.color + '22' : (configured ? v.color : 'var(--bg-tertiary)'),
                    color: busy ? v.color : (configured ? '#fff' : 'var(--text-tertiary)'),
                    border: 'none', opacity: !configured ? 0.6 : 1,
                  }}>
                  <span>{v.emoji}</span>
                  {busy ? 'Sincronizzo…' : v.label}
                </button>
              )
            })}
          </div>
          {note && (
            <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: note.t === 'err' ? '#DC2626' : note.t === 'wait' ? '#B45309' : '#16A34A' }}>{note.m}</div>
          )}
          {Object.keys(endpoints).length === 0 && (
            <div style={{ marginTop: 9, fontSize: 11.5, color: 'var(--text-tertiary)' }}>Per attivare i pulsanti: pubblica gli script come Web App e compila <b>sync_endpoints</b> (vedi istruzioni).</div>
          )}
        </div>
      </div>

      {/* Filtro script */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '6px 16px 10px', scrollbarWidth: 'none' }}>
        {[['all', 'Tutti', '#0f172a'], ...Object.entries(SCRIPTS).map(([k, v]) => [k, v.label, v.color])].map(([k, lbl, c]) => {
          const on = filter === k
          return (
            <button key={k} onClick={() => setFilter(k)} style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              background: on ? c : 'var(--bg-secondary)', color: on ? '#fff' : 'var(--text-secondary)',
              border: '0.5px solid ' + (on ? c : 'var(--border)'),
            }}>{lbl}</button>
          )
        })}
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><p>Nessun log ancora. Comparirà dopo la prima esecuzione notturna degli script.</p></div>
      ) : (
        <div style={{ padding: '0 16px 24px' }}>
          {byDay.map(day => (
            <div key={day.key} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 2px 8px' }}>{day.key}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {day.items.map(l => {
                  const info = scriptInfo(l.script)
                  const isErr = l.status === 'error'
                  const open = openId === l.id
                  const details = Array.isArray(l.details) ? l.details : []
                  return (
                    <div key={l.id} className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: '3px solid ' + (isErr ? '#DC2626' : info.color) }}>
                      <button onClick={() => setOpenId(open ? null : l.id)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', cursor: 'pointer' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: info.color + '18' }}>{info.emoji}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10.5, fontWeight: 800, color: info.color, textTransform: 'uppercase' }}>{info.label}</span>
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 20, textTransform: 'uppercase',
                              background: isErr ? '#FEF2F2' : '#F0FDF4', color: isErr ? '#DC2626' : '#16A34A', border: '0.5px solid ' + (isErr ? '#FCA5A5' : '#BBF7D0') }}>
                              {isErr ? 'errore' : 'ok'}
                            </span>
                          </div>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{l.summary || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{fmtDateTime(l.finished_at)}{details.length > 0 ? ` · ${details.length} modifiche` : ''}</div>
                        </div>
                        {details.length > 0 && <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{open ? '▲' : '▼'}</span>}
                      </button>
                      {open && (
                        <div style={{ borderTop: '0.5px solid var(--border)', padding: '10px 14px', background: 'var(--bg-secondary)' }}>
                          {isErr && l.error && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 8 }}>⚠️ {l.error}</div>}
                          {details.length === 0 ? (
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Nessuna modifica in questa esecuzione.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {details.slice(0, 200).map((d, i) => (
                                <div key={i} style={{ fontSize: 12, background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 8, padding: '7px 10px' }}>
                                  <div style={{ fontWeight: 700 }}>{d.chiave || d.tipo || '—'} {d.destination ? <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>· {d.destination}</span> : null}</div>
                                  {d.campo && <div style={{ color: 'var(--text-secondary)', marginTop: 1 }}>{d.campo}: <span style={{ color: 'var(--text-tertiary)' }}>{shortVal(d.da)}</span> → <span style={{ color: 'var(--iv-blue)', fontWeight: 600 }}>{shortVal(d.a)}</span></div>}
                                </div>
                              ))}
                              {details.length > 200 && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>… e altre {details.length - 200} modifiche</div>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function shortVal(v) {
  if (v === null || v === undefined || v === '') return '∅'
  if (typeof v === 'object') {
    try { const s = JSON.stringify(v); return s.length > 60 ? s.slice(0, 57) + '…' : s } catch { return '{…}' }
  }
  const s = String(v)
  return s.length > 60 ? s.slice(0, 57) + '…' : s
}
