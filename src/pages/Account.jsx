import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Mail, Phone, User, FileText, Shield, MapPin } from 'lucide-react'
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

export default function Account() {
  const { profile, signOut, fetchProfile, user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [attestati, setAttestati] = useState({})
  const initials = ((profile?.nome?.[0] || '') + (profile?.cognome?.[0] || '')).toUpperCase()
  const ruoloColor = getRuoloColor(profile?.ruolo)
  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : null

  useEffect(() => {
    if (!profile?.id) return
    async function fetchAttestati() {
      const { data: files } = await supabase.storage.from('attestati').list(profile.id)
      if (!files) return
      const urls = {}
      for (const file of files) {
        const stem = file.name.replace('.pdf', '')
        const { data } = supabase.storage.from('attestati').getPublicUrl(`${profile.id}/${file.name}`)
        urls[stem] = data.publicUrl
      }
      setAttestati(urls)
    }
    fetchAttestati()
  }, [profile?.id])

  async function handleLogout() { await signOut(); navigate('/login') }

  return (
    <div className="page">
      <Topbar showBack={true} showAvatar={false} />

      {/* Hero avatar */}
      <div style={{ background: 'linear-gradient(180deg, var(--iv-blue-light) 0%, var(--bg-primary) 100%)', padding: '28px 16px 20px', textAlign: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#fff', border: '3px solid #fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            overflow: 'hidden', margin: '0 auto'
          }}>
            <img src="/profile-icon.png" alt="Account" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <div style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' }} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{profile?.nome} {profile?.cognome}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {profile?.role === 'admin' && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#FEF9C3', color: '#854D0E', border: '0.5px solid #FDE047' }}>⭐ Admin</span>
          )}
          {profile?.ruolo && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: ruoloColor + '18', color: ruoloColor, border: '0.5px solid ' + ruoloColor + '44' }}>{profile.ruolo}</span>
          )}
        </div>
        {lastSignIn && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>Ultimo accesso: {lastSignIn}</div>}
      </div>

      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Informazioni profilo */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Informazioni profilo</div>
          <ProfileRow icon={<User size={16} color="var(--iv-blue)" />} label="Nome" value={profile?.nome} />
          <ProfileRow icon={<User size={16} color="var(--iv-blue)" />} label="Cognome" value={profile?.cognome} isLast={true} />
        </div>

        {/* Contatti */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Contatti</div>
          <ProfileRow icon={<Mail size={16} color="var(--iv-blue)" />} label="Email" value={user?.email?.replace('@invibe.it','')} />
          <ProfileRow icon={<Phone size={16} color="var(--iv-blue)" />} label="Telefono" value={profile?.telefono} isLast={true} />
        </div>

        {/* I miei turni */}
        {(profile?.assigned_shifts?.length > 0 || true) && (
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>I miei turni</div>
            {!profile?.assigned_shifts?.length ? (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun turno assegnato</div>
            ) : profile.assigned_shifts.map((s, i) => {
              const dest = DESTINATIONS.find(d => d.id === s.destination)
              const shift = SHIFTS[s.destination]?.find(sh => sh.num === s.shift_num)
              const isLast = i === profile.assigned_shifts.length - 1
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
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>I miei attestati</div>
          <AttestatoDownload label="Antincendio" url={attestati.antincendio} />
          <AttestatoDownload label="Primo Soccorso" url={attestati.psa} />
          <AttestatoDownload label="BLSD" url={attestati.blsd} isLast={true} />
        </div>

        {/* Logout */}
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 10, background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 14, fontWeight: 600, width: '100%', border: '0.5px solid #FECACA' }}>
          <LogOut size={16} /> Esci dall'account
        </button>

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

function AttestatoDownload({ label, url, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: isLast ? 'none' : '0.5px solid var(--border)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: url ? 'rgba(5,150,105,0.1)' : 'var(--iv-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <FileText size={18} color={url ? '#059669' : 'var(--iv-blue)'} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: url ? '#059669' : 'var(--text-tertiary)', marginTop: 1 }}>{url ? '✓ Disponibile' : 'Non ancora caricato'}</div>
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--iv-blue)', padding: '7px 14px', borderRadius: 8, textDecoration: 'none' }}>
          Scarica PDF
        </a>
      ) : (
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '5px 10px', borderRadius: 8, border: '0.5px solid var(--border)' }}>—</span>
      )}
    </div>
  )
}
