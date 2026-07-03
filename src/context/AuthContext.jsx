import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
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
  // Inserimento movimenti in cassa: ufficio, supervisor, CM (non ACM).
  const canEditCassa = isFullAccess || isCM
  // Import Excel (sovrascrive tutto il DB): solo accesso globale.
  const canImport = isFullAccess

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, isAdmin, isFullAccess, isCM, isACM, canEditCassa, canImport, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
