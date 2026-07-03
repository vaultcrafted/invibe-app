import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import Topbar from '../components/Topbar'
import { FileText, MapPin, Home, Music, ShoppingCart, BedDouble, ExternalLink, Phone } from 'lucide-react'

const DEST_COLORS = {
  pag: '#1E6BF1', corfu: '#059669', zante: '#D97706',
  gallipoli: '#DC2626', sardegna: '#7C3AED',
}
const CAT_EMOJI = { Alloggi: '🏠', Locali: '🎶', Market: '🛒', Ristoranti: '🍽️', Spiagge: '🏖️', Farmacia: '💊', Ospedale: '🏥', Altro: '📍' }

export default function StaffInfo() {
  const { profile, isFullAccess } = useAuth()

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sel) { setLoading(false); return }
    let alive = true
    async function load() {
      setLoading(true)
      const [{ data: prog }, { data: pts }] = await Promise.all([
        supabase.from('pax_programmi').select('*').eq('destination', sel.destination).eq('shift_num', sel.shift_num).maybeSingle(),
        supabase.from('pax_poi').select('*').eq('destination', sel.destination).eq('attivo', true).order('ordine', { ascending: true }),
      ])
      if (!alive) return
      setProgramma(prog || null)
      setPoi(pts || [])
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

      <div style={{ padding: '14px 16px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alloggi.map(p => <PoiRow key={p.id} p={p} color={color} />)}
                </div>
              )}
            </Section>

            {/* Locali & Market */}
            <Section icon={<Music size={16} color={color} />} title="Locali & Market" color={color}>
              {localiMarket.length === 0 ? <Empty text="Nessun locale o market inserito." /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {localiMarket.map(p => <PoiRow key={p.id} p={p} color={color} />)}
                </div>
              )}
            </Section>

            {/* Rooming staff */}
            <Section icon={<BedDouble size={16} color={color} />} title="Rooming staff" color={color}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px', borderRadius: 14, background: 'var(--bg-secondary)', border: '0.5px dashed var(--border)' }}>
                <BedDouble size={20} color="var(--text-tertiary)" />
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Disponibile a breve — il rooming dello staff verrà pubblicato qui.</div>
              </div>
            </Section>
          </>
        )}
      </div>
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

function PoiRow({ p, color }) {
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{CAT_EMOJI[p.categoria] || '📍'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.categoria}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{p.nome}</div>
          {p.descrizione && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.descrizione}</div>}
        </div>
        {p.telefono && (
          <a href={`tel:${p.telefono}`} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Phone size={16} color="var(--text-secondary)" />
          </a>
        )}
        {p.maps_url && (
          <a href={p.maps_url} target="_blank" rel="noreferrer" style={{ width: 36, height: 36, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MapPin size={16} color="#fff" />
          </a>
        )}
      </div>
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '14px 16px', borderRadius: 12, background: 'var(--bg-secondary)', border: '0.5px solid var(--border)' }}>{text}</div>
}
