import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import Topbar from '../components/Topbar'
import { FileText, MapPin, Home, Music, BedDouble, ExternalLink, Phone, Pencil, Plus, X } from 'lucide-react'

const DEST_COLORS = {
  pag: '#1E6BF1', corfu: '#059669', zante: '#D97706',
  gallipoli: '#DC2626', sardegna: '#7C3AED',
}
const CAT_EMOJI = { Alloggi: '🏠', Locali: '🎶', Market: '🛒', Ristoranti: '🍽️', Spiagge: '🏖️', Farmacia: '💊', Ospedale: '🏥', Altro: '📍' }

export default function StaffInfo() {
  const { profile, isFullAccess, canEditCassa } = useAuth()

  const turni = isFullAccess
    ? DESTINATIONS.flatMap(d => SHIFTS[d.id].map(s => ({ destination: d.id, shift_num: s.num })))
    : (profile?.assigned_shifts || [])
  const turniObj = turni.map(t => {
    const dest = DESTINATIONS.find(d => d.id === t.destination)
    if (!dest || !SHIFTS[t.destination]?.some(s => s.num === t.shift_num)) return null
    return { ...t, destName: dest.name, color: DEST_COLORS[t.destination] }
  }).filter(Boolean)

  const [sel, setSel] = useState(turniObj[0] || null)
  const [programma, setProgramma] = useState(null)
  const [poi, setPoi] = useState([])
  const [rooming, setRooming] = useState([])   // alloggi del turno
  const [editRooming, setEditRooming] = useState(false)
  const [poiSel, setPoiSel] = useState(null)   // POI aperto nella sottoscheda
  const [savingRooming, setSavingRooming] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sel) { setLoading(false); return }
    let alive = true
    async function load() {
      setLoading(true)
      const [{ data: prog }, { data: pts }, { data: room }] = await Promise.all([
        supabase.from('pax_programmi').select('*').eq('destination', sel.destination).eq('shift_num', sel.shift_num).maybeSingle(),
        supabase.from('pax_poi').select('*').eq('destination', sel.destination).eq('attivo', true).order('ordine', { ascending: true }),
        supabase.from('staff_rooming').select('alloggi').eq('destination', sel.destination).eq('shift_num', sel.shift_num).maybeSingle(),
      ])
      if (!alive) return
      setProgramma(prog || null)
      setPoi(pts || [])
      setRooming(room?.alloggi || [])
      setEditRooming(false)
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [sel?.destination, sel?.shift_num])

  const pdfUrl = programma?.pdf_path
    ? supabase.storage.from('pax-programmi').getPublicUrl(programma.pdf_path).data.publicUrl
    : null
  const alloggi = poi.filter(p => p.categoria === 'Alloggi')
  const localiMarket = poi.filter(p => p.categoria === 'Locali' || p.categoria === 'Market')

  const color = sel?.color || 'var(--iv-blue)'

  async function saveRooming(newAlloggi) {
    setSavingRooming(true)
    await supabase.from('staff_rooming').upsert(
      { destination: sel.destination, shift_num: sel.shift_num, alloggi: newAlloggi, updated_at: new Date().toISOString() },
      { onConflict: 'destination,shift_num' }
    )
    setRooming(newAlloggi)
    setSavingRooming(false)
    setEditRooming(false)
  }

  if (turniObj.length === 0) {
    return (
      <div className="page">
        <Topbar showBack={true} showAvatar={false} />
        <div className="empty-state"><p>Non hai ancora un turno assegnato.</p></div>
      </div>
    )
  }

  return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />

      {/* Hero */}
      <div style={{ padding: '4px 16px 0' }}>
        <div style={{ borderRadius: 18, padding: '20px 20px 18px', background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`, color: '#fff' }}>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>La mia settimana</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, lineHeight: 1.05 }}>
            {sel ? `${sel.destName}` : ''} <span style={{ opacity: 0.85 }}>· {sel ? shiftLabel(sel.destination, sel.shift_num) : ''}</span>
          </div>
        </div>
      </div>

      {/* Selettore turno (se più di uno) */}
      {turniObj.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 16px 4px' }}>
          {turniObj.map((t, i) => {
            const on = sel && t.destination === sel.destination && t.shift_num === sel.shift_num
            return (
              <button key={i} onClick={() => setSel(t)} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                background: on ? t.color : 'var(--bg-secondary)', color: on ? '#fff' : 'var(--text-secondary)',
                border: '0.5px solid ' + (on ? t.color : 'var(--border)'),
              }}>{t.destName} · {shiftLabel(t.destination, t.shift_num)}</button>
            )
          })}
        </div>
      )}

      <div style={{ padding: '14px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <>
            {/* Programma settimana (PDF) */}
            <Section icon={<FileText size={16} color={color} />} title="Programma della settimana" color={color}>
              {pdfUrl ? (
                <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', borderRadius: 14, background: color + '10', border: '1px solid ' + color + '33' }}>
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={22} color="#fff" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{programma?.titolo || 'Programma settimana'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Apri il PDF del programma</div>
                    </div>
                    <ExternalLink size={18} color={color} style={{ flexShrink: 0 }} />
                  </div>
                </a>
              ) : (
                <Empty text="Programma non ancora caricato per questo turno." />
              )}
            </Section>

            {/* Mappe alloggi */}
            <Section icon={<Home size={16} color={color} />} title="Mappe alloggi" color={color}>
              {alloggi.length === 0 ? <Empty text="Nessun alloggio inserito." /> : (
                <PoiGrid items={alloggi} color={color} onOpen={setPoiSel} />
              )}
            </Section>

            {/* Locali & Market */}
            <Section icon={<Music size={16} color={color} />} title="Locali & Market" color={color}>
              {localiMarket.length === 0 ? <Empty text="Nessun locale o market inserito." /> : (
                <PoiGrid items={localiMarket} color={color} onOpen={setPoiSel} />
              )}
            </Section>

            {/* Rooming staff */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                <BedDouble size={16} color={color} />
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rooming staff</span>
                {canEditCassa && !editRooming && (
                  <button onClick={() => setEditRooming(true)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, background: color + '15', color, border: '0.5px solid ' + color + '44', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    <Pencil size={12} /> Modifica
                  </button>
                )}
              </div>
              {editRooming ? (
                <RoomingEditor initial={rooming} color={color} saving={savingRooming} onSave={saveRooming} onCancel={() => setEditRooming(false)} />
              ) : rooming.length === 0 ? (
                <Empty text="Rooming non ancora inserito per questo turno." />
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {rooming.map((a, i) => (
                    <div key={i} style={{ padding: '9px 12px', borderBottom: i === rooming.length - 1 ? 'none' : '0.5px solid var(--border)' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 5 }}>🏠 {a.nome}{a.note && <span style={{ fontSize: 10.5, color: '#D97706', fontWeight: 600 }}>· ⚠️ {a.note}</span>}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.4 }}>{a.persone}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {poiSel && <PoiSheet p={poiSel} color={color} onClose={() => setPoiSel(null)} />}
    </div>
  )
}

function Section({ icon, title, color, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function PoiGrid({ items, color, onOpen }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {items.map(p => (
        <button key={p.id} onClick={() => onOpen(p)} style={{
          background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 16, cursor: 'pointer',
          padding: '14px 8px 11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, textAlign: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)', minHeight: 96,
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>{CAT_EMOJI[p.categoria] || '📍'}</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.15, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.nome}</div>
        </button>
      ))}
    </div>
  )
}

function poiCoords(url) {
  if (!url) return null
  const pats = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[?&](?:q|ll|destination|center)=(-?\d+\.\d+),(-?\d+\.\d+)/]
  for (const re of pats) { const m = url.match(re); if (m) return [parseFloat(m[1]), parseFloat(m[2])] }
  return null
}

function PoiSheet({ p, color, onClose }) {
  const coords = poiCoords(p.maps_url)
  const [imgOk, setImgOk] = useState(true)
  const mapImg = coords
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${coords[0]},${coords[1]}&zoom=15&size=640x300&markers=${coords[0]},${coords[1]},red-pushpin`
    : null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', animation: 'fadeIn .15s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '86vh', overflowY: 'auto', background: 'var(--bg-primary)', borderTopLeftRadius: 24, borderTopRightRadius: 24, boxShadow: '0 -8px 30px rgba(0,0,0,0.2)', animation: 'sheetUp .24s cubic-bezier(0.22,1,0.36,1)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 4, background: 'var(--border-mid)', margin: '10px auto 4px' }} />

        {/* Mini-mappa statica (se ci sono le coordinate) */}
        {mapImg && imgOk ? (
          <a href={p.maps_url} target="_blank" rel="noreferrer" style={{ display: 'block', margin: '8px 16px 0', borderRadius: 16, overflow: 'hidden', position: 'relative', border: '0.5px solid var(--border)' }}>
            <img src={mapImg} alt="Mappa" onError={() => setImgOk(false)} style={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', right: 10, bottom: 10, background: color, color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={13} color="#fff" /> Apri in Maps
            </div>
          </a>
        ) : null}

        <div style={{ padding: '16px 20px 26px' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.categoria}</div>
          <div style={{ fontSize: 21, fontWeight: 800, marginTop: 2 }}>{p.nome}</div>
          {p.descrizione && <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>{p.descrizione}</div>}

          <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
            {p.maps_url && (
              <a href={p.maps_url} target="_blank" rel="noreferrer" style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: color, color: '#fff', fontSize: 14, fontWeight: 700, padding: '13px', borderRadius: 13 }}>
                <MapPin size={17} color="#fff" /> Apri in Google Maps
              </a>
            )}
            {p.telefono && (
              <a href={`tel:${p.telefono}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, padding: '13px 18px', borderRadius: 13, border: '0.5px solid var(--border)' }}>
                <Phone size={16} /> Chiama
              </a>
            )}
          </div>
          {!coords && p.maps_url && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 10 }}>Anteprima mappa non disponibile per questo link — il pulsante apre comunque la posizione.</div>}
        </div>
      </div>
    </div>
  )
}

function PoiRow({ p, color, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: last ? 'none' : '0.5px solid var(--border)' }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{CAT_EMOJI[p.categoria] || '📍'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
        {p.descrizione && <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.descrizione}</div>}
      </div>
      {p.telefono && (
        <a href={`tel:${p.telefono}`} style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Phone size={15} color="var(--text-secondary)" />
        </a>
      )}
      {p.maps_url && (
        <a href={p.maps_url} target="_blank" rel="noreferrer" style={{ width: 32, height: 32, borderRadius: 9, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <MapPin size={15} color="#fff" />
        </a>
      )}
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '14px 16px', borderRadius: 12, background: 'var(--bg-secondary)', border: '0.5px solid var(--border)' }}>{text}</div>
}

function RoomingEditor({ initial, color, saving, onSave, onCancel }) {
  const [list, setList] = useState(() => (initial || []).map((a, i) => ({ id: a.id || 'a' + i, nome: a.nome || '', persone: a.persone || '', note: a.note || '' })))
  const upd = (i, k, v) => setList(l => l.map((a, j) => j === i ? { ...a, [k]: v } : a))
  const add = () => setList(l => [...l, { id: 'a' + Date.now(), nome: '', persone: '', note: '' }])
  const del = (i) => setList(l => l.filter((_, j) => j !== i))
  const inp = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '0.5px solid var(--border)', background: 'var(--bg-secondary)', fontSize: 13, color: 'var(--text-primary)', outline: 'none' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.map((a, i) => (
        <div key={a.id} className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input style={{ ...inp, fontWeight: 700 }} placeholder="Nome alloggio (es. 6 ionian)" value={a.nome} onChange={e => upd(i, 'nome', e.target.value)} />
            <button onClick={() => del(i)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0, padding: 4 }}><X size={18} /></button>
          </div>
          <textarea style={{ ...inp, resize: 'vertical', minHeight: 56, lineHeight: 1.5 }} placeholder="Persone (scrivi i nomi separati da virgola)" value={a.persone} onChange={e => upd(i, 'persone', e.target.value)} />
          <input style={inp} placeholder="Nota (facoltativa)" value={a.note} onChange={e => upd(i, 'note', e.target.value)} />
        </div>
      ))}
      <button onClick={add} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '0.5px solid var(--border)', borderRadius: 9, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        <Plus size={15} /> Aggiungi alloggio
      </button>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button onClick={() => onSave(list.filter(a => a.nome.trim() || a.persone.trim()))} disabled={saving}
          style={{ flex: 1, padding: '12px', borderRadius: 11, border: 'none', background: color, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Salvo...' : 'Salva rooming'}
        </button>
        <button onClick={onCancel} style={{ padding: '12px 18px', borderRadius: 11, border: '0.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Annulla</button>
      </div>
    </div>
  )
}
