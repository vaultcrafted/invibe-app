import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Send, Sparkles } from 'lucide-react'

const SUGGESTIONS = [
  'Quanti minorenni hanno prenotato Pazuzu a Corfù 2?',
  'Quanti gruppi ci sono a Gallipoli G1 e quante persone in totale?',
  'Qual è il gruppo con più partecipanti a Zante?',
  'Quanti maschi e femmine hanno la Tassa di soggiorno da incassare a Sardegna?',
]

export default function AiAssistantTab({ embedded = false }) {
  const [messages, setMessages] = useState([]) // { role: 'user'|'assistant', text }
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  async function send(text) {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setError(null)
    setInput('')
    const nextMessages = [...messages, { role: 'user', text: q }]
    setMessages(nextMessages)
    setLoading(true)
    try {
      // Converto lo storico nel formato atteso dall'API Anthropic (role + content testo)
      const apiMessages = nextMessages.map(m => ({ role: m.role, content: m.text }))
      const { data, error: fnError } = await supabase.functions.invoke('ai-assistant', { body: { messages: apiMessages } })
      if (fnError) {
        // supabase-js non mette il corpo della risposta in fnError.message quando lo status non è 2xx:
        // va letto a mano da fnError.context (la Response vera e propria), altrimenti perdiamo il
        // messaggio "DIAGNOSTICA: ..." che la funzione ha effettivamente restituito.
        let detail = fnError.message
        try {
          const body = await fnError.context?.json()
          if (body?.error) detail = body.error
        } catch (_) { /* corpo non leggibile/non JSON: tengo il messaggio generico */ }
        throw new Error(detail)
      }
      if (data?.error) throw new Error(data.error)
      setMessages(prev => [...prev, { role: 'assistant', text: data?.answer || 'Non sono riuscito a trovare una risposta.' }])
    } catch (e) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: embedded ? '100%' : 'calc(100vh - 170px)', maxWidth: 780, margin: '0 auto' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 4px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-tertiary)' }}>
            <Sparkles size={28} style={{ marginBottom: 10, opacity: 0.6 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>Chiedimi qualsiasi cosa sui dati di Invibe</div>
            <div style={{ fontSize: 12.5, marginBottom: 18 }}>Interrogo in autonomia gruppi, partecipanti, servizi e cassa per darti una risposta precisa.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)} style={{ fontSize: 12.5, padding: '8px 14px', borderRadius: 12, border: '0.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', maxWidth: 420, textAlign: 'left' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{
              maxWidth: '82%', padding: '10px 14px', borderRadius: 16,
              borderBottomRightRadius: m.role === 'user' ? 4 : 16,
              borderBottomLeftRadius: m.role === 'user' ? 16 : 4,
              background: m.role === 'user' ? 'var(--iv-blue)' : 'var(--bg-secondary)',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
              fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap',
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{ padding: '10px 14px', borderRadius: 16, borderBottomLeftRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', fontSize: 13 }}>
              Sto controllando i dati...
            </div>
          </div>
        )}
        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 12, background: '#FEF2F2', border: '0.5px solid #FCA5A5', color: '#B91C1C', fontSize: 12.5, marginBottom: 12 }}>
            {error.includes('not found') || error.includes('404')
              ? "L'assistente non è ancora attivo: manca la Edge Function \"ai-assistant\" su Supabase. Chiedi a chi gestisce l'app di attivarla."
              : `Errore: ${error}`}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 4px', borderTop: '0.5px solid var(--border)' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Fai una domanda sui dati..."
          disabled={loading}
          style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, background: loading ? 'var(--bg-secondary)' : '#fff' }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{ width: 46, height: 46, borderRadius: 12, background: (loading || !input.trim()) ? 'var(--bg-secondary)' : 'var(--iv-blue)', color: (loading || !input.trim()) ? 'var(--text-tertiary)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
