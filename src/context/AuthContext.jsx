import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SHIFTS, setDbPrices } from '../lib/constants'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      await loadPrices()   // carica i prezzi dal DB prima di mostrare l'app (fallback ai prezzi del codice)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Carica i prezzi dei servizi dal DB (tabella servizi_prezzi). Se fallisce, l'app usa i prezzi del codice.
  async function loadPrices() {
    try {
      const { data } = await supabase.from('servizi_prezzi').select('destination, turno, servizio_id, prezzo')
      if (data && data.length) setDbPrices(data)
    } catch (e) { /* fallback silenzioso ai prezzi del codice */ }
  }

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) setProfile(data)
    setLoading(false)
  }

  async function signIn(email, password, rememberMe = true) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { persistSession: rememberMe }
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const isAdmin = profile?.role === 'admin'

  // Ruolo (mansione) per i livelli di accesso. Match esatto: "ACM" NON deve contare come "CM".
  const ru = (profile?.ruolo || '').toUpperCase()
  const isUfficio = /\bUFFICIO\b/.test(ru)
  const isSupervisor = /SUPERVISOR/.test(ru)      // copre SUPERVISOR / SUPERVISORE
  const isCM = /\bCM\b/.test(ru)                   // \bCM\b non matcha "ACM"
  const isACM = /\bACM\b/.test(ru)
  // Accesso globale (tutto sbloccato): solo ufficio e supervisor.
  const isFullAccess = isUfficio || isSupervisor

  // Referente meta: gestisce TUTTI i turni di una singola meta (non le altre).
  const refMeta = profile?.referente_meta || null
  const isReferente = !!refMeta

  // Turni effettivamente accessibili: quelli assegnati + (se referente) tutti i turni della sua meta.
  const rawShifts = profile?.assigned_shifts || []
  let effShifts = rawShifts
  if (isReferente && SHIFTS[refMeta]) {
    const seen = new Set(rawShifts.map(s => `${s.destination}__${s.shift_num}`))
    effShifts = rawShifts.slice()
    SHIFTS[refMeta].forEach(s => {
      const k = `${refMeta}__${s.num}`
      if (!seen.has(k)) effShifts.push({ destination: refMeta, shift_num: s.num, ruolo: 'REFERENTE' })
    })
  }
  const effProfile = profile ? { ...profile, assigned_shifts: effShifts } : profile

  // Inserimento movimenti in cassa: ufficio, supervisor, CM, referente meta (non ACM).
  const canEditCassa = isFullAccess || isCM || isReferente
  // Modifica servizi dei gruppi e presenza pax: stessa regola (ufficio, supervisor, CM, referente).
  // ACM, CA e tutti gli altri ruoli possono solo visualizzare.
  const canEditServizi = isFullAccess || isCM || isReferente
  // Import Excel (sovrascrive tutto il DB): solo accesso globale.
  const canImport = isFullAccess

  return (
    <AuthContext.Provider value={{ user, profile: effProfile, loading, signIn, signOut, isAdmin, isFullAccess, isReferente, refMeta, isCM, isACM, canEditCassa, canEditServizi, canImport, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
