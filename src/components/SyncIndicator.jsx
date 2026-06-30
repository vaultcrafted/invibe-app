import { useEffect, useRef, useState } from 'react'
import { subscribe } from '../lib/syncQueue'

export default function SyncIndicator() {
  const [state, setState] = useState({ pending: 0, online: true, syncing: false })
  const [justSynced, setJustSynced] = useState(false)
  const prevPending = useRef(0)
  const timer = useRef(null)

  useEffect(() => {
    const unsub = subscribe(st => {
      // appena la coda passa da >0 a 0 con rete: conferma "sincronizzato" per 2.5s
      if (prevPending.current > 0 && st.pending === 0 && st.online) {
        setJustSynced(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setJustSynced(false), 2500)
      }
      prevPending.current = st.pending
      setState(st)
    })
    return () => { unsub(); clearTimeout(timer.current) }
  }, [])

  const { pending, online, syncing } = state

  // Niente da mostrare se: online, niente in coda, e nessuna conferma in corso
  if (online && pending === 0 && !justSynced) return null

  let bg, color, border, label
  if (!online) {
    bg = '#FEF3C7'; color = '#92400E'; border = '#FDE68A'
    label = pending > 0 ? `Offline · ${pending} da sincronizzare` : 'Offline'
  } else if (pending > 0) {
    bg = '#DBEAFE'; color = '#1E40AF'; border = '#BFDBFE'
    label = syncing ? `Sincronizzo… ${pending}` : `${pending} in attesa`
  } else {
    bg = '#DCFCE7'; color = '#166534'; border = '#BBF7D0'
    label = 'Tutto sincronizzato'
  }

  return (
    <div style={{
      position: 'fixed', zIndex: 150,
      bottom: 'calc(76px + env(safe-area-inset-bottom))',
      left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 14px', borderRadius: 999,
      background: bg, color, border: '0.5px solid ' + border,
      fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      pointerEvents: 'none',
    }}>
      {(!online || syncing) && (
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color,
          animation: 'syncPulse 1.1s ease-in-out infinite',
        }} />
      )}
      {label}
      <style>{`@keyframes syncPulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  )
}
