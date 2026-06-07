import { useEffect, useState } from 'react'
import Topbar from '../components/Topbar'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { SERVICES, DESTINATIONS, SHIFTS, getInitials, calcAge } from '../lib/constants'

export default function GroupDetail() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    fetchGroup()
  }, [groupId])

  async function fetchGroup() {
    const { data, error } = await supabase
      .from('groups')
      .select('*, participants(id, nome, cognome, sesso, nascita)')
      .eq('id', groupId)
      .single()
    if (!error && data) {
      setGroup(data)
      setParticipants(data.participants || [])
    }
    setLoading(false)
  }

  async function toggleService(serviceId) {
    const newVal = !group[serviceId]
    setGroup(prev => ({ ...prev, [serviceId]: newVal }))
    setSaving(serviceId)
    await supabase.from('groups').update({ [serviceId]: newVal }).eq('id', groupId)
    setSaving(null)
  }

  async function updateField(field, value) {
    setGroup(prev => ({ ...prev, [field]: value }))
  }

  async function saveField(field) {
    await supabase.from('groups').update({ [field]: group[field] }).eq('id', groupId)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!group) return <div className="loading-screen"><p>Gruppo non trovato.</p></div>

  const dest = DESTINATIONS.find(d => d.id === group.destination)
  const shift = SHIFTS[group.destination]?.find(s => s.num === group.shift_num)
  const males = participants.filter(p => p.sesso === 'M').length
  const females = participants.filter(p => p.sesso === 'F').length
  const initials = getInitials(group.capogruppo_display)

  return (
    <div className="page">
      <Topbar showBack={true} />
      </div>

      <div style={{ padding: '0 16px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 14px', borderBottom: '0.5px solid var(--border)' }}>
          <div className="initials" style={{ width: 48, height: 48, fontSize: 15 }}>{initials}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{group.capogruppo_display}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {shift?.label} · Pratica {group.pratica}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '14px 0' }}>
          <div className="stat-box" style={{ textAlign: 'center' }}>
            <div className="stat-label">Persone</div>
            <div className="stat-val">{participants.length}</div>
          </div>
          <div className="stat-box" style={{ textAlign: 'center' }}>
            <div className="stat-label">Maschi</div>
            <div className="stat-val" style={{ color: 'var(--iv-blue)' }}>{males}</div>
          </div>
          <div className="stat-box" style={{ textAlign: 'center' }}>
            <div className="stat-label">Femmine</div>
            <div className="stat-val" style={{ color: '#D4537E' }}>{females}</div>
          </div>
        </div>

        {/* Services */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
          Servizi
        </div>
        {SERVICES.map(sv => (
          <div key={sv.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '0.5px solid var(--border)', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{sv.label}</div>
              {saving === sv.id && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>Salvataggio...</div>}
            </div>
            <div
              className={`toggle ${group[sv.id] ? 'on' : ''}`}
              onClick={() => toggleService(sv.id)}
            >
              <div className="toggle-knob" />
            </div>
          </div>
        ))}

        {/* Alloggio */}
        <div style={{ marginTop: 16 }}>
          <label className="input-label">🏠 Alloggio</label>
          <input
            className="input-field"
            placeholder="Es. App. Via Roma 4 – int. 3"
            value={group.alloggio || ''}
            onChange={e => updateField('alloggio', e.target.value)}
            onBlur={() => saveField('alloggio')}
          />
        </div>

        {/* Note */}
        <div style={{ marginTop: 14 }}>
          <label className="input-label">📝 Note</label>
          <textarea
            className="input-field"
            placeholder="Note sul gruppo..."
            rows={3}
            style={{ resize: 'none', lineHeight: 1.5 }}
            value={group.note || ''}
            onChange={e => updateField('note', e.target.value)}
            onBlur={() => saveField('note')}
          />
        </div>

        {/* Participants */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Partecipanti
          </div>
          {participants.map(p => {
            const age = calcAge(p.nascita)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: p.sesso === 'M' ? 'var(--iv-blue)' : '#D4537E'
                }} />
                <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
                  {p.cognome} {p.nome}
                </div>
                {age !== null && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{age} anni</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
