import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SERVICES, SERVICES_CORFU, getServices, DESTINATIONS, SHIFTS, getInitials, calcAge, capogruppoCode, prebookKeyForService, cassaCategoriaForService, isPrebookingPagato } from '../lib/constants'
import { enqueueUpdate, enqueueInsert, enqueueDelete } from '../lib/syncQueue'
import { sendCassaToSheet, syncToSheet } from '../lib/sheetsSync'
import { useAuth } from '../context/AuthContext'
import { METODI, METODO_COLORS } from './Cassa'
import { ChevronLeft, Edit2, AlertTriangle } from 'lucide-react'

// Icone servizi custom
const ServiceIcons = {
  pkg_escursioni: () => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  tassa_soggiorno: () => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21v-4a3 3 0 0 1 6 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  pkg_ssp: () => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  cauzione: () => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
}

export default function GroupDetail() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { canEditCassa, canEditServizi, profile } = useAuth()
  const [group, setGroup] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [editingAlloggio, setEditingAlloggio] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { fetchGroup() }, [groupId])

  async function fetchGroup() {
    const { data } = await supabase
      .from('groups')
      .select('*, participants(id, nome, cognome, sesso, nascita, attivo, nazionalita, tipo_documento, numero_documento, data_emissione, data_scadenza, citta_partenza, pratica, stato, indirizzo, citta, prov, cap, stato_residenza, telefono, email, escursioni, navetta, assicurazione, iscrizione)')
      .eq('id', groupId)
      .single()
    if (data) { setGroup(data); setParticipants(data.participants || []) }
    setLoading(false)
  }

  function sheetPayload(serviceId, quantita) {
    return { destination: group.destination, shift_num: group.shift_num, capogruppo_code: group.capogruppo_code, servizioId: serviceId, quantita }
  }

  async function toggleService(serviceId) {
    if (!canEditServizi) return
    const newVal = !group[serviceId]
    setGroup(prev => ({ ...prev, [serviceId]: newVal }))
    enqueueUpdate('groups', { id: groupId }, { [serviceId]: newVal }, {
      dedupKey: `groups:${groupId}:${serviceId}`,
      sheet: [sheetPayload(serviceId, newVal ? participants.filter(p => p.attivo !== false).length : 0)],
    })
  }

  function updateQtaService(serviceId, value) {
    const qty = Math.max(0, parseInt(value, 10) || 0)
    setGroup(prev => ({ ...prev, [serviceId]: qty }))
  }

  async function saveQtaService(serviceId) {
    if (!canEditServizi) return
    const qty = group[serviceId] || 0
    enqueueUpdate('groups', { id: groupId }, { [serviceId]: qty }, {
      dedupKey: `groups:${groupId}:${serviceId}`,
      sheet: [sheetPayload(serviceId, qty)],
    })
    // Se il servizio ha già un metodo, aggiorno l'importo dell'entrata in cassa (qty 0 -> la rimuove)
    const metodo = (group.servizi_metodo || {})[serviceId]
    if (metodo) syncCassaEntrata(serviceId, metodo, qty)
  }

  // Conferma escursioni prenotate (già pagate in prebooking): NON va in rendicontazione (nessun sheet).
  async function saveEscConf() {
    if (!canEditServizi) return
    const preb = (group.prebook && group.prebook.escursioni) || 0
    const v = Math.max(0, Math.min(group.escursioni_conf != null ? group.escursioni_conf : preb, preb))
    setGroup(prev => ({ ...prev, escursioni_conf: v }))
    enqueueUpdate('groups', { id: groupId }, { escursioni_conf: v }, { dedupKey: `groups:${groupId}:escursioni_conf` })
  }

  async function toggleQtaService(serviceId) {
    if (!canEditServizi) return
    const current = group[serviceId] || 0
    const newQty = current > 0 ? 0 : participants.filter(p => p.attivo !== false).length
    setGroup(prev => ({ ...prev, [serviceId]: newQty }))
    enqueueUpdate('groups', { id: groupId }, { [serviceId]: newQty }, {
      dedupKey: `groups:${groupId}:${serviceId}`,
      sheet: [sheetPayload(serviceId, newQty)],
    })
    if (newQty === 0) {
      // Spengo il servizio: tolgo il metodo e l'eventuale entrata auto in cassa
      if (group.servizi_metodo && group.servizi_metodo[serviceId]) {
        const next = { ...group.servizi_metodo }; delete next[serviceId]
        setGroup(prev => ({ ...prev, servizi_metodo: next }))
        enqueueUpdate('groups', { id: groupId }, { servizi_metodo: next }, { dedupKey: `groups:${groupId}:servizi_metodo` })
      }
      syncCassaEntrata(serviceId, undefined, 0)
    } else {
      // Accendo: se c'era già un metodo memorizzato, ricreo l'entrata sulla nuova quantità
      const metodo = (group.servizi_metodo || {})[serviceId]
      if (metodo) syncCassaEntrata(serviceId, metodo, newQty)
    }
  }

  // Metodo con cui è stato pagato il servizio (bonifico / vivawallet / scalapay / cash).
  // Ritap sullo stesso metodo = deseleziona.
  function setMetodo(serviceId, metodo) {
    if (!canEditServizi) return
    const cur = group.servizi_metodo || {}
    const next = { ...cur }
    if (cur[serviceId] === metodo) delete next[serviceId]
    else next[serviceId] = metodo
    setGroup(prev => ({ ...prev, servizi_metodo: next }))
    enqueueUpdate('groups', { id: groupId }, { servizi_metodo: next }, { dedupKey: `groups:${groupId}:servizi_metodo` })
    // Entrata automatica in cassa col metodo scelto (undefined = deselezionato -> rimuove)
    syncCassaEntrata(serviceId, next[serviceId], group[serviceId] || 0)
  }

  // Crea/aggiorna/rimuove l'entrata AUTOMATICA in cassa per un servizio del gruppo.
  // È idempotente: cancella sempre l'eventuale riga auto precedente e la riscrive.
  // metodo assente o importo 0 -> nessuna riga (solo cancellazione).
  // Oltre a Supabase, tiene allineato il foglio di rendicontazione:
  //  - manda 'elimina' della VECCHIA riga (con i suoi valori reali, letti dal DB)
  //  - manda 'add' della NUOVA riga
  // Così l'elimina sul foglio combacia sempre (match per importo+descrizione),
  // anche quando cambia la quantità (quindi l'importo).
  async function syncCassaEntrata(serviceId, metodo, qty) {
    if (!canEditCassa) return   // solo chi può gestire la cassa genera movimenti
    const svc = getServices(group.destination, group.shift_num).find(s => s.id === serviceId)
    if (!svc) return

    // 1. Leggo l'eventuale entrata auto ESISTENTE: mi servono i suoi valori reali
    //    (importo/metodo/descrizione già scritti anche sul foglio) per poterla rimuovere.
    let existing = null
    try {
      const { data: rows } = await supabase
        .from('cassa_movimenti')
        .select('importo, metodo, descrizione, categoria, tipo, data')
        .match({ group_id: groupId, servizio_id: serviceId, auto: true })
      existing = rows && rows[0]
    } catch (e) { /* offline o errore: procedo comunque, il foglio è best-effort */ }

    // 2. Rimuovo la vecchia riga da Supabase (coda offline)
    enqueueDelete('cassa_movimenti', { group_id: groupId, servizio_id: serviceId, auto: true })

    // 3. Rimuovo la vecchia riga dal FOGLIO usando i valori reali del vecchio movimento
    if (existing && Number(existing.importo) > 0) {
      sendCassaToSheet({
        destination: group.destination,
        shift_num: group.shift_num,
        azione: 'elimina',
        tipoMov: existing.tipo || 'entrata',
        importo: existing.importo,
        descrizione: existing.descrizione || '',
        categoria: existing.categoria || '',
        metodo: existing.metodo || 'Cash',
        data: existing.data || '',
      })
    }

    // 4. Scrivo la nuova riga (Supabase + foglio), solo se c'è metodo e importo > 0
    const importo = svc.prezzo * (qty || 0)
    if (metodo && importo > 0) {
      const descrizione = `${capogruppoCode(group.capogruppo_code)} ${group.capogruppo_display} · ${svc.label}`.trim()
      const categoria = cassaCategoriaForService(serviceId, svc.label)
      const data = new Date().toISOString().slice(0, 10)
      enqueueInsert('cassa_movimenti', {
        destination: group.destination,
        shift_num: group.shift_num,
        data,
        tipo: 'entrata',
        categoria,
        importo,
        metodo,
        descrizione,
        inserito_da: profile ? `${profile.nome} ${profile.cognome}`.trim() : 'App',
        group_id: groupId,
        servizio_id: serviceId,
        auto: true,
      })
      sendCassaToSheet({
        destination: group.destination,
        shift_num: group.shift_num,
        azione: 'add',
        tipoMov: 'entrata',
        importo,
        descrizione,
        categoria,
        metodo,
        data,
      })
    }
  }

  async function toggleParticipantActive(participantId) {
    if (!canEditServizi) return
    const oldNPax = participants.filter(p => p.attivo !== false).length
    const updated = participants.map(p => p.id === participantId ? { ...p, attivo: p.attivo === false } : p)
    setParticipants(updated)
    const target = updated.find(p => p.id === participantId)
    enqueueUpdate('participants', { id: participantId }, { attivo: target.attivo }, {
      dedupKey: `participants:${participantId}:attivo`,
    })

    const newNPax = updated.filter(p => p.attivo !== false).length
    // Scrive il Pax aggiornato (persone presenti) sul foglio rendicontazione
    syncToSheet({ destination: group.destination, shift_num: group.shift_num, capogruppo_code: group.capogruppo_code, servizioId: 'num_pax', quantita: newNPax })
    // Aggiorno solo i servizi impostati sul gruppo intero (qty == vecchio nPax), lascio intatte le quantità modificate a mano
    const svc = getServices(group.destination, group.shift_num)
    svc.forEach(sv => {
      const current = group[sv.id] || 0
      if (oldNPax > 0 && current === oldNPax) {
        setGroup(prev => ({ ...prev, [sv.id]: newNPax }))
        enqueueUpdate('groups', { id: groupId }, { [sv.id]: newNPax }, {
          dedupKey: `groups:${groupId}:${sv.id}`,
          sheet: [sheetPayload(sv.id, newNPax)],
        })
        const metodo = (group.servizi_metodo || {})[sv.id]
        if (metodo) syncCassaEntrata(sv.id, metodo, newNPax)
      }
    })
  }

  async function updateField(field, value) { setGroup(prev => ({ ...prev, [field]: value })) }
  async function saveField(field) {
    if (!canEditServizi) return
    enqueueUpdate('groups', { id: groupId }, { [field]: group[field] }, {
      dedupKey: `groups:${groupId}:${field}`,
    })
    if (field === 'alloggio') setEditingAlloggio(false)
    if (field === 'note') setEditingNote(false)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!group) return <div className="loading-screen"><p>Gruppo non trovato.</p></div>

  const dest = DESTINATIONS.find(d => d.id === group.destination)
  const shift = SHIFTS[group.destination]?.find(s => s.num === group.shift_num)
  const activeParticipants = participants.filter(p => p.attivo !== false)
  const nPax = activeParticipants.length
  const males = activeParticipants.filter(p => p.sesso === 'M').length
  const females = activeParticipants.filter(p => p.sesso === 'F').length

  const useQta = true
  const services = getServices(group.destination, group.shift_num)
  const riepilogoRows = useQta
    ? services.filter(sv => (group[sv.id] || 0) > 0).map(sv => ({ id: sv.id, label: sv.label, prezzoUnit: sv.prezzo, qty: group[sv.id], totale: sv.prezzo * group[sv.id] }))
    : SERVICES.filter(sv => group[sv.id]).map(sv => ({ id: sv.id, label: sv.label, prezzoUnit: sv.prezzo, qty: nPax, totale: sv.prezzo * nPax }))
  const costoTotale = riepilogoRows.reduce((tot, r) => tot + r.totale, 0)

  return (
    <div className="page" style={{ paddingBottom: 0 }}>

      {/* Header blu */}
      <div style={{ background: 'var(--iv-blue)', padding: '14px 20px', paddingTop: 'calc(14px + env(safe-area-inset-top))', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 30 }}>
        <button onClick={() => navigate(-1)} style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ChevronLeft size={18} color="#fff" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            {capogruppoCode(group.capogruppo_code) && <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700, opacity: 0.85, marginRight: 8 }}>{capogruppoCode(group.capogruppo_code)}</span>}
            {group.capogruppo_display}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
            {dest?.name} · {shift?.label || `Turno ${group.shift_num}`}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px 120px', maxWidth: 900, margin: '0 auto' }}>

        {/* Legenda colori */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--iv-blue)' }} />Prebooking pagato</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A' }} />Incassato</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#DC2626' }} />Da incassare</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#94A3B8' }} />Assente</span>
        </div>

        {/* Layout desktop: 2 colonne, mobile: 1 colonna */}
        <style>{`
          .group-detail-grid { display: flex; flex-direction: column; gap: 20px; }
          @media (min-width: 701px) { .group-detail-grid { flex-direction: row; } }
          @media (min-width: 701px) { .group-detail-left { flex: 1; min-width: 0; } }
          @media (min-width: 701px) { .group-detail-right { width: 340px; flex-shrink: 0; } }
        `}</style>
        <div className="group-detail-grid">
          <div className="group-detail-left" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <StatCard label="Persone" value={nPax} icon={
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" stroke="#1E6BF1" strokeWidth="1.8"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="#1E6BF1" strokeWidth="1.8" strokeLinecap="round"/><path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87" stroke="#1E6BF1" strokeWidth="1.8" strokeLinecap="round"/></svg>
              } color="#1E6BF1" />
              <StatCard label="Maschi" value={males} icon={
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="5" stroke="#1E6BF1" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#1E6BF1" strokeWidth="1.8" strokeLinecap="round"/></svg>
              } color="#1E6BF1" />
              <StatCard label="Femmine" value={females} icon={
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="5" stroke="#D4537E" strokeWidth="1.8"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#D4537E" strokeWidth="1.8" strokeLinecap="round"/></svg>
              } color="#D4537E" />
            </div>

            {/* Servizi */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Servizi acquistati</div>
              <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {useQta ? services.map((sv, i) => {
                  const qty = group[sv.id] || 0
                  const active = qty > 0
                  const isSaving = saving === sv.id
                  const pbKey = prebookKeyForService(sv.id)
                  const prebooked = pbKey && group.prebook && group.prebook[pbKey] != null ? Number(group.prebook[pbKey]) : null
                  const short = prebooked != null && qty < prebooked
                  const isEsc = pbKey === 'escursioni'
                  const prebPagato = isPrebookingPagato(sv.id, group.destination, group.shift_num)
                  const prebEsc = isEsc ? (prebooked || 0) : 0
                  const lockedEsc = prebEsc > 0                       // escursioni: bloccate, con conteggio confermabile
                  // SSP (o altri) prenotati E pagati in prebooking (turni bonifico): bloccati e NON modificabili
                  const lockedSspPreb = !isEsc && prebPagato && (prebooked || 0) > 0
                  const lockedPrebook = lockedEsc || lockedSspPreb   // qualsiasi servizio pagato in prebooking
                  const confQty = lockedEsc ? (group.escursioni_conf != null ? group.escursioni_conf : prebEsc) : qty
                  const shownActive = lockedPrebook ? true : active
                  const svMetodo = (group.servizi_metodo || {})[sv.id]
                  // Acceso ma senza metodo -> va segnalato (esclude ciò che è già pagato in prebooking)
                  const needsMetodo = shownActive && !lockedPrebook && !svMetodo
                  const locked = lockedPrebook || !canEditServizi   // bloccato se pagato prebooking o sola lettura
                  const paidMeta = (group[sv.id] || 0) > 0
                  // Stato colorato del servizio (coerente con la legenda)
                  let stato
                  if (prebooked && prebPagato) stato = { label: 'Prebooking pagato', c: 'var(--iv-blue)', bg: 'var(--iv-blue-light)', bd: 'var(--iv-blue-mid)' }
                  else if (paidMeta)   stato = { label: 'Incassato', c: '#15803D', bg: '#DCFCE7', bd: '#BBF7D0' }
                  else if (prebooked)  stato = { label: 'Da incassare', c: '#B91C1C', bg: '#FEE2E2', bd: '#FECACA' }
                  else                 stato = { label: 'Assente', c: '#64748B', bg: '#F1F5F9', bd: '#E2E8F0' }
                  return (
                    <div key={sv.id} style={{ borderBottom: i < services.length - 1 ? '0.5px solid var(--border)' : 'none', ...(needsMetodo ? { borderLeft: '3px solid #DC2626', background: '#FEF2F2' } : {}) }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                      {/* Label */}
                      <div style={{ flex: 1, cursor: locked ? 'default' : 'pointer' }} onClick={() => { if (!locked) toggleQtaService(sv.id) }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: shownActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{sv.label}</span>
                          {needsMetodo && <AlertTriangle size={15} color="#DC2626" style={{ flexShrink: 0 }} />}
                          {prebooked != null && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap',
                              background: prebPagato ? 'var(--iv-blue-light)' : '#FEE2E2',
                              color: prebPagato ? 'var(--iv-blue)' : '#B91C1C',
                              border: '0.5px solid ' + (prebPagato ? 'var(--iv-blue-mid)' : '#FECACA') }}>
                              prenotate {prebooked}
                            </span>
                          )}
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap', background: stato.bg, color: stato.c, border: '0.5px solid ' + stato.bd }}>{stato.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {lockedPrebook
                            ? <span style={{ color: '#16A34A', fontWeight: 600 }}>{lockedEsc ? 'Già pagate in prebooking' : 'Già pagato in prebooking'}</span>
                            : <>€{sv.prezzo} × {qty} = <span style={{ fontWeight: 600, color: active ? 'var(--iv-blue)' : 'var(--text-tertiary)' }}>€{sv.prezzo * qty}</span></>}
                          {isSaving && <span style={{ marginLeft: 8, fontSize: 10 }}>salvo...</span>}
                        </div>
                      </div>
                      {/* Numero modificabile */}
                      {lockedEsc ? (
                        <input
                          type="number" min="0" max={prebEsc}
                          value={confQty}
                          disabled={!canEditServizi}
                          onChange={e => setGroup(prev => ({ ...prev, escursioni_conf: Math.max(0, Math.min(parseInt(e.target.value, 10) || 0, prebEsc)) }))}
                          onBlur={saveEscConf}
                          style={{ width: 56, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center', fontSize: 14, fontWeight: 600, opacity: canEditServizi ? 1 : 0.5, background: canEditServizi ? '#fff' : 'var(--bg-secondary)' }}
                        />
                      ) : lockedSspPreb ? (
                        <input
                          type="number"
                          value={prebooked || 0}
                          disabled readOnly
                          title="Pagato in prebooking — non modificabile"
                          style={{ width: 56, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center', fontSize: 14, fontWeight: 600, opacity: 0.6, background: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                        />
                      ) : (
                        <input
                          type="number" min="0"
                          value={qty}
                          disabled={!canEditServizi}
                          onChange={e => updateQtaService(sv.id, e.target.value)}
                          onBlur={() => saveQtaService(sv.id)}
                          style={{ width: 56, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center', fontSize: 14, fontWeight: 600, opacity: canEditServizi ? 1 : 0.5, background: canEditServizi ? '#fff' : 'var(--bg-secondary)' }}
                        />
                      )}
                      {/* Toggle */}
                      <div onClick={() => { if (!locked) toggleQtaService(sv.id) }} title={!canEditServizi ? 'Solo CM, Referente Meta e Ufficio possono modificare i servizi' : (lockedPrebook ? 'Già pagato in prebooking (bloccato)' : '')} style={{ width: 46, height: 26, borderRadius: 13, background: shownActive ? 'var(--iv-blue)' : '#D1D5DB', position: 'relative', flexShrink: 0, cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.85 : 1, transition: 'background 0.2s' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: shownActive ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }} />
                      </div>
                      </div>
                      {/* Metodo di pagamento — compare solo quando il servizio è attivo e NON già pagato in prebooking */}
                      {shownActive && !lockedPrebook && canEditServizi && (
                        <div style={{ padding: '0 18px 14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 2 }}>Pagato con</span>
                            {METODI.map(mt => {
                              const on = (group.servizi_metodo || {})[sv.id] === mt
                              const c = METODO_COLORS[mt] || '#64748B'
                              return (
                                <button key={mt} onClick={() => setMetodo(sv.id, mt)} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: on ? c : 'var(--bg-secondary)', color: on ? '#fff' : 'var(--text-secondary)', border: '1px solid ' + (on ? c : 'var(--border)'), transition: 'all 0.15s' }}>{mt}</button>
                              )
                            })}
                          </div>
                          {needsMetodo && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '7px 10px', borderRadius: 8, background: '#FEE2E2', color: '#991B1B', fontSize: 11.5, fontWeight: 600 }}>
                              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                              Seleziona il metodo di pagamento, altrimenti il servizio non finisce in cassa né in rendicontazione.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                }) : SERVICES.map((sv, i) => {
                  const Icon = ServiceIcons[sv.id] || ServiceIcons.pkg_escursioni
                  const active = !!group[sv.id]
                  const isSaving = saving === sv.id
                  return (
                    <div key={sv.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: i < SERVICES.length - 1 ? '0.5px solid var(--border)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                      onClick={() => toggleService(sv.id)}>
                      {/* Icona */}
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: active ? 'rgba(30,107,241,0.08)' : 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? 'var(--iv-blue)' : 'var(--text-tertiary)', flexShrink: 0, transition: 'all 0.2s' }}>
                        <Icon />
                      </div>
                      {/* Label */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{sv.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          €{sv.prezzo} × {nPax} pax = <span style={{ fontWeight: 600, color: active ? 'var(--iv-blue)' : 'var(--text-tertiary)' }}>€{sv.prezzo * nPax}</span>
                          {isSaving && <span style={{ marginLeft: 8, fontSize: 10 }}>salvo...</span>}
                        </div>
                      </div>
                      {/* Toggle */}
                      <div style={{ width: 46, height: 26, borderRadius: 13, background: active ? 'var(--iv-blue)' : '#D1D5DB', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: active ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Riepilogo tabella */}
            {riepilogoRows.length > 0 && (
              <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Servizio</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', textAlign: 'right', paddingRight: 16 }}>€/pax</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', textAlign: 'right', minWidth: 64 }}>Totale</div>
                </div>
                {riepilogoRows.map((r, i, arr) => (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', padding: '11px 16px', borderBottom: i < arr.length - 1 ? '0.5px solid var(--border)' : 'none', alignItems: 'center' }}>
                    <div style={{ fontSize: 13 }}>{r.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'right', paddingRight: 16 }}>€{r.prezzoUnit}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'right', minWidth: 64 }}>€{r.totale}</div>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '12px 16px', background: 'var(--iv-blue)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>TOTALE</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>€{costoTotale}</div>
                </div>
              </div>
            )}

            {/* Alloggio */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🏠</span> Alloggio
              </div>
              {editingAlloggio ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input className="input-field" placeholder="Alloggio del gruppo..." value={group.alloggio || ''} onChange={e => updateField('alloggio', e.target.value)} autoFocus />
                  <button onClick={() => saveField('alloggio')} style={{ alignSelf: 'flex-end', padding: '8px 20px', background: 'var(--iv-blue)', color: '#fff', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Salva</button>
                </div>
              ) : (
                <div onClick={() => { if (canEditServizi) setEditingAlloggio(true) }} style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 12, border: '0.5px solid var(--border)', cursor: canEditServizi ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 14, color: group.alloggio ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: group.alloggio ? 500 : 400, fontStyle: group.alloggio ? 'normal' : 'italic', flex: 1 }}>{group.alloggio || (canEditServizi ? 'Aggiungi alloggio' : '—')}</span>
                  {canEditServizi && <Edit2 size={14} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />}
                </div>
              )}
            </div>

            {/* Note */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📝</span> Note
              </div>
              {editingNote ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea className="input-field" rows={3} style={{ resize: 'none', lineHeight: 1.6 }} placeholder="Note sul gruppo..." value={group.note || ''} onChange={e => updateField('note', e.target.value)} autoFocus />
                  <button onClick={() => saveField('note')} style={{ alignSelf: 'flex-end', padding: '8px 20px', background: 'var(--iv-blue)', color: '#fff', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Salva</button>
                </div>
              ) : (
                <div onClick={() => { if (canEditServizi) setEditingNote(true) }} style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 12, border: '0.5px solid var(--border)', cursor: canEditServizi ? 'pointer' : 'default', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, minHeight: 60 }}>
                  <span style={{ fontSize: 14, color: group.note ? 'var(--text-primary)' : 'var(--text-tertiary)', lineHeight: 1.5, flex: 1 }}>{group.note || 'Nessuna nota'}</span>
                  {canEditServizi && <Edit2 size={14} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: 2 }} />}
                </div>
              )}
            </div>

          </div>

          {/* COLONNA DESTRA — Partecipanti */}
          <div className="group-detail-right">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              Partecipanti ({nPax}{participants.length !== nPax ? ` di ${participants.length}` : ''})
            </div>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {participants.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Nessun partecipante</div>
              ) : participants.map((p, i) => {
                const isMale = p.sesso === 'M'
                const isActive = p.attivo !== false
                const color = isMale ? '#1E6BF1' : '#D4537E'
                const age = calcAge(p.nascita)
                const isExpanded = expandedId === p.id
                const fmtDate = d => {
                  if (!d) return null
                  const dt = new Date(d)
                  return isNaN(dt) ? d : dt.toLocaleDateString('it-IT')
                }
                const legacyFlags = [
                  { label: 'Escursioni', on: !!p.escursioni },
                  { label: 'Navetta', on: !!p.navetta },
                  { label: 'Assicurazione', on: !!p.assicurazione },
                  { label: 'Iscrizione', on: !!p.iscrizione },
                ]
                return (
                  <div key={p.id} style={{ borderBottom: i < participants.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', opacity: isActive ? 1 : 0.45 }}>
                      <div onClick={() => setExpandedId(isExpanded ? null : p.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: color + '15', border: '1.5px solid ' + color + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
                          {getInitials(p.nome + ' ' + p.cognome)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', textDecoration: isActive ? 'none' : 'line-through' }}>{p.cognome} {p.nome}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                            {isActive ? (age !== null ? `${age} anni` : '') : 'Non partecipa'}
                          </div>
                        </div>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0, color: 'var(--text-tertiary)' }}>
                          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div style={{ width: 24, height: 24, borderRadius: 8, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>
                        {p.sesso}
                      </div>
                      <div
                        onClick={() => { if (canEditServizi) toggleParticipantActive(p.id) }}
                        style={{ width: 40, height: 22, borderRadius: 11, background: isActive ? 'var(--iv-blue)' : '#D1D5DB', position: 'relative', flexShrink: 0, cursor: canEditServizi ? 'pointer' : 'not-allowed', opacity: canEditServizi ? 1 : 0.85, transition: 'background 0.2s' }}
                        title={!canEditServizi ? 'Solo CM, Referente Meta e Ufficio possono modificare le presenze' : (isActive ? 'Segna come non partecipante' : 'Riattiva partecipante')}
                      >
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: isActive ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }} />
                      </div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '4px 16px 16px 16px', background: 'var(--bg-secondary)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                          <InfoField label="Data di nascita" value={fmtDate(p.nascita)} />
                          <InfoField label="Sesso" value={p.sesso} />
                          <InfoField label="Telefono" value={p.telefono} href={p.telefono ? 'tel:' + p.telefono : null} />
                          <InfoField label="E-Mail" value={p.email} href={p.email ? 'mailto:' + p.email : null} wide />
                          <InfoField label="Nazionalità" value={p.nazionalita} />
                          <InfoField label="Pratica" value={p.pratica} />
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 12 }}>
                          {legacyFlags.map(f => (
                            <span key={f.label} className={`flag-chip ${f.on ? 'on' : ''}`}><span className="dot" />{f.label}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}

function InfoField({ label, value, wide, href }) {
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      {href && value
        ? <a href={href} style={{ fontSize: 12, color: 'var(--accent, #1E6BF1)', marginTop: 2, display: 'block', textDecoration: 'none', wordBreak: 'break-word' }}>{value}</a>
        : <div style={{ fontSize: 12, color: value ? 'var(--text-primary)' : 'var(--text-tertiary)', marginTop: 2, wordBreak: 'break-word' }}>{value || '—'}</div>}
    </div>
  )
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: color === '#D4537E' ? 'rgba(212,83,126,0.08)' : 'rgba(30,107,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}
