import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
)

// Nasconde la schermata d'avvio appena l'app è montata
const splash = document.getElementById('splash')
if (splash) {
  setTimeout(() => {
    splash.classList.add('hide')
    setTimeout(() => splash.remove(), 500)
  }, 350)
}
