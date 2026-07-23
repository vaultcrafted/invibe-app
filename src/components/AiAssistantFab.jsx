import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Sparkles, X } from 'lucide-react'
import AiAssistantTab from './AiAssistantTab'

export default function AiAssistantFab() {
  const { isAdmin } = useAuth()
  const [open, setOpen] = useState(false)

  if (!isAdmin) return null // stesso livello di accesso della tab Assistente AI nel pannello Admin

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Assistente AI"
          style={{
            position: 'fixed', right: 18, bottom: 84, zIndex: 90,
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--iv-blue) 0%, #6D28D9 100%)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer', boxShadow: '0 6px 20px rgba(37,99,235,0.4)',
          }}
        >
          <Sparkles size={22} />
        </button>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 780, height: 'min(82vh, 720px)',
              background: 'var(--bg-primary)', borderTopLeftRadius: 20, borderTopRightRadius: 20,
              boxShadow: '0 -8px 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                <Sparkles size={17} color="var(--iv-blue)" /> Assistente AI
              </div>
              <button onClick={() => setOpen(false)} style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, padding: '0 12px' }}>
              <AiAssistantTab embedded />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
