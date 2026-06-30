import { useState, useEffect } from 'react'

const DISMISS_KEY = 'invibe_install_dismissed'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)   // evento beforeinstallprompt (Android/Chrome)
  const [show, setShow] = useState(false)
  const [iosHelp, setIosHelp] = useState(false)

  useEffect(() => {
    if (isStandalone()) return                       // già installata: niente banner
    if (localStorage.getItem(DISMISS_KEY)) return    // già chiuso dall'utente

    // Android / Chrome: intercetta il prompt nativo
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferred(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iPhone: niente prompt nativo, mostro le istruzioni (solo Safari)
    if (isIOS()) setShow(true)

    // se viene installata, nascondi
    const onInstalled = () => { setShow(false); localStorage.setItem(DISMISS_KEY, '1') }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    setShow(false)
    localStorage.setItem(DISMISS_KEY, '1')
  }

  async function install() {
    if (deferred) {
      deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
      setShow(false)
    } else if (isIOS()) {
      setIosHelp(true)
    }
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12,
      bottom: 'calc(12px + env(safe-area-inset-bottom))',
      zIndex: 200, maxWidth: 460, margin: '0 auto',
      background: 'linear-gradient(160deg, #1E6BF1, #1450C8)',
      borderRadius: 16, boxShadow: '0 8px 28px rgba(20,71,176,0.4)',
      padding: 14, color: '#fff'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/Logotipo.png" alt="" style={{ width: 38, height: 38, objectFit: 'contain', filter: 'brightness(0) invert(1)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Installa Invibe</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Aggiungila al telefono e aprila come un'app</div>
        </div>
        {!iosHelp && (
          <button onClick={install} style={{ background: '#fff', color: 'var(--iv-blue)', fontWeight: 700, fontSize: 13, padding: '8px 16px', borderRadius: 10, whiteSpace: 'nowrap' }}>
            Installa
          </button>
        )}
        <button onClick={dismiss} aria-label="Chiudi" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 20, lineHeight: 1, padding: '4px 6px', flexShrink: 0 }}>×</button>
      </div>

      {iosHelp && (
        <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px' }}>
          Su iPhone con <b>Safari</b>: tocca <b>Condividi</b> <span style={{ fontSize: 14 }}>􀈂</span> (il quadrato con la freccia in basso), poi <b>“Aggiungi a Home”</b> → <b>Aggiungi</b>.
        </div>
      )}
    </div>
  )
}
