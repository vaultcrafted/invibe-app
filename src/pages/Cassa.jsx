import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import Topbar from '../components/Topbar'
import { Wallet, Plus, ArrowDownCircle, ArrowUpCircle, X } from 'lucide-react'

const DEST_COLORS = {
  pag: '#1E6BF1', corfu: '#059669', zante: '#D97706',
  gallipoli: '#DC2626', sardegna: '#7C3AED',
}

export const CATEGORIE = ['SSP', 'Tassa di soggiorno', 'Escursioni', 'Cauzione', 'Paleo', 'Montecristo', 'Pazuzu', 'Mojito', 'Pranzo Laviron', 'Spesa staff', 'Rimborsi', 'Altro']

export default function Cassa() {
  const { profile, isAdmin } = useAuth()

  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedShift, setSelectedShift] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ categoria: CATEGORIE[0], importo: '', descrizione: '', data: new Date().toISOString().slice(0, 10) })

  const assignedShifts = isAdmin
    ? DESTINATIONS.flatMap(d => SHIFTS[d.id].map(s => ({ destination: d.id, shift_num: s.num })))
    : (profile?.assigned_shifts || [])

  const shiftObjects = assignedShifts.map(({ destination, shift_num }) => {
    const dest = DESTINATIONS.find(d => d.id === destination)
    const shift = SHIFTS[destination]?.find(s => s.num === shift_num)
    if (!dest || !shift) return null
    return { destination, shift_num, destName: dest.name, color: DEST_COLORS[destination] }
  }).filter(Boolean)

  useEffect(() => {
    if (shiftObjects.length > 0 && !selectedShift) setSelectedShift(shiftObjects[0])
  }, [profile])

  useEffect(() => { if (selectedShift) loadMovimenti() }, [selectedShift])

  async function loadMovimenti() {
    setLoading(true)
    const { data } = await supabase.from('cassa_movimenti')
      .select('*')
      .eq('destination', selectedShift.destination)
      .eq('shift_num', selectedShift.shift_num)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
    setMovimenti(data || [])
    setLoading(false)
  }

  function openForm() {
    setForm({ categoria: CATEGORIE[0], importo: '', descrizione: '', data: new Date().toISOString().slice(0, 10) })
    setShowForm(true)
  }

  async function handleSave() {
    const signed = parseFloat(form.importo)
    if (!signed) return
    const tipo = signed >= 0 ? 'entrata' : 'uscita'
    setSaving(true)
    await supabase.from('cassa_movimenti').insert({
      destination: selectedShift.destination,
      shift_num: selectedShift.shift_num,
      data: form.data,
      tipo,
      categoria: form.categoria,
      importo: Math.abs(signed),
      descrizione: form.descrizione || null,
      inserito_da: profile ? `${profile.nome} ${profile.cognome}` : null,
    })
    setSaving(false)
    setShowForm(false)
    loadMovimenti()
  }

  async function handleDelete(id) {
    await supabase.from('cassa_movimenti').delete().eq('id', id)
    loadMovimenti()
  }

  const totaleEntrate = movimenti.filter(m => m.tipo === 'entrata').reduce((t, m) => t + Number(m.importo), 0)
  const totaleUscite = movimenti.filter(m => m.tipo === 'uscita').reduce((t, m) => t + Number(m.importo), 0)
  const saldo = totaleEntrate - totaleUscite
  const color = selectedShift?.color || 'var(--iv-blue)'

  if (shiftObjects.length === 0) return (
    <div className="page">
      <Topbar showBack={false} showAvatar={false} />
      <div className="empty-state"><p>Nessun turno assegnato.</p></div>
    </div>
  )

  return (
    <div className="page">
      <Topbar showBack={false} showAvatar={false} />

      {/* Selettore turno */}
      {shiftObjects.length > 1 && (
        <div style={{ paddingTop: 10, paddingBottom: 4, paddingLeft: 16, paddingRight: 16, overflowX: 'auto', display: 'flex', gap: 8, minHeight: 36 }}>
          {shiftObjects.map((s, i) => {
            const active = selectedShift?.destination === s.destination && selectedShift?.shift_num === s.shift_num
            return (
              <button key={i} onClick={() => setSelectedShift(s)} style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer',
                background: active ? s.color : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)',
                border: '0.5px solid ' + (active ? s.color : 'var(--border)'),
              }}>
                {s.destName} {shiftLabel(s.destination, s.shift_num)}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Wallet size={13} /> Cassa · {selectedShift ? `${selectedShift.destName} · ${shiftLabel(selectedShift.destination, selectedShift.shift_num)}` : ''}
        </div>
      </div>

      {/* Saldo */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ background: color, borderRadius: 16, padding: '18px 20px', color: '#fff' }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo attuale</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 4 }}>€{saldo.toFixed(2)}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, fontWeight: 600 }}>
            <span>↓ Entrate €{totaleEntrate.toFixed(2)}</span>
            <span>↑ Uscite €{totaleUscite.toFixed(2)}</span>
          </div>
        </div>

        {/* Bottone aggiungi */}
        <button onClick={openForm} style={{ width: '100%', marginTop: 12, padding: '13px', borderRadius: 12, background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
          <Plus size={16} /> Nuovo movimento
        </button>
      </div>

      {/* Lista movimenti */}
      <div style={{ padding: '4px 16px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : movimenti.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 13 }}>Nessun movimento registrato</div>
        ) : (
          <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
            {movimenti.map((m, i) => {
              const isEntrata = m.tipo === 'entrata'
              const dataFmt = new Date(m.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: i < movimenti.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  {isEntrata ? <ArrowDownCircle size={18} color="#16A34A" style={{ flexShrink: 0 }} /> : <ArrowUpCircle size={18} color="#DC2626" style={{ flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.categoria}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      {dataFmt}{m.descrizione ? ` · ${m.descrizione}` : ''}{m.inserito_da ? ` · ${m.inserito_da}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isEntrata ? '#16A34A' : '#DC2626', flexShrink: 0 }}>
                    {isEntrata ? '+' : '-'}€{Number(m.importo).toFixed(2)}
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDelete(m.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modale aggiungi movimento */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary)', borderRadius: '20px 20px 0 0', padding: '20px 18px 28px', width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                Nuovo movimento
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Importo (€) — positivo = entrata, negativo = uscita</label>
                <input type="number" step="0.01" placeholder="es. 7100 oppure -25" value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 18, fontWeight: 700, marginTop: 4, color: form.importo && parseFloat(form.importo) < 0 ? '#DC2626' : '#16A34A' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Categoria</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, marginTop: 4 }}>
                  {CATEGORIE.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Descrizione (opzionale)</label>
                <input type="text" placeholder="es. tax Lavrion c2-c3-c4" value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Data</label>
                <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }} />
              </div>

              <button onClick={handleSave} disabled={saving || !form.importo}
                style={{ marginTop: 6, padding: '13px', borderRadius: 12, border: 'none', background: form.importo && parseFloat(form.importo) < 0 ? '#DC2626' : '#16A34A', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.importo ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Plus size={16} /> {saving ? 'Salvo...' : 'Aggiungi movimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
