import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { User, Mail, Phone, FileText, Shield, Lock, Check, X, Edit2, MapPin } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import Topbar from '../components/Topbar'

const RUOLO_COLORS = {
  CM: '#1E6BF1', ACM: '#2E86C1', CA: '#8E44AD', SUPERVISOR: '#D4AC0D',
  ARM: '#E67E22', RM: '#16A085', DJ: '#C0392B', FOTO: '#2ECC71',
  VIDEO: '#E74C3C', VOCALIST: '#9B59B6', BALLERINO: '#1ABC9C',
  BALLERINA: '#F39C12', ACA: '#27AE60', 'STAFF U': '#5D6D7E',
  'STAFF D': '#7F8C8D', UFFICIO: '#2C3E50',
}
function getRuoloColor(ruolo) {
  if (!ruolo) return 'var(--iv-blue)'
  for (const key of Object.keys(RUOLO_COLORS)) {
    if (ruolo.toUpperCase().includes(key)) return RUOLO_COLORS[key]
  }
  return 'var(--iv-blue)'
}

export default function StaffProfile() {
  const { staffId } = useParams()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [staff, setStaff] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStaff()
  }, [staffId])

  async function fetchStaff() {
    setLoading(true)
    const { data } = await supabase
      .from('staff_profiles')
      .select('*')
      .eq('id', staffId)
      .single()
    if (data) {
      setStaff(data)
      setForm({ nome: data.nome || '', cognome: data.cognome || '', telefono: data.telefono || '', ruolo: data.ruolo || '' })
    }
    setLoading(false)
  }


  if (loading) return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  )

  if (!staff) return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />
      <div className="empty-state"><p>Staff non trovato.</p></div>
    </div>
  )

  const initials = ((staff.nome?.[0] || '') + (staff.cognome?.[0] || '')).toUpperCase()
  const ruoloColor = getRuoloColor(staff.ruolo)
  const assigned = staff.assigned_shifts || []

  return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, var(--iv-blue-light) 0%, var(--bg-primary) 100%)',
        padding: '28px 16px 20px', textAlign: 'center'
      }}>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: ruoloColor, border: '3px solid #fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 auto'
          }}>{initials}</div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
          {staff.nome} {staff.cognome}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {staff.role === 'admin' && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#FEF9C3', color: '#854D0E', border: '0.5px solid #FDE047' }}>⭐ Admin</span>
          )}
          {staff.ruolo && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: ruoloColor + '18', color: ruoloColor, border: '0.5px solid ' + ruoloColor + '44' }}>
              {staff.ruolo}
            </span>
          )}
        </div>
        {assigned.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {assigned.map((a, i) => {
              const d = DESTINATIONS.find(d => d.id === a.destination)
              return (
                <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <MapPin size={9} />{d?.name || a.destination} {shiftLabel(a.destination, a.shift_num)}
                </span>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Informazioni profilo */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Informazioni profilo</div>
          <ProfileRow icon={<User size={16} color="var(--iv-blue)" />} label="Nome" value={staff.nome} />
          <ProfileRow icon={<User size={16} color="var(--iv-blue)" />} label="Cognome" value={staff.cognome} />
          <ProfileRow icon={<Shield size={16} color={ruoloColor} />} label="Ruolo" value={staff.ruolo} isLast={true} />
        </div>

        {/* Contatti */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Contatti</div>
          <ProfileRow icon={<Mail size={16} color="var(--iv-blue)" />} label="Email" value={staff.email} />
          <ProfileRow icon={<Phone size={16} color="var(--iv-blue)" />} label="Telefono" value={staff.telefono} isLast={true} />
        </div>

        {/* I miei turni */}
        {staff.assigned_shifts?.length > 0 && (
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Turni assegnati</div>
            {staff.assigned_shifts.map((s, i) => {
              const dest = DESTINATIONS.find(d => d.id === s.destination)
              const shift = SHIFTS[s.destination]?.find(sh => sh.num === s.shift_num)
              const isLast = i === staff.assigned_shifts.length - 1
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: isLast ? 'none' : '0.5px solid var(--border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--iv-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MapPin size={16} color="var(--iv-blue)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{dest?.name || s.destination} · {shiftLabel(s.destination, s.shift_num)}</div>
                    {shift && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{shift.label}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Attestati */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Attestati</div>
          <AttestatoRow staffId={staffId} field="att_antincendio" label="Antincendio" current={staff.att_antincendio} isAdmin={isAdmin} onUpdate={fetchStaff} />
          <AttestatoRow staffId={staffId} field="att_primo_soccorso" label="Primo Soccorso" current={staff.att_primo_soccorso} isAdmin={isAdmin} onUpdate={fetchStaff} />
          <AttestatoRow staffId={staffId} field="att_blsd" label="BLSD" current={staff.att_blsd} isAdmin={isAdmin} onUpdate={fetchStaff} isLast={true} />
        </div>

        {/* Gestione account — solo admin */}
        {isAdmin && (
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Gestione account</div>

          {!changingPwd ? (
            <button onClick={() => setChangingPwd(true)} style={{ width: '100%', padding: '13px', background: 'var(--iv-blue)', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer' }}>
              <Lock size={16} /> Reimposta password
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="input-field" type="password" placeholder="Nuova password" value={pwdForm.newPwd} onChange={e => setPwdForm(f => ({...f, newPwd: e.target.value}))} />
              <input className="input-field" type="password" placeholder="Conferma password" value={pwdForm.confirmPwd} onChange={e => setPwdForm(f => ({...f, confirmPwd: e.target.value}))} />
              {pwdMsg && (
                <div style={{ fontSize: 13, color: pwdMsg.includes('✅') ? 'var(--success)' : 'var(--danger)', background: pwdMsg.includes('✅') ? 'var(--success-light)' : 'var(--danger-light)', padding: '8px 12px', borderRadius: 8 }}>
                  {pwdMsg}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setChangingPwd(false); setPwdMsg(''); setPwdForm({ newPwd: '', confirmPwd: '' }) }} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Annulla
                </button>
                <button onClick={changePassword} disabled={pwdSaving} style={{ flex: 2, padding: '11px', background: 'var(--iv-blue)', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  {pwdSaving ? 'Aggiorno...' : 'Aggiorna'}
                </button>
              </div>
            </div>
          )}
        </div>
        )}

      </div>
    </div>
  )
}

function ProfileRow({ icon, label, value, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: isLast ? 'none' : '0.5px solid var(--border)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--iv-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 500, color: value ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{value || '—'}</div>
      </div>
    </div>
  )
}

function AttestatoRow({ staffId, field, label, current, isAdmin, onUpdate, isLast }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'application/pdf') { setError('Solo file PDF'); return }
    setError('')
    setUploading(true)
    try {
      const path = `${staffId}/${field}.pdf`
      const { error: upErr } = await supabase.storage.from('attestati').upload(path, file, { upsert: true, contentType: 'application/pdf' })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('attestati').getPublicUrl(path)
      // Aggiungi timestamp per evitare cache
      const urlWithVersion = `${publicUrl}?v=${Date.now()}`
      await supabase.from('staff_profiles').update({ [field]: urlWithVersion }).eq('id', staffId)
      await onUpdate()
    } catch (err) {
      setError('Errore caricamento')
      console.error(err)
    }
    setUploading(false)
  }

  async function handleDelete() {
    setUploading(true)
    const path = `${staffId}/${field}.pdf`
    await supabase.storage.from('attestati').remove([path])
    await supabase.from('staff_profiles').update({ [field]: null }).eq('id', staffId)
    await onUpdate()
    setUploading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: isLast ? 'none' : '0.5px solid var(--border)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: current ? 'rgba(5,150,105,0.1)' : 'var(--iv-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <FileText size={18} color={current ? '#059669' : 'var(--iv-blue)'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: current ? '#059669' : 'var(--text-tertiary)', marginTop: 1 }}>
          {error ? <span style={{ color: 'var(--danger)' }}>{error}</span> : current ? '✓ Caricato' : 'Non caricato'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {current && (
          <a href={current} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--iv-blue)', padding: '6px 12px', borderRadius: 8, textDecoration: 'none' }}>
            Scarica
          </a>
        )}
        {isAdmin && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--iv-blue)', border: '1px solid var(--iv-blue)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}>
              {uploading ? '...' : current ? 'Sostituisci' : 'Carica'}
              <input type="file" accept="application/pdf" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>
            {current && (
              <button onClick={handleDelete} disabled={uploading} style={{ fontSize: 12, color: 'var(--danger)', border: '1px solid #FECACA', background: 'var(--danger-light)', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
                ✕
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
