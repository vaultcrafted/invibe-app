import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DESTINATIONS, SHIFTS, shiftLabel } from '../lib/constants'
import { Plus, X, AlertTriangle } from 'lucide-react'

const fmtEur = (n) => '€ ' + Math.round(n || 0).toLocaleString('it-IT')
const fmtDataBreve = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : ''
const oggiISO = () => new Date().toISOString().slice(0, 10)

export default function FornitoriTab() {
  const [fornitori, setFornitori] = useState([])
  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDest, setFilterDest] = useState(DESTINATIONS[0].id)
  const [dataLimite, setDataLimite] = useState(oggiISO())
  const [mostraElenco, setMostraElenco] = useState(false)
  const [entrate, setEntrate] = useState([])
  const [formEntrata, setFormEntrata] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm())

  function blankForm() {
    return { nome: '', destination: '', shift_num: '', importo: '', data_prevista: oggiISO(), data_pagamento: '', note: '', gratis: false }
  }

  useEffect(() => { load() }, [])

  async function loadTuttiMovimenti() {
    const PAGE = 1000
    let all = [], from = 0
    while (true) {
      const { data, error } = await supabase.from('cassa_movimenti').select('destination, shift_num, tipo, importo, metodo').range(from, from + PAGE - 1)
      if (error) { console.error('Errore caricamento cassa_movimenti:', error); break }
      all = all.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }
    return all
  }

  async function load() {
    setLoading(true)
    const [f, m, prev] = await Promise.all([
      supabase.from('fornitori_pagamenti').select('*').order('nome'),
      loadTuttiMovimenti(),
      supabase.from('entrate_previste').select('*').order('data_prevista'),
    ])
    setFornitori(f.data || [])
    setMovimenti(m)
    setEntrate(prev.data || [])
    setLoading(false)
  }

  // Solo CASH: e' il contante che il Capo Meta ha fisicamente in mano.
  // Wivawallet, bonifici e carte arrivano sul conto e non stanno nella cassa,
  // quindi sommarli darebbe un saldo che non corrisponde a nulla di reale.
  function isCash(m) {
    return String(m.metodo || 'Cash').trim().toUpperCase() === 'CASH'
  }

  function saldoReale(dest, shift) {
    return movimenti
      .filter(m => isCash(m))
      .filter(m => (!dest || m.destination === dest) && (shift == null || m.shift_num === shift))
      .reduce((t, m) => t + (m.tipo === 'entrata' ? Number(m.importo) : -Number(m.importo)), 0)
  }

  async function salva(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    const payload = {
      nome: form.nome.trim(),
      destination: form.destination || null,
      shift_num: form.shift_num ? Number(form.shift_num) : null,
      importo: Number(form.importo) || 0,
      data_prevista: form.data_prevista || null,
      data_pagamento: form.data_pagamento || null,
      note: form.note || null,
      gratis: !!form.gratis,
    }
    if (editing?.id) await supabase.from('fornitori_pagamenti').update(payload).eq('id', editing.id)
    else await supabase.from('fornitori_pagamenti').insert(payload)
    setShowForm(false); setEditing(null); setForm(blankForm())
    load()
  }
  async function elimina(row) {
    if (!window.confirm(`Eliminare "${row.nome}" · ${row.shift_num ? shiftLabel(row.destination, row.shift_num) : 'trasversale'}?`)) return
    await supabase.from('fornitori_pagamenti').delete().eq('id', row.id)
    load()
  }
  // Elimina l'intera riga di un fornitore (tutte le sue voci su tutti i turni della meta).
  // Serve soprattutto per le righe che non hanno nessuna cella valorizzata: prima
  // erano impossibili da togliere, perche' l'unico modo di aprire l'editor era
  // cliccare su una cella esistente.
  async function eliminaFornitore(nome) {
    const voci = fornitori.filter(f => f.nome === nome && f.destination === filterDest)
    const quante = voci.filter(v => v.shift_num != null).length
    const msg = quante > 0
      ? `Eliminare "${nome}" e tutti i suoi ${quante} pagamenti su questa meta?`
      : `Eliminare la riga "${nome}"?`
    if (!window.confirm(msg)) return
    await supabase.from('fornitori_pagamenti').delete()
      .eq('destination', filterDest).eq('nome', nome)
    load()
  }

  // Apre l'editor sul nome della riga: se c'e' gia' una voce la modifica,
  // altrimenti ne prepara una nuova con quel nome.
  function apriRiga(nome) {
    const esistente = fornitori.find(f => f.nome === nome && f.destination === filterDest)
    if (esistente) apriModifica(esistente)
    else apriNuovaCella(nome, filterDest, '')
  }

  async function salvaEntrata() {
    const e = formEntrata
    if (!e.descrizione.trim() || !e.data_prevista) return
    const payload = {
      descrizione: e.descrizione.trim(),
      destination: e.destination || filterDest || null,
      shift_num: e.shift_num === '' ? null : Number(e.shift_num),
      importo: Number(e.importo) || 0,
      data_prevista: e.data_prevista,
      data_incasso: e.data_incasso || null,
      note: e.note || null,
    }
    if (e.id) await supabase.from('entrate_previste').update(payload).eq('id', e.id)
    else await supabase.from('entrate_previste').insert(payload)
    setFormEntrata(null); load()
  }

  async function eliminaEntrata(e) {
    if (!window.confirm(`Eliminare l'entrata "${e.descrizione}" da ${fmtEur(Number(e.importo))}?`)) return
    await supabase.from('entrate_previste').delete().eq('id', e.id)
    setFormEntrata(null); load()
  }

  function nuovaEntrata() {
    setFormEntrata({ descrizione: '', destination: filterDest, shift_num: '', importo: '',
                     data_prevista: oggiISO(), data_incasso: '', note: '' })
  }

  function apriModifica(row) {
    setEditing(row)
    setForm({
      nome: row.nome, destination: row.destination || '', shift_num: row.shift_num ?? '',
      importo: row.importo, data_prevista: row.data_prevista || oggiISO(), data_pagamento: row.data_pagamento || '',
      note: row.note || '', gratis: row.gratis,
    })
    setShowForm(true)
  }
  function apriNuovaCella(nome, dest, shift) {
    setEditing(null)
    setForm({ ...blankForm(), nome: nome || '', destination: dest || '', shift_num: shift ?? '' })
    setShowForm(true)
  }

  // ---- Vista a tabella: righe = nomi fornitore, colonne = turni della meta selezionata ----
  const turniMeta = filterDest ? (SHIFTS[filterDest] || []) : []
  const fornitoriMeta = fornitori.filter(f => f.destination === filterDest)
  const nomiRighe = [...new Set(fornitoriMeta.map(f => f.nome))].sort((a, b) => a.localeCompare(b))
  const trasversali = fornitori.filter(f => !f.destination)

  function cella(nome, shiftNum) {
    return fornitoriMeta.find(f => f.nome === nome && f.shift_num === shiftNum)
  }

  // ---- Stessa vista a tabella per le entrate: righe = descrizione, colonne = turni ----
  const entrateMeta = entrate.filter(e => e.destination === filterDest)
  const nomiEntrate = [...new Set(entrateMeta.map(e => e.descrizione))].sort((a, b) => a.localeCompare(b))

  function cellaEntrata(desc, shiftNum) {
    return entrateMeta.find(e => e.descrizione === desc && e.shift_num === shiftNum)
  }

  function nuovaEntrataCella(desc, shiftNum) {
    setFormEntrata({ descrizione: desc || '', destination: filterDest, shift_num: shiftNum ?? '',
                     importo: '', data_prevista: oggiISO(), data_incasso: '', note: '' })
  }

  async function eliminaRigaEntrata(desc) {
    const quante = entrateMeta.filter(e => e.descrizione === desc).length
    if (!window.confirm(`Eliminare "${desc}" e le sue ${quante} voci su questa meta?`)) return
    await supabase.from('entrate_previste').delete().eq('destination', filterDest).eq('descrizione', desc)
    load()
  }

  const saldoAttuale = saldoReale(filterDest, null)

  // Tutto cio' che non e' ancora stato pagato e non e' gratis.
  const daPagareTutti = fornitori.filter(f => !f.data_pagamento && !f.gratis && (!filterDest || f.destination === filterDest || !f.destination))

  // Solo i pagamenti con scadenza ENTRO la data scelta: e' la domanda vera
  // ("quanto mi resta il 6 agosto?"), non "quanto resta a fine stagione".
  const daPagareEntro = daPagareTutti
    .filter(f => f.data_prevista && f.data_prevista <= dataLimite)
    .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista))
  const totEntro = daPagareEntro.reduce((t, f) => t + Number(f.importo), 0)


  // Pagamenti senza data prevista: non entrano nel conto (non si sa quando cadono)
  // ma vanno segnalati, altrimenti il numero sembra piu' rassicurante di quanto sia.
  const senzaData = daPagareTutti.filter(f => !f.data_prevista)
  const totSenzaData = senzaData.reduce((t, f) => t + Number(f.importo), 0)
  const totOltre = daPagareTutti.reduce((t, f) => t + Number(f.importo), 0) - totEntro - totSenzaData

  // ===== ENTRATE PREVISTE (inserite a mano dall'ufficio) =====
  const oggi = oggiISO()
  const entrateAperte = entrate.filter(e => !e.data_incasso && (!filterDest || e.destination === filterDest || !e.destination))
  const incassiEntro = entrateAperte
    .filter(e => e.data_prevista && e.data_prevista <= dataLimite)
    .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista))
  const totIncassiEntro = incassiEntro.reduce((t, e) => t + Number(e.importo), 0)
  const totIncassiOltre = entrateAperte.reduce((t, e) => t + Number(e.importo), 0) - totIncassiEntro

  // Contanti di oggi + entrate attese - uscite dovute, tutto entro la data scelta.
  const saldoAllaData = saldoAttuale + totIncassiEntro - totEntro
  const vaInRosso = saldoAllaData < 0

  function spostaData(giorni) {
    const d = new Date(dataLimite + 'T12:00:00')
    d.setDate(d.getDate() + giorni)
    setDataLimite(d.toISOString().slice(0, 10))
  }
  function ultimaScadenza() {
    const date = daPagareTutti.map(f => f.data_prevista).filter(Boolean).sort()
    return date.length ? date[date.length - 1] : oggiISO()
  }
  const fmtGiorno = iso => new Date(iso + 'T12:00:00')
    .toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Caricamento...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {DESTINATIONS.map(d => (
          <button key={d.id} onClick={() => setFilterDest(d.id)} style={chipStyle(filterDest === d.id)}>{d.flag} {d.name}</button>
        ))}
      </div>

      {/* ===== SALDO ===== */}
      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
          Contanti in cassa oggi{filterDest ? ' · ' + DESTINATIONS.find(d => d.id === filterDest).name + ' (tutti i turni)' : ''}
        </div>
        <div style={{ fontSize: 42, fontWeight: 800, color: saldoAttuale >= 0 ? '#16A34A' : '#DC2626', lineHeight: 1 }}>{fmtEur(saldoAttuale)}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 7 }}>
          solo contanti — Wivawallet, bonifici e carte non sono conteggiati
        </div>

        {/* ===== PROIEZIONE A UNA DATA ===== */}
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: '0.5px solid var(--border)' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 }}>Cosa mi resta al</span>
            <input type="date" value={dataLimite} onChange={e => setDataLimite(e.target.value)}
              style={{ padding: '7px 11px', borderRadius: 9, border: '0.5px solid var(--border)',
                       background: 'var(--bg-secondary)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }} />
            <button onClick={() => setDataLimite(oggiISO())} style={miniBtn(dataLimite === oggiISO())}>Oggi</button>
            <button onClick={() => spostaData(7)} style={miniBtn(false)}>+7 giorni</button>
            <button onClick={() => spostaData(30)} style={miniBtn(false)}>+30 giorni</button>
            <button onClick={() => setDataLimite(ultimaScadenza())} style={miniBtn(dataLimite === ultimaScadenza())}>Fino all'ultima</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Incassi previsti
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16A34A' }}>+{fmtEur(totIncassiEntro)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {incassiEntro.length} {incassiEntro.length === 1 ? 'voce' : 'voci'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Da pagare entro
              </div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{totEntro > 0 ? '-' : ''}{fmtEur(totEntro)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {daPagareEntro.length} {daPagareEntro.length === 1 ? 'pagamento' : 'pagamenti'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Resterebbe in cassa
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: saldoAllaData >= 0 ? '#16A34A' : '#DC2626' }}>{fmtEur(saldoAllaData)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{fmtGiorno(dataLimite)}</div>
            </div>
          </div>

          {(totOltre > 0 || totSenzaData > 0) && (
            <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              {totOltre > 0 && <span>Dopo questa data restano {fmtEur(totOltre)} da pagare. </span>}
              {totSenzaData > 0 && <span style={{ color: '#B45309', fontWeight: 600 }}>
                {fmtEur(totSenzaData)} senza data prevista, non conteggiati.
              </span>}
              {totIncassiOltre > 0 && <span> Dopo la data sono attesi altri {fmtEur(totIncassiOltre)} di incassi.</span>}
            </div>
          )}

          {(daPagareEntro.length > 0 || incassiEntro.length > 0) && (
            <>
              <button onClick={() => setMostraElenco(v => !v)} style={{
                marginTop: 12, background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--iv-blue)', fontSize: 12, fontWeight: 700 }}>
                {mostraElenco ? 'Nascondi il dettaglio' : 'Vedi entrate e uscite'}
              </button>

              {mostraElenco && (
                <div style={{ marginTop: 10, textAlign: 'left', maxWidth: 460, margin: '10px auto 0',
                              border: '0.5px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  {incassiEntro.map((e, i) => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                          fontSize: 12.5, background: '#F0FDF4', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                      <span style={{ color: 'var(--text-tertiary)', minWidth: 46, fontWeight: 600 }}>
                        {e.data_prevista.slice(8, 10)}/{e.data_prevista.slice(5, 7)}
                      </span>
                      <span style={{ flex: 1, fontWeight: 600 }}>{e.descrizione}</span>
                      {e.shift_num && <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{shiftLabel(e.destination, e.shift_num)}</span>}
                      <span style={{ fontWeight: 700, color: '#16A34A' }}>+{fmtEur(Number(e.importo))}</span>
                    </div>
                  ))}
                  {daPagareEntro.map((f, i) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                          fontSize: 12.5, borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                      <span style={{ color: 'var(--text-tertiary)', minWidth: 46, fontWeight: 600 }}>
                        {f.data_prevista.slice(8, 10)}/{f.data_prevista.slice(5, 7)}
                      </span>
                      <span style={{ flex: 1, fontWeight: 600 }}>{f.nome}</span>
                      {f.shift_num && <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{shiftLabel(f.destination, f.shift_num)}</span>}
                      <span style={{ fontWeight: 700 }}>{fmtEur(Number(f.importo))}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {vaInRosso && (
          <div style={{ marginTop: 14, display: 'inline-flex', gap: 8, alignItems: 'center', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '8px 14px', fontSize: 12.5, color: '#B91C1C' }}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>Con i pagamenti entro questa data, la cassa va in rosso.</span>
          </div>
        )}
      </div>

      {/* ===== ENTRATE PREVISTE ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Entrate previste</div>
        <button onClick={nuovaEntrata} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: '#16A34A', color: '#fff', fontSize: 12.5, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          <Plus size={15} /> Nuova entrata
        </button>
      </div>

      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'auto', marginBottom: 24 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              <th style={thStyle}>Entrata</th>
              {turniMeta.map(t => <th key={t.num} style={{ ...thStyle, textAlign: 'center', minWidth: 90 }}>{shiftLabel(filterDest, t.num)}</th>)}
            </tr>
          </thead>
          <tbody>
            {nomiEntrate.length === 0 && (
              <tr><td colSpan={turniMeta.length + 1} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                Nessuna entrata prevista. Aggiungine una con "Nuova entrata": per esempio "Tasse di soggiorno" su C4.
              </td></tr>
            )}
            {nomiEntrate.map((desc, i) => (
              <tr key={desc} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span onClick={() => {
                      const e = entrateMeta.find(x => x.descrizione === desc)
                      if (e) setFormEntrata({ ...e, shift_num: e.shift_num ?? '', data_incasso: e.data_incasso || '', note: e.note || '' })
                      else nuovaEntrataCella(desc, '')
                    }} title="Modifica" style={{ cursor: 'pointer' }}>{desc}</span>
                    <button onClick={() => eliminaRigaEntrata(desc)} title={'Elimina la riga "' + desc + '"'}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                               fontSize: 15, lineHeight: 1, padding: '2px 4px', borderRadius: 6 }}
                      onMouseEnter={ev => { ev.currentTarget.style.color = '#DC2626'; ev.currentTarget.style.background = '#FEE2E2' }}
                      onMouseLeave={ev => { ev.currentTarget.style.color = 'var(--text-tertiary)'; ev.currentTarget.style.background = 'none' }}>×</button>
                  </span>
                </td>
                {turniMeta.map(t => {
                  const e = cellaEntrata(desc, t.num)
                  return (
                    <td key={t.num} style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => e
                        ? setFormEntrata({ ...e, shift_num: e.shift_num ?? '', data_incasso: e.data_incasso || '', note: e.note || '' })
                        : nuovaEntrataCella(desc, t.num)}>
                      {!e ? <span style={{ color: 'var(--border)' }}>—</span>
                        : e.data_incasso
                          ? <span style={cellBadge('#15803D', '#DCFCE7')}>{fmtEur(Number(e.importo))}</span>
                          : <span style={cellBadge('#B45309', '#FEF3C7')}>{fmtEur(Number(e.importo))}</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: -14, marginBottom: 22, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span><span style={{ ...cellBadge('#B45309', '#FEF3C7'), marginRight: 5 }}>importo</span> da incassare, entra nella previsione</span>
        <span><span style={{ ...cellBadge('#15803D', '#DCFCE7'), marginRight: 5 }}>importo</span> gia' incassata, esce dalla previsione</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Fornitori & pagamenti</div>
        <button onClick={() => apriNuovaCella('', filterDest, '')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'var(--iv-blue)', color: '#fff', fontSize: 12.5, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          <Plus size={15} /> Nuovo fornitore
        </button>
      </div>

      {!filterDest ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)', fontSize: 13.5, background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 12 }}>
          Seleziona una meta qui sopra per vedere la tabella fornitori × turni.
        </div>
      ) : (
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th style={thStyle}>Fornitore</th>
                {turniMeta.map(s => <th key={s.num} style={{ ...thStyle, textAlign: 'center', minWidth: 90 }}>{shiftLabel(filterDest, s.num)}</th>)}
              </tr>
            </thead>
            <tbody>
              {nomiRighe.length === 0 && (
                <tr><td colSpan={turniMeta.length + 1} style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Nessun fornitore per questa meta. Aggiungine uno con "Nuovo fornitore".</td></tr>
              )}
              {nomiRighe.map((nome, i) => (
                <tr key={nome} style={{ borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
                  <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span onClick={() => apriRiga(nome)} title="Modifica"
                        style={{ cursor: 'pointer' }}>{nome}</span>
                      <button onClick={() => eliminaFornitore(nome)} title={'Elimina la riga "' + nome + '"'}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                                 fontSize: 15, lineHeight: 1, padding: '2px 4px', borderRadius: 6 }}
                        onMouseEnter={ev => { ev.currentTarget.style.color = '#DC2626'; ev.currentTarget.style.background = '#FEE2E2' }}
                        onMouseLeave={ev => { ev.currentTarget.style.color = 'var(--text-tertiary)'; ev.currentTarget.style.background = 'none' }}>×</button>
                    </span>
                  </td>
                  {turniMeta.map(s => {
                    const c = cella(nome, s.num)
                    return (
                      <td key={s.num} style={{ ...tdStyle, textAlign: 'center', cursor: 'pointer' }}
                        onClick={() => c ? apriModifica(c) : apriNuovaCella(nome, filterDest, s.num)}>
                        {!c ? <span style={{ color: 'var(--border)' }}>—</span>
                          : c.gratis ? <span style={cellBadge('#64748B', '#F1F5F9')}>FREE</span>
                          : c.data_pagamento ? <span style={cellBadge('#16A34A', '#DCFCE7')}>{fmtDataBreve(c.data_pagamento)}</span>
                          : <span style={cellBadge('#B91C1C', '#FEE2E2')}>NO</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {trasversali.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>Pagamenti trasversali (non legati a un turno)</div>
          <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {trasversali.map((f, i) => (
              <div key={f.id} onClick={() => apriModifica(f)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{f.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{f.data_pagamento ? 'pagato il ' + fmtDataBreve(f.data_pagamento) : 'da pagare'}{f.note ? ' · ' + f.note : ''}</div>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{f.gratis ? 'FREE' : fmtEur(f.importo)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {formEntrata && (
        <div onClick={() => setFormEntrata(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: 22, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{formEntrata.id ? 'Modifica entrata' : 'Nuova entrata prevista'}</div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
                {formEntrata.id && <button type="button" onClick={() => eliminaEntrata(formEntrata)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 12, fontWeight: 700 }}>Elimina</button>}
                <button type="button" onClick={() => setFormEntrata(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
              </div>
            </div>

            <label style={labEntrata}>Descrizione</label>
            <input value={formEntrata.descrizione} onChange={ev => setFormEntrata({ ...formEntrata, descrizione: ev.target.value })}
              placeholder="es. Tasse di soggiorno C4" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} autoFocus />

            <label style={labEntrata}>Importo (€)</label>
            <input type="number" inputMode="decimal" value={formEntrata.importo}
              onChange={ev => setFormEntrata({ ...formEntrata, importo: ev.target.value })} placeholder="0" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />

            <label style={labEntrata}>Quando lo incasso</label>
            <input type="date" value={formEntrata.data_prevista}
              onChange={ev => setFormEntrata({ ...formEntrata, data_prevista: ev.target.value })} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />

            <label style={labEntrata}>Turno (facoltativo)</label>
            <select value={formEntrata.shift_num} onChange={ev => setFormEntrata({ ...formEntrata, shift_num: ev.target.value })} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}>
              <option value="">Nessuno / trasversale</option>
              {(SHIFTS[formEntrata.destination || filterDest] || []).map(t => (
                <option key={t.num} value={t.num}>{shiftLabel(formEntrata.destination || filterDest, t.num)} · {t.label}</option>
              ))}
            </select>

            <label style={labEntrata}>Gia' incassata il (lasciare vuoto se non ancora)</label>
            <input type="date" value={formEntrata.data_incasso}
              onChange={ev => setFormEntrata({ ...formEntrata, data_incasso: ev.target.value })} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: -6, marginBottom: 12 }}>
              Compilando questa data l'entrata esce dalla previsione: i soldi sono gia' in cassa.
            </div>

            <label style={labEntrata}>Note</label>
            <input value={formEntrata.note} onChange={ev => setFormEntrata({ ...formEntrata, note: ev.target.value })} placeholder="facoltative" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />

            <button onClick={salvaEntrata} style={{ width: '100%', marginTop: 8, padding: 13, borderRadius: 11, background: '#16A34A', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {formEntrata.id ? 'Salva modifiche' : 'Aggiungi entrata'}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div onClick={() => { setShowForm(false); setEditing(null) }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
          <form onClick={e => e.stopPropagation()} onSubmit={salva} style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{editing ? 'Modifica pagamento' : 'Nuovo pagamento fornitore'}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {editing && <button type="button" onClick={() => { elimina(editing); setShowForm(false); setEditing(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 12, fontWeight: 700 }}>Elimina</button>}
                <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
              </div>
            </div>

            <label style={labelStyle}>Nome fornitore
              <input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="es. Mojito 1, Paleo, 54, City tax Ionian" style={inputStyle} />
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ ...labelStyle, flex: 1 }}>Meta (opzionale)
                <select value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value, shift_num: '' })} style={inputStyle}>
                  <option value="">— trasversale —</option>
                  {DESTINATIONS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>
              <label style={{ ...labelStyle, flex: 1 }}>Turno
                <select value={form.shift_num} onChange={e => setForm({ ...form, shift_num: e.target.value })} style={inputStyle} disabled={!form.destination}>
                  <option value="">—</option>
                  {form.destination && SHIFTS[form.destination]?.map(s => <option key={s.num} value={s.num}>{shiftLabel(form.destination, s.num)}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ ...labelStyle, flex: 1 }}>Importo (€)
                <input type="number" step="0.01" value={form.importo} onChange={e => setForm({ ...form, importo: e.target.value })} style={inputStyle} />
              </label>
              <label style={{ ...labelStyle, flex: 1 }}>Data prevista
                <input type="date" value={form.data_prevista} onChange={e => setForm({ ...form, data_prevista: e.target.value })} style={inputStyle} />
              </label>
            </div>

            <label style={labelStyle}>Data pagamento reale (lascia vuoto se non ancora pagato)
              <input type="date" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })} style={inputStyle} />
            </label>

            <label style={labelStyle}>Note (opzionale)
              <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="es. saldo w3, anticipo..." style={inputStyle} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={form.gratis} onChange={e => setForm({ ...form, gratis: e.target.checked })} />
              Gratis questa volta (FREE, nessun costo)
            </label>

            <button type="submit" style={{ marginTop: 6, padding: '11px', borderRadius: 10, background: 'var(--iv-blue)', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }}>
              {editing ? 'Salva modifiche' : 'Aggiungi'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function miniBtn(active) {
  return {
    padding: '6px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
    background: active ? 'var(--iv-blue)' : 'var(--bg-secondary)',
    color: active ? '#fff' : 'var(--text-secondary)',
    border: '0.5px solid ' + (active ? 'var(--iv-blue)' : 'var(--border)'),
  }
}

function chipStyle(active) {
  return { padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: active ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (active ? 'var(--iv-blue)' : 'var(--border)') }
}
function cellBadge(color, bg) {
  return { display: 'inline-block', padding: '3px 9px', borderRadius: 6, fontWeight: 700, fontSize: 11.5, color, background: bg }
}
const thStyle = { padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }
const tdStyle = { padding: '9px 14px' }
const labEntrata = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5, marginTop: 12 }
const labelStyle = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }
const inputStyle = { padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 13.5, fontFamily: 'inherit' }
