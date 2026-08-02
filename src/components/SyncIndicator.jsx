import { useEffect, useRef, useState } from 'react'
import { subscribe, subscribeAvvisi, scartaAvviso } from '../lib/syncQueue'

export default function SyncIndicator() {
  const [state, setState] = useState({ pending: 0, online: true, syncing: false, total: 0, done: 0, percent: 100 })
  const [avvisi, setAvvisi] = useState([])
  const [justSynced, setJustSynced] = useState(false)
  const [animPct, setAnimPct] = useState(0)
  const prevPending = useRef(0)
  const timer = useRef(null)
  const anim = useRef(null)

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
    const unsubAvvisi = subscribeAvvisi(setAvvisi)
    return () => { unsub(); unsubAvvisi(); clearTimeout(timer.current) }
  }, [])

  const { pending, online, syncing, total, done, percent } = state

  // Percentuale animata quando c'è una sola azione (scrittura atomica: simulo l'avanzamento 0→100)
  useEffect(() => {
    clearInterval(anim.current)
    if (online && pending > 0 && total <= 1) {
      setAnimPct(8)
      anim.current = setInterval(() => {
        setAnimPct(p => (p < 90 ? p + Math.max(2, Math.round((92 - p) / 6)) : p))
      }, 60)
    } else if (pending === 0) {
      setAnimPct(100)
    }
    return () => clearInterval(anim.current)
  }, [online, pending, total])

  // Gli AVVISI hanno la precedenza: segnalano un movimento che non e' arrivato
  // sul foglio, o che ci e' arrivato piu' volte. Restano finche' non li si chiude.
  const bannerAvvisi = avvisi.length > 0 && (
    <div style={{ position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 9999,
                  display: 'flex', flexDirection: 'column', gap: 8 }}>
      {avvisi.map(a => (
        <div key={a.id} style={{
          background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B',
          borderRadius: 12, padding: '12px 14px', boxShadow: '0 4px 14px rgba(0,0,0,.15)',
          display: 'flex', gap: 10, alignItems: 'flex-start'
        }}>
          <span style={{ fontSize: 18, lineHeight: '20px' }}>⚠️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{a.testo}</div>
            {a.dettaglio && <div style={{ fontSize: 12, marginTop: 3, opacity: .9 }}>{a.dettaglio}</div>}
          </div>
          <button onClick={() => scartaAvviso(a.id)}
                  style={{ background: 'transparent', border: 0, color: '#991B1B',
                           fontSize: 20, lineHeight: '20px', cursor: 'pointer', padding: 0 }}>×</button>
        </div>
      ))}
    </div>
  )

  // Niente da mostrare se: online, niente in coda, e nessuna conferma in corso
  if (online && pending === 0 && !justSynced) return bannerAvvisi || null

  let bg, color, border, label
  if (!online) {
    bg = '#FEF3C7'; color = '#92400E'; border = '#FDE68A'
    label = pending > 0 ? `Offline · ${pending} da sincronizzare` : 'Offline'
  } else if (pending > 0) {
    bg = '#DBEAFE'; color = '#1E40AF'; border = '#BFDBFE'
    label = total > 1 ? `Sincronizzo ${done}/${total} · ${percent}%` : `Sincronizzo… ${animPct}%`
  } else {
    bg = '#DCFCE7'; color = '#166534'; border = '#BBF7D0'
    label = 'Tutto sincronizzato'
  }

  const barPct = total > 1 ? percent : animPct
  const showBar = online && pending > 0

  return (
    <>
      {bannerAvvisi}

    <div style={{
      position: 'fixed', zIndex: 150,
      bottom: 'calc(76px + env(safe-area-inset-bottom))',
      left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: showBar ? '9px 16px 11px' : '7px 14px', borderRadius: showBar ? 14 : 999,
      background: bg, color, border: '0.5px solid ' + border,
      fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', minWidth: showBar ? 190 : 0,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        {(!online || syncing) && (
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: color,
            animation: 'syncPulse 1.1s ease-in-out infinite',
          }} />
        )}
        {label}
      </div>
      {showBar && (
        <div style={{ width: '100%', height: 5, borderRadius: 999, background: color + '22', overflow: 'hidden' }}>
          <div style={{ width: barPct + '%', height: '100%', borderRadius: 999, background: color, transition: 'width .2s ease' }} />
        </div>
      )}
      <style>{`@keyframes syncPulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
    </>
  )
}
