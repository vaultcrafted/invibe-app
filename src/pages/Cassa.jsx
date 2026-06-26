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

export const CATEGORIE = {
  entrata: ['Raccolta buste servizi', 'Rimborso fornitore', 'Altro incasso'],
  uscita: ['Pagamento locali/escursioni', 'Materiali', 'Rimborso staff', 'Cibo/bevande staff', 'Trasporti', 'Altro'],
}

export default function Cassa() {
  const { profile, isAdmin } = useAuth()

  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedShift, setSelectedShift] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ tipo: 'entrata', categoria: CATEGORIE.entrata[0], importo: '', descrizione: '', data: new Date().toISOString().slice(0, 10) })

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

  function openForm(tipo) {
    setForm({ tipo, categoria: CATEGORIE[tipo][0], importo: '', descrizione: '', data: new Date().toISOString().slice(0, 10) })
    setShowForm(true)
  }

  async function handleSave() {
    const importoNum = parseFloat(form.importo)
    if (!importoNum || importoNum <= 0) return
    setSaving(true)
    await supabase.from('cassa_movimenti').insert({
      destination: selectedShift.destination,
      shift_num: selectedShift.shift_num,
      data: form.data,
      tipo: form.tipo,
      categoria: form.categoria,
      importo: importoNum,
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

        {/* Bottoni aggiungi */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button onClick={() => openForm('entrata')} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#ECFDF5', color: '#16A34A', border: '1px solid #16A34A33', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
            <ArrowDownCircle size={16} /> Entrata
          </button>
          <button onClick={() => openForm('uscita')} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#FEF2F2', color: '#DC2626', border: '1px solid #DC262633', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
            <ArrowUpCircle size={16} /> Uscita
          </button>
        </div>
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
              <div style={{ fontSize: 16, fontWeight: 700, color: form.tipo === 'entrata' ? '#16A34A' : '#DC2626' }}>
                Nuova {form.tipo === 'entrata' ? 'entrata' : 'uscita'}
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Categoria</label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, marginTop: 4 }}>
                  {CATEGORIE[form.tipo].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Importo (€)</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 16, fontWeight: 600, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Descrizione (opzionale)</label>
                <input type="text" placeholder="es. Buste Escursioni gruppo Bertocchi" value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Data</label>
                <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }} />
              </div>

              <button onClick={handleSave} disabled={saving || !form.importo}
                style={{ marginTop: 6, padding: '13px', borderRadius: 12, border: 'none', background: form.tipo === 'entrata' ? '#16A34A' : '#DC2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.importo ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Plus size={16} /> {saving ? 'Salvo...' : 'Aggiungi movimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
