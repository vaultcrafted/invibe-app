import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SERVICES, DESTINATIONS, SHIFTS, getInitials, calcAge } from '../lib/constants'
import Topbar from '../components/Topbar'

export default function GroupDetail() {
  const { groupId } = useParams()
  const [group, setGroup] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => { fetchGroup() }, [groupId])

  async function fetchGroup() {
    const { data } = await supabase
      .from('groups')
      .select('*, participants(id, nome, cognome, sesso, nascita)')
      .eq('id', groupId)
      .single()
    if (data) { setGroup(data); setParticipants(data.participants || []) }
    setLoading(false)
  }

  async function toggleService(serviceId) {
    const newVal = !group[serviceId]
    setGroup(prev => ({ ...prev, [serviceId]: newVal }))
    setSaving(serviceId)
    await supabase.from('groups').update({ [serviceId]: newVal }).eq('id', groupId)
    setSaving(null)
  }

  async function updateField(field, value) { setGroup(prev => ({ ...prev, [field]: value })) }
  async function saveField(field) { await supabase.from('groups').update({ [field]: group[field] }).eq('id', groupId) }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!group) return <div className="loading-screen"><p>Gruppo non trovato.</p></div>

  const dest = DESTINATIONS.find(d => d.id === group.destination)
  const shift = SHIFTS[group.destination]?.find(s => s.num === group.shift_num)
  const nPax = participants.length
  const males = participants.filter(p => p.sesso === 'M').length
  const females = participants.filter(p => p.sesso === 'F').length
  const initials = getInitials(group.capogruppo_display)

  // Calcolo costi
  const costoTotale = SERVICES.reduce((tot, sv) => {
    if (!group[sv.id]) return tot
    return tot + sv.prezzo * nPax
  }, 0)

  const serviziAttivi = SERVICES.filter(sv => group[sv.id])

  return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />
      <div style={{ padding: '0 16px 32px' }}>

        {/* Header gruppo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 14px', borderBottom: '0.5px solid var(--border)' }}>
          <div className="initials" style={{ width: 48, height: 48, fontSize: 15 }}>{initials}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{group.capogruppo_display}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {dest?.name} · {shift ? `${shift.label}` : `Turno ${group.shift_num}`}
            </div>
          </div>
        </div>

        {/* Stats pax */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '14px 0' }}>
          <div className="stat-box" style={{ textAlign: 'center' }}><div className="stat-label">Persone</div><div className="stat-val">{nPax}</div></div>
          <div className="stat-box" style={{ textAlign: 'center' }}><div className="stat-label">Maschi</div><div className="stat-val" style={{ color: 'var(--iv-blue)' }}>{males}</div></div>
          <div className="stat-box" style={{ textAlign: 'center' }}><div className="stat-label">Femmine</div><div className="stat-val" style={{ color: '#D4537E' }}>{females}</div></div>
        </div>

        {/* Servizi toggle */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 }}>Servizi acquistati</div>
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          {SERVICES.map((sv, i) => (
            <div key={sv.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: i < SERVICES.length - 1 ? '0.5px solid var(--border)' : 'none', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{sv.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  €{sv.prezzo} × {nPax} pax = <span style={{ fontWeight: 600, color: group[sv.id] ? 'var(--iv-blue)' : 'var(--text-tertiary)' }}>€{sv.prezzo * nPax}</span>
                  {saving === sv.id && <span style={{ marginLeft: 6, color: 'var(--text-tertiary)' }}>salvo...</span>}
                </div>
              </div>
              <div className={`toggle ${group[sv.id] ? 'on' : ''}`} onClick={() => toggleService(sv.id)}>
                <div className="toggle-knob" />
              </div>
            </div>
          ))}
        </div>

        {/* Riepilogo costi */}
        {serviziAttivi.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Riepilogo da incassare</div>
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
              {/* Header tabella */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Servizio</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', textAlign: 'right' }}>€/pax</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', textAlign: 'right', minWidth: 70 }}>Totale</div>
              </div>
              {serviziAttivi.map((sv, i) => (
                <div key={sv.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, padding: '11px 16px', borderBottom: i < serviziAttivi.length - 1 ? '0.5px solid var(--border)' : 'none', alignItems: 'center' }}>
                  <div style={{ fontSize: 13 }}>{sv.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right' }}>€{sv.prezzo}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', minWidth: 70 }}>€{sv.prezzo * nPax}</div>
                </div>
              ))}
              {/* Totale */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '12px 16px', background: 'var(--iv-blue)', alignItems: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>TOTALE GRUPPO</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', textAlign: 'right' }}>€{costoTotale}</div>
              </div>
            </div>
          </>
        )}

        {/* Alloggio */}
        <div style={{ marginTop: 4 }}>
          <label className="input-label">🏠 Alloggio</label>
          <input className="input-field" placeholder="Es. App. Via Roma 4 – int. 3" value={group.alloggio || ''} onChange={e => updateField('alloggio', e.target.value)} onBlur={() => saveField('alloggio')} />
        </div>

        {/* Note */}
        <div style={{ marginTop: 14 }}>
          <label className="input-label">📝 Note</label>
          <textarea className="input-field" placeholder="Note sul gruppo..." rows={3} style={{ resize: 'none', lineHeight: 1.5 }} value={group.note || ''} onChange={e => updateField('note', e.target.value)} onBlur={() => saveField('note')} />
        </div>

        {/* Lista partecipanti */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Partecipanti ({nPax})
          </div>
          {participants.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < participants.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.sesso === 'M' ? 'rgba(30,107,241,0.1)' : 'rgba(212,83,126,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: p.sesso === 'M' ? 'var(--iv-blue)' : '#D4537E', flexShrink: 0 }}>
                {getInitials(p.nome + ' ' + p.cognome)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nome} {p.cognome}</div>
                {p.nascita && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{calcAge(p.nascita)} anni</div>}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: p.sesso === 'M' ? 'rgba(30,107,241,0.08)' : 'rgba(212,83,126,0.08)', color: p.sesso === 'M' ? 'var(--iv-blue)' : '#D4537E' }}>
                {p.sesso}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
