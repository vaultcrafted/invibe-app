import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SERVICES, DESTINATIONS, SHIFTS, getInitials, calcAge } from '../lib/constants'
import { ChevronLeft, Edit2 } from 'lucide-react'

// Icone servizi custom
const ServiceIcons = {
  pkg_escursioni: () => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  tassa_soggiorno: () => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21v-4a3 3 0 0 1 6 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  pkg_ssp: () => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  cauzione: () => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
}

export default function GroupDetail() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [editingAlloggio, setEditingAlloggio] = useState(false)
  const [editingNote, setEditingNote] = useState(false)

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
  async function saveField(field) {
    await supabase.from('groups').update({ [field]: group[field] }).eq('id', groupId)
    if (field === 'alloggio') setEditingAlloggio(false)
    if (field === 'note') setEditingNote(false)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!group) return <div className="loading-screen"><p>Gruppo non trovato.</p></div>

  const dest = DESTINATIONS.find(d => d.id === group.destination)
  const shift = SHIFTS[group.destination]?.find(s => s.num === group.shift_num)
  const nPax = participants.length
  const males = participants.filter(p => p.sesso === 'M').length
  const females = participants.filter(p => p.sesso === 'F').length

  const costoTotale = SERVICES.reduce((tot, sv) => group[sv.id] ? tot + sv.prezzo * nPax : tot, 0)

  return (
    <div className="page" style={{ paddingBottom: 0 }}>

      {/* Header blu */}
      <div style={{ background: 'var(--iv-blue)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ChevronLeft size={18} color="#fff" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{group.capogruppo_display}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
            {dest?.name} · {shift?.label || `Turno ${group.shift_num}`}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px 120px', maxWidth: 900, margin: '0 auto' }}>

        {/* Layout desktop: 2 colonne, mobile: 1 colonna */}
        <style>{`
          .group-detail-grid { display: flex; flex-direction: column; gap: 20px; }
          @media (min-width: 701px) { .group-detail-grid { flex-direction: row; } }
          @media (min-width: 701px) { .group-detail-left { flex: 1; min-width: 0; } }
          @media (min-width: 701px) { .group-detail-right { width: 340px; flex-shrink: 0; } }
        `}</style>
        <div className="group-detail-grid">
          <div className="group-detail-left" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <StatCard label="Persone" value={nPax} icon={
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" stroke="#1E6BF1" strokeWidth="1.8"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="#1E6BF1" strokeWidth="1.8" strokeLinecap="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87" stroke="#1E6BF1" strokeWidth="1.8" strokeLinecap="round"/></svg>
              } color="#1E6BF1" />
              <StatCard label="Maschi" value={males} icon={
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="5" stroke="#1E6BF1" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#1E6BF1" strokeWidth="1.8" strokeLinecap="round"/></svg>
              } color="#1E6BF1" />
              <StatCard label="Femmine" value={females} icon={
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="5" stroke="#D4537E" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#D4537E" strokeWidth="1.8" strokeLinecap="round"/></svg>
              } color="#D4537E" />
            </div>

            {/* Servizi */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Servizi acquistati</div>
              <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {SERVICES.map((sv, i) => {
                  const Icon = ServiceIcons[sv.id] || ServiceIcons.pkg_escursioni
                  const active = !!group[sv.id]
                  const isSaving = saving === sv.id
                  return (
                    <div key={sv.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i < SERVICES.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                      onClick={() => toggleService(sv.id)}>
                      {/* Icona */}
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: active ? 'rgba(30,107,241,0.08)' : 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? 'var(--iv-blue)' : 'var(--text-tertiary)', flexShrink: 0, transition: 'all 0.2s' }}>
                        <Icon />
                      </div>
                      {/* Label */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{sv.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          €{sv.prezzo} × {nPax} pax = <span style={{ fontWeight: 600, color: active ? 'var(--iv-blue)' : 'var(--text-tertiary)' }}>€{sv.prezzo * nPax}</span>
                          {isSaving && <span style={{ marginLeft: 8, fontSize: 10 }}>salvo...</span>}
                        </div>
                      </div>
                      {/* Toggle */}
                      <div style={{ width: 46, height: 26, borderRadius: 13, background: active ? 'var(--iv-blue)' : '#D1D5DB', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: active ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Riepilogo totale */}
            {costoTotale > 0 && (
              <div style={{ background: 'var(--iv-blue)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Totale da incassare</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{SERVICES.filter(sv => group[sv.id]).map(sv => sv.label).join(' + ')}</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>€{costoTotale}</div>
              </div>
            )}

            {/* Alloggio */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🏠</span> Alloggio
              </div>
              {editingAlloggio ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input-field" style={{ flex: 1 }} placeholder="Es. App. Via Roma 4 – int. 3" value={group.alloggio || ''} onChange={e => updateField('alloggio', e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && saveField('alloggio')} />
                  <button onClick={() => saveField('alloggio')} style={{ padding: '0 16px', background: 'var(--iv-blue)', color: '#fff', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Salva</button>
                </div>
              ) : (
                <div onClick={() => setEditingAlloggio(true)} style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 12, border: '0.5px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
                  <span style={{ fontSize: 14, color: group.alloggio ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{group.alloggio || 'Nessun alloggio inserito'}</span>
                  <Edit2 size={14} color="var(--text-tertiary)" />
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📝</span> Note
              </div>
              {editingNote ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea className="input-field" rows={3} style={{ resize: 'none', lineHeight: 1.6 }} placeholder="Note sul gruppo..." value={group.note || ''} onChange={e => updateField('note', e.target.value)} autoFocus />
                  <button onClick={() => saveField('note')} style={{ alignSelf: 'flex-end', padding: '8px 20px', background: 'var(--iv-blue)', color: '#fff', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Salva</button>
                </div>
              ) : (
                <div onClick={() => setEditingNote(true)} style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 12, border: '0.5px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, minHeight: 60 }}>
                  <span style={{ fontSize: 14, color: group.note ? 'var(--text-primary)' : 'var(--text-tertiary)', lineHeight: 1.5, flex: 1 }}>{group.note || 'Nessuna nota'}</span>
                  <Edit2 size={14} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: 2 }} />
                </div>
              )}
            </div>

          </div>

          {/* COLONNA DESTRA — Partecipanti */}
          <div className="group-detail-right">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Partecipanti ({nPax})
            </div>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {participants.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Nessun partecipante</div>
              ) : participants.map((p, i) => {
                const isMale = p.sesso === 'M'
                const color = isMale ? '#1E6BF1' : '#D4537E'
                const age = calcAge(p.nascita)
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < participants.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: color + '15', border: '1.5px solid ' + color + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
                      {getInitials(p.nome + ' ' + p.cognome)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>{p.cognome} {p.nome}</div>
                      {age !== null && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{age} anni</div>}
                    </div>
                    <div style={{ width: 24, height: 24, borderRadius: 8, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>
                      {p.sesso}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: color === '#D4537E' ? 'rgba(212,83,126,0.08)' : 'rgba(30,107,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}
