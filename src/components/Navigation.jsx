import { useNavigate, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  {
    id: 'home', label: 'Home', path: '/',
    icon: (active) => (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <path d="M5 10v11h14V10M3 12L12 3l9 9" stroke={active ? '#1E6BF1' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 21V12h6v9" stroke={active ? '#1E6BF1' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    id: 'calendario', label: 'Calendario', path: '/calendario',
    icon: (active) => (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="3" stroke={active ? '#1E6BF1' : 'currentColor'} strokeWidth="2"/>
        <path d="M16 2v4M8 2v4M3 10h18" stroke={active ? '#1E6BF1' : 'currentColor'} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="8" cy="15" r="1.2" fill={active ? '#1E6BF1' : 'currentColor'}/>
        <circle cx="12" cy="15" r="1.2" fill={active ? '#1E6BF1' : 'currentColor'}/>
        <circle cx="16" cy="15" r="1.2" fill={active ? '#1E6BF1' : 'currentColor'}/>
      </svg>
    )
  },
  {
    id: 'staff', label: 'Staff', path: '/staff-list',
    icon: (active) => (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="4" stroke={active ? '#1E6BF1' : 'currentColor'} strokeWidth="2"/>
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke={active ? '#1E6BF1' : 'currentColor'} strokeWidth="2" strokeLinecap="round"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87" stroke={active ? '#1E6BF1' : 'currentColor'} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    id: 'account', label: 'Account', path: '/account',
    icon: (active) => (
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" stroke={active ? '#1E6BF1' : 'currentColor'} strokeWidth="2"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={active ? '#1E6BF1' : 'currentColor'} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )
  },
]

export default function Navigation() {
  const navigate = useNavigate()
  const location = useLocation()

  function isActive(item) {
    if (item.path === '/') return location.pathname === '/'
    return location.pathname.startsWith(item.path)
  }

  return (
    <>
      <nav className="sidebar">
        <div style={{ padding: '0 8px', marginBottom: 20 }}>
          <img src="/Logotipo.png" alt="Invibe" style={{ height: 28, objectFit: 'contain', filter: 'brightness(0) invert(1)', display: 'block' }} />
        </div>
        {NAV_ITEMS.map(item => {
          const active = isActive(item)
          return (
            <button key={item.id} className={'sidebar-item ' + (active ? 'active' : '')} onClick={() => navigate(item.path)}>
              {item.icon(active)}
              {item.label}
            </button>
          )
        })}
      </nav>
      <nav className="bottom-nav">
        {NAV_ITEMS.map(item => {
          const active = isActive(item)
          return (
            <button key={item.id} className={'bottom-nav-item ' + (active ? 'active' : '')} onClick={() => navigate(item.path)}>
              {item.icon(active)}
              {item.label}
            </button>
          )
        })}
      </nav>
    </>
  )
}
