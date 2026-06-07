import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { DESTINATIONS } from '../lib/constants'

export default function StaffList() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('staff_profiles').select('*').order('cognome').then(({ data }) => {
      setStaff(data || [])
      setLoading(false)
    })
  }, [])

  const filtered = staff.filter(s =>
    !search || `${s.nome} ${s.cognome}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page">
      <div className="topbar">
        <button className="topbar-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div className="topbar-info">
          <div className="topbar-title">Staff</div>
          <div className="topbar-sub">{staff.length} membri</div>
        </div>
      </div>

      <div className="search-bar">
        <Search size={15} color="var(--text-tertiary)" />
        <input placeholder="Cerca staff..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : (
        <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(s => {
            const initials = ((s.nome?.[0] || '') + (s.cognome?.[0] || '')).toUpperCase()
            const assigned = s.assigned_shifts || []
            return (
              <div key={s.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="initials" style={{ width: 40, height: 40, fontSize: 13 }}>{initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.nome} {s.cognome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {s.role === 'admin' ? '⭐ Admin' : assigned.length === 0 ? 'Nessun turno assegnato' :
                      assigned.map(a => {
                        const d = DESTINATIONS.find(d => d.id === a.destination)
                        return `${d?.name || a.destination} T${a.shift_num}`
                      }).join(' · ')
                    }
                  </div>
                </div>
                {s.role === 'admin' && (
                  <span className="badge badge-blue">Admin</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
