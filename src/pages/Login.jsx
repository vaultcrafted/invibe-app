import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError('Email o password errati.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'var(--iv-blue)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '0.02em'
        }}>IV</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Invibe Staff</h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Summer 2026 — Accesso riservato allo staff</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="input-label">Email</label>
          <input
            className="input-field"
            type="email"
            placeholder="nome@invibe.it"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="input-label">Password</label>
          <input
            className="input-field"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {error && (
          <p style={{ fontSize: 13, color: 'var(--danger)', background: 'var(--danger-light)', padding: '10px 12px', borderRadius: 8 }}>
            {error}
          </p>
        )}
        <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? 'Accesso in corso...' : 'Accedi'}
        </button>
      </form>
    </div>
  )
}
