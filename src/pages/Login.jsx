import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const email = username.includes('@') ? username : username.toLowerCase() + '@invibe.it'
      await signIn(email, password, rememberMe)
      navigate('/')
    } catch (err) {
      setError('Username o password errati.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px', background: '#fff' }}>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <img src="/logo_login.png" alt="Invibe" style={{ height: 150, objectFit: 'contain', marginBottom: 20 }} />
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Staff App — Summer 2026
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Username */}
        <div>
          <label className="input-label">Username</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'absolute', left: 12, pointerEvents: 'none' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4" stroke="var(--text-tertiary)" strokeWidth="2"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <input
              className="input-field"
              style={{ paddingLeft: 38 }}
              type="text"
              placeholder="nomecognome"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              name="username"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="input-label">Password</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'absolute', left: 12, pointerEvents: 'none' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="var(--text-tertiary)" strokeWidth="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="16" r="1.5" fill="var(--text-tertiary)"/>
              </svg>
            </div>
            <input
              className="input-field"
              style={{ paddingLeft: 38, paddingRight: 44 }}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              name="password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              style={{ position: 'absolute', right: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', padding: 4 }}
            >
              {showPassword ? (
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Ricordami */}
        <div
          onClick={() => setRememberMe(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: 6, flexShrink: 0,
            border: '1.5px solid ' + (rememberMe ? 'var(--iv-blue)' : 'var(--border)'),
            background: rememberMe ? 'var(--iv-blue)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s'
          }}>
            {rememberMe && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Ricordami su questo dispositivo
          </span>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-light)', padding: '10px 12px', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? 'Accesso in corso...' : 'Accedi'}
        </button>

      </form>

      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--text-tertiary)' }}>
        Per assistenza contatta il tuo responsabile
      </div>

    </div>
  )
}
