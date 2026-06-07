import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut, FileText, Shield, Edit2, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Account() {
  const { profile, signOut, fetchProfile, user } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    nome: profile?.nome || '',
    cognome: profile?.cognome || '',
    telefono: profile?.telefono || '',
  })
  const [saving, setSaving] = useState(false)

  const initials = ((profile?.nome?.[0] || '') + (profile?.cognome?.[0] || '')).toUpperCase()

  async function saveProfile() {
    setSaving(true)
    await supabase.from('staff_profiles').update({
      nome: form.nome,
      cognome: form.cognome,
      telefono: form.telefono,
    }).eq('id', user.id)
    await fetchProfile(user.id)
    setSaving(false)
    setEditing(false)
  }

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="page">
      <div className="topbar">
        <button className="topbar-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div className="topbar-info">
          <div className="topbar-title">Il mio account</div>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Avatar + nome */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0 8px', gap: 12 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--iv-blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color: '#fff',
          }}>{initials}</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{profile?.nome} {profile?.cognome}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {profile?.role === 'admin' ? '⭐ Admin' : 'Staff'}
            </div>
          </div>
        </div>

        {/* Info personali */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Dati personali
            </div>
            <button
              onClick={() => editing ? saveProfile() : setEditing(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--iv-blue)', fontWeight: 600 }}
            >
              {editing ? <><Check size={14} /> Salva</> : <><Edit2 size={14} /> Modifica</>}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <InfoRow label="Nome" value={form.nome} editing={editing} onChange={v => setForm(f => ({...f, nome: v}))} />
            <InfoRow label="Cognome" value={form.cognome} editing={editing} onChange={v => setForm(f => ({...f, cognome: v}))} />
            <InfoRow label="Email" value={user?.email || ''} editing={false} />
            <InfoRow label="Telefono" value={form.telefono} editing={editing} onChange={v => setForm(f => ({...f, telefono: v}))} placeholder="Es. +39 333 1234567" />
          </div>
        </div>

        {/* Documenti */}
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
            Documenti
          </div>
          <DocRow icon={<FileText size={18} color="var(--iv-blue)" />} label="Contratto estivo" sublabel="Stagione 2026" />
          <DocRow icon={<Shield size={18} color="var(--iv-blue)" />} label="Assicurazione" sublabel="Polizza staff" />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px', borderRadius: 'var(--radius-md)',
            background: 'var(--danger-light)', color: 'var(--danger)',
            fontSize: 14, fontWeight: 600, width: '100%',
          }}
        >
          <LogOut size={16} />
          Esci dall'account
        </button>

      </div>
    </div>
  )
}

function InfoRow({ label, value, editing, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0', borderBottom: '0.5px solid var(--border)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', width: 72, flexShrink: 0 }}>{label}</div>
      {editing && onChange ? (
        <input
          className="input-field"
          style={{ flex: 1, padding: '6px 8px', fontSize: 14 }}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''}
        />
      ) : (
        <div style={{ fontSize: 14, color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', flex: 1 }}>
          {value || '—'}
        </div>
      )}
    </div>
  )
}

function DocRow({ icon, label, sublabel }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0', borderBottom: '0.5px solid var(--border)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'var(--iv-blue-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{sublabel}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Presto disponibile</div>
    </div>
  )
}
