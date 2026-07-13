import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PaxContentTab from '../components/PaxContentTab'
import { Upload, Plus, X, ArrowDownCircle, ArrowUpCircle, ChevronLeft } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { sendCassaToSheet } from '../lib/sheetsSync'
import { useAuth } from '../context/AuthContext'
import { parseTurnoExcel, DESTINATIONS, SHIFTS, shiftLabel, SERVICES, SERVICES_CORFU, getServices, capogruppoCode, prebookKeyForService, isPrebookingPagato } from '../lib/constants'

// Tutti gli id colonna servizio (unione di tutte le mete) per il fetch incassi
const ALL_SERVICE_IDS = [...new Set(DESTINATIONS.flatMap(d => getServices(d.id).map(s => s.id)))]
import { getCategorie } from '../lib/constants'
import Topbar from '../components/Topbar'

export default function Admin() {
  const navigate = useNavigate()
  const { isFullAccess, canImport, canEditCassa, profile } = useAuth()
  // Scope ai turni assegnati per CM/ACM (null = accesso globale).
  const scopeShifts = isFullAccess ? null : (profile?.assigned_shifts || [])
  const scopeSet = scopeShifts ? new Set(scopeShifts.map(s => `${s.destination}__${s.shift_num}`)) : null
  const inScope = (dest, num) => !scopeSet || scopeSet.has(`${dest}__${num}`)
  const [tab, setTab] = useState(canImport ? 'import' : 'staff')
  const [importing, setImporting] = useState(false)
  const [importLog, setImportLog] = useState([])
  const [progress, setProgress] = useState(null)
  const [staffList, setStaffList] = useState([])
  const [stats, setStats] = useState(null)
  const [incassiData, setIncassiData] = useState(null)

  useEffect(() => {
    if (tab === 'staff') fetchStaff()
    if (tab === 'stats') fetchStats()
    if (tab === 'incassi') fetchIncassi()
  }, [tab])

  async function fetchStaff() {
    const { data } = await supabase.from('staff_profiles').select('*').order('cognome')
    const list = (data || []).filter(s => isFullAccess || (s.assigned_shifts || []).some(sh => inScope(sh.destination, sh.shift_num)))
    setStaffList(list)
  }

  async function fetchStats() {
    setStats(null)
    const PAGE = 1000
    // --- gruppi (paginati) con tutte le colonne quantità servizi ---
    let groups = [], from = 0
    while (true) {
      const { data } = await supabase.from('groups')
        .select('id, destination, shift_num, ' + ALL_SERVICE_IDS.join(', '))
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      groups = groups.concat(data)
      if (data.length < PAGE) break
      from += PAGE
    }
    // --- partecipanti attivi per gruppo (paginati) ---
    const partCount = {}
    let pfrom = 0
    while (true) {
      const { data } = await supabase.from('participants')
        .select('group_id, attivo').range(pfrom, pfrom + PAGE - 1)
      if (!data || data.length === 0) break
      data.forEach(p => { if (p.attivo !== false) partCount[p.group_id] = (partCount[p.group_id] || 0) + 1 })
      if (data.length < PAGE) break
      pfrom += PAGE
    }
    const scopedGroups = groups.filter(g => inScope(g.destination, g.shift_num))
    const totalParts = scopedGroups.reduce((a, g) => a + (partCount[g.id] || 0), 0)
    setStats({
      groups: scopedGroups.map(g => ({ ...g, num_partecipanti: partCount[g.id] || 0 })),
      totalParts,
    })
  }

  async function fetchIncassi() {
    try {
      // Carica tutti i gruppi con paginazione
      let groups = []
      let gFrom = 0
      const pageSize = 1000
      while (true) {
        const { data: page, error } = await supabase
          .from('groups')
          .select('id, capogruppo_code, capogruppo_display, destination, shift_num, prebook, escursioni_conf, ' + ALL_SERVICE_IDS.join(', '))
          .order('destination').order('shift_num').order('capogruppo_display')
          .range(gFrom, gFrom + pageSize - 1)
        if (error) { console.error(error); setIncassiData([]); return }
        if (!page || page.length === 0) break
        groups = groups.concat(page)
        if (page.length < pageSize) break
        gFrom += pageSize
      }

      // Conta partecipanti (attivi e rimossi) con paginazione
      const countMap = {}
      const rimossiMap = {}
      let from = 0
      while (true) {
        const { data: page } = await supabase
          .from('participants')
          .select('group_id, attivo')
          .range(from, from + pageSize - 1)
        if (!page || page.length === 0) break
        page.forEach(p => {
          if (p.attivo !== false) countMap[p.group_id] = (countMap[p.group_id] || 0) + 1
          else rimossiMap[p.group_id] = (rimossiMap[p.group_id] || 0) + 1
        })
        if (page.length < pageSize) break
        from += pageSize
      }
      setIncassiData(groups.filter(g => inScope(g.destination, g.shift_num)).map(g => ({ ...g, num_partecipanti: countMap[g.id] || 0, num_rimossi: rimossiMap[g.id] || 0 })))
    } catch (e) {
      console.error(e)
      setIncassiData([])
    }
  }

  function log(msg) { setImportLog(prev => [...prev, msg]) }

  function formatCapogruppo(code) {
    const match = code.match(/^\d+(.+)$/)
    if (match) {
      const s = match[1].trim()
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    }
    return code
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportLog([])
    setProgress({ label: 'Lettura del file…', pct: 4 })
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { cellDates: true })

      const shPratiche = wb.Sheets['NON TOCCARE 121']
      const shPart = wb.Sheets['NON TOCCARE 542']
      if (!shPratiche || !shPart) {
        log('❌ File non valido: mancano le schede "NON TOCCARE 121" e/o "NON TOCCARE 542".')
        log('Carica il file CM completo (con le 3 estrazioni AVES).')
        setImporting(false); setProgress(null); e.target.value = ''; return
      }

      const txt = v => (v === undefined || v === null) ? '' : String(v).trim()
      const toDate = v => {
        if (v instanceof Date && !isNaN(v)) {
          const o = new Date(v.getTime() - v.getTimezoneOffset() * 60000)
          return o.toISOString().slice(0, 10)
        }
        return v ? String(v) : null
      }
      function asRows(ws) {
        const arr = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false })
        const header = (arr[0] || []).map(h => txt(h))
        const idx = {}; header.forEach((h, i) => { idx[h] = i })
        return { rows: arr.slice(1), get: (row, name) => row[idx[name]] }
      }
      const nameKey = (cognome, nome, nascita) =>
        txt(cognome).toLowerCase() + '|' + txt(nome).toLowerCase() + '|' + (nascita ? String(nascita).slice(0, 10) : '')

      // ---- 121 -> gruppi (uno per pratica) ----
      const P = asRows(shPratiche)
      const groupsByPratica = {}
      const skip = { stage: 0, winter: 0, altro: 0, staffbook: 0 }
      for (const r of P.rows) {
        const pratica = txt(P.get(r, 'N Pratica'))
        if (!pratica) continue
        const desc = txt(P.get(r, 'Descrizione pratica'))
        const parsed = parseTurnoExcel(desc)
        if (!parsed) {
          const d = desc.toUpperCase()
          if (d.includes('STAGE')) skip.stage++
          else if (d.includes('WINTER') || d.includes('SESTRIERE')) skip.winter++
          else skip.altro++
          continue
        }
        const code = txt(P.get(r, 'Richiedente'))
        if (code.toUpperCase().includes('STAFF')) { skip.staffbook++; continue } // prenotazioni staff: non sono gruppi partecipanti
        groupsByPratica[pratica] = {
          pratica, capogruppo_code: code, capogruppo_display: formatCapogruppo(code),
          destination: parsed.destination, shift_num: parsed.shift_num, participants: []
        }
      }

      // ---- 1294 -> assicurazione / iscrizione per pratica ----
      const assicSet = new Set(), iscrSet = new Set()
      const shServizi = wb.Sheets['NON TOCCARE 1294']
      if (shServizi) {
        const S = asRows(shServizi)
        for (const r of S.rows) {
          const prat = txt(S.get(r, 'N pratica'))
          const cod = txt(S.get(r, 'Servizio'))
          if (!prat || !cod) continue
          if (cod === 'ASSMEDEURO') { assicSet.add(prat); iscrSet.add(prat) } // ISCRIZIONE & ASS. MEDICA
          else if (cod === 'BAGA') assicSet.add(prat)                          // ASS. BAGAGLIO
          else if (cod === 'PREM') iscrSet.add(prat)                           // ISCRIZIONE PREMIUM
        }
      }

      // ---- 542 -> partecipanti ----
      const A = asRows(shPart)
      for (const r of A.rows) {
        const pratica = txt(A.get(r, 'Pratica'))
        const g = groupsByPratica[pratica]
        if (!g) continue
        const nm = txt(A.get(r, 'Nome'))
        g.participants.push({
          cognome: txt(A.get(r, 'Cognome')).toUpperCase(),
          nome: nm ? nm.charAt(0).toUpperCase() + nm.slice(1).toLowerCase() : '',
          sesso: txt(A.get(r, 'Sesso')).toUpperCase(),
          nascita: toDate(A.get(r, 'Data Nascita')),
          nazionalita: txt(A.get(r, 'Descrizione stato nazionalità')),
          tipo_documento: txt(A.get(r, 'Tipo documento')),
          numero_documento: txt(A.get(r, 'Numero documento')),
          data_emissione: toDate(A.get(r, 'Emesso il')),
          data_scadenza: toDate(A.get(r, 'Scade il')),
          assicurazione: assicSet.has(pratica),
          iscrizione: iscrSet.has(pratica),
          citta_partenza: '', pratica, stato: '',
        })
      }

      const groups = Object.values(groupsByPratica)
      const totPart = groups.reduce((t, g) => t + g.participants.length, 0)
      const senzaAnag = groups.filter(g => g.participants.length === 0).length
      log('Lette ' + groups.length + ' pratiche, ' + totPart + ' persone')
      if (senzaAnag) log('ℹ️ ' + senzaAnag + ' pratiche senza anagrafica (nomi non ancora caricati)')
      const skipTot = skip.stage + skip.winter + skip.altro
      if (skipTot) log('Saltate ' + skipTot + ' pratiche non-turno (' + skip.stage + ' stage staff, ' + skip.winter + ' winter, ' + skip.altro + ' altre)')
      if (skip.staffbook) log('Saltate ' + skip.staffbook + ' prenotazioni staff (codice "STAFF")')

      // ---- prefetch gruppi e partecipanti esistenti (per preservare "non presente") ----
      const exGroups = []
      let gFrom = 0
      while (true) {
        const { data: gChunk } = await supabase.from('groups').select('id, pratica, capogruppo_code, destination, shift_num').range(gFrom, gFrom + 999)
        if (!gChunk || gChunk.length === 0) break
        exGroups.push(...gChunk)
        if (gChunk.length < 1000) break
        gFrom += 1000
      }
      const gByPratica = {}, gByCg = {}
      ;(exGroups || []).forEach(g => {
        if (g.pratica) gByPratica[g.pratica] = g.id
        gByCg[g.capogruppo_code + '|' + g.destination + '|' + g.shift_num] = g.id
      })

      const attivoMap = {} // groupId::nameKey -> attivo
      let from = 0; const page = 1000
      while (true) {
        const { data: chunk } = await supabase.from('participants').select('group_id, cognome, nome, nascita, attivo').range(from, from + page - 1)
        if (!chunk || chunk.length === 0) break
        chunk.forEach(p => { attivoMap[p.group_id + '::' + nameKey(p.cognome, p.nome, p.nascita)] = p.attivo })
        if (chunk.length < page) break
        from += page
      }

      // ---- risolvi/crea gruppi ----
      setProgress({ label: 'Sincronizzo i gruppi…', pct: 12 })
      let nuoviG = 0, aggG = 0, errors = 0
      const errSamples = new Set()
      const touchedGroupIds = []
      let gi = 0
      for (const g of groups) {
        if (++gi % 15 === 0) setProgress({ label: `Sincronizzo i gruppi… (${gi}/${groups.length})`, pct: 12 + Math.round((gi / groups.length) * 46) })
        let groupId = gByPratica[g.pratica] || gByCg[g.capogruppo_code + '|' + g.destination + '|' + g.shift_num] || null
        const payload = { capogruppo_code: g.capogruppo_code, capogruppo_display: g.capogruppo_display, destination: g.destination, shift_num: g.shift_num, pratica: g.pratica }
        if (groupId) {
          const { error } = await supabase.from('groups').update(payload).eq('id', groupId)
          if (error) { errors++; if (errSamples.size < 6) errSamples.add('UPD ' + g.pratica + ': ' + error.message); continue }
          aggG++
        } else {
          const { data: newG, error } = await supabase.from('groups').insert(payload).select('id').single()
          if (error) { errors++; if (errSamples.size < 6) errSamples.add('INS ' + g.pratica + ': ' + error.message); continue }
          groupId = newG.id; nuoviG++
        }
        g._groupId = groupId
        touchedGroupIds.push(groupId)
      }

      // ---- partecipanti: cancella sui gruppi toccati e reinserisci preservando "attivo" ----
      setProgress({ label: 'Preparo i partecipanti…', pct: 60 })
      let spariti = 0, caricati = 0
      for (let i = 0; i < touchedGroupIds.length; i += 200) {
        const slice = touchedGroupIds.slice(i, i + 200)
        await supabase.from('participants').delete().in('group_id', slice)
      }
      const toInsert = []
      for (const g of groups) {
        if (!g._groupId) continue
        const fileKeys = new Set(g.participants.map(p => nameKey(p.cognome, p.nome, p.nascita)))
        Object.keys(attivoMap).forEach(k => {
          if (k.startsWith(g._groupId + '::') && !fileKeys.has(k.split('::')[1])) spariti++
        })
        for (const p of g.participants) {
          const k = g._groupId + '::' + nameKey(p.cognome, p.nome, p.nascita)
          const att = (k in attivoMap) ? attivoMap[k] : true
          toInsert.push({ ...p, group_id: g._groupId, attivo: att })
        }
      }
      for (let i = 0; i < toInsert.length; i += 500) {
        setProgress({ label: `Carico i partecipanti… (${Math.min(i + 500, toInsert.length)}/${toInsert.length})`, pct: 64 + Math.round((i / Math.max(toInsert.length, 1)) * 34) })
        const { error } = await supabase.from('participants').insert(toInsert.slice(i, i + 500))
        if (error) { errors++; if (errSamples.size < 6) errSamples.add('PART: ' + error.message) } else caricati += Math.min(500, toInsert.length - i)
      }
      setProgress({ label: errors ? 'Completato con avvisi' : 'Completato', pct: 100 })

      log('✅ Pratiche: ' + nuoviG + ' nuove, ' + aggG + ' aggiornate')
      log('✅ Persone caricate: ' + caricati + ' — "non presente" preservato')
      if (spariti) log('⚠️ ' + spariti + ' persone non più nel file (annullate dall\'ufficio)')
      if (errors) {
        log('❌ Errori: ' + errors)
        errSamples.forEach(m => log('   • ' + m))
      }
      log('Fatto.')
    } catch (err) {
      log('❌ Errore: ' + err.message)
      setProgress(null)
    }
    setImporting(false)
    e.target.value = ''
  }

  async function toggleAssignment(staffId, destination, shiftNum) {
    const staff = staffList.find(s => s.id === staffId)
    const current = staff.assigned_shifts || []
    const exists = current.some(s => s.destination === destination && s.shift_num === shiftNum)
    const updated = exists
      ? current.filter(s => !(s.destination === destination && s.shift_num === shiftNum))
      : [...current, { destination, shift_num: shiftNum }]
    await supabase.from('staff_profiles').update({ assigned_shifts: updated }).eq('id', staffId)
    setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, assigned_shifts: updated } : s))
  }

  return (
    <div className="page">
      <div className="sticky-header">
      <Topbar showBack={true} showAvatar={false} />
      <div className="tabs">
        {canImport && <button className={'tab ' + (tab === 'import' ? 'active' : '')} onClick={() => setTab('import')}>Import Excel</button>}
        <button className={'tab ' + (tab === 'staff' ? 'active' : '')} onClick={() => setTab('staff')}>Staff</button>
        <button className={'tab ' + (tab === 'stats' ? 'active' : '')} onClick={() => setTab('stats')}>Statistiche</button>
        <button className={'tab ' + (tab === 'premi' ? 'active' : '')} onClick={() => setTab('premi')}>🏆 Premi</button>
        <button className={'tab ' + (tab === 'incassi' ? 'active' : '')} onClick={() => setTab('incassi')}>💰 Incassi</button>
        <button className={'tab ' + (tab === 'cassa' ? 'active' : '')} onClick={() => setTab('cassa')}>👛 Cassa</button>
        <button className={'tab ' + (tab === 'pax' ? 'active' : '')} onClick={() => setTab('pax')}>📱 Contenuti pax</button>
      </div>
      </div>

      {canImport && tab === 'import' && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ textAlign: 'center', padding: 24 }}>
            <Upload size={32} color="var(--iv-blue)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Carica file Excel partecipanti</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>File CM completo con schede AVES. I "non presente" vengono mantenuti.</div>
            <label style={{ display: 'inline-block', padding: '10px 20px', background: 'var(--iv-blue)', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {importing ? 'Importazione...' : 'Seleziona file'}
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} disabled={importing} />
            </label>
          </div>
          {progress && (
            <div className="card" style={{ padding: 20, overflow: 'hidden' }}>
              <style>{`
                @keyframes iv-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
                @keyframes iv-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
                @keyframes iv-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
              `}</style>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {progress.pct < 100 ? (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(30,107,241,0.18)', borderTopColor: 'var(--iv-blue)', animation: 'spin 0.7s linear infinite' }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#16A34A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, animation: 'iv-pop 0.3s ease-out' }}>✓</div>
                  )}
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', animation: progress.pct < 100 ? 'iv-pulse 1.4s ease-in-out infinite' : 'none' }}>{progress.label}</div>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: progress.pct < 100 ? 'var(--iv-blue)' : '#16A34A', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{progress.pct}%</div>
              </div>
              <div style={{ height: 12, borderRadius: 8, background: 'var(--bg-secondary)', overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${progress.pct}%`, borderRadius: 8, background: progress.pct < 100 ? 'linear-gradient(90deg, #1E6BF1, #5B9BFF)' : 'linear-gradient(90deg, #16A34A, #4ADE80)', transition: 'width 0.45s cubic-bezier(0.4,0,0.2,1)', position: 'relative', overflow: 'hidden' }}>
                  {progress.pct < 100 && (
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '45%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)', animation: 'iv-shimmer 1.3s ease-in-out infinite' }} />
                  )}
                </div>
              </div>
            </div>
          )}
          {importLog.length > 0 && (
            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(30,107,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10" stroke="var(--iv-blue)" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Log importazione</div>
              </div>
              {importLog.map((line, i) => {
                const isSuccess = line.trim().startsWith('✅')
                const isError = line.trim().startsWith('❌')
                const clean = line.replace(/^[✅❌]\s*/, '')
                const isLast = i === importLog.length - 1
                const dotColor = isSuccess ? '#16A34A' : isError ? '#DC2626' : 'var(--iv-blue)'
                const dotBg = isSuccess ? 'rgba(22,163,74,0.12)' : isError ? 'rgba(220,38,38,0.12)' : 'rgba(30,107,241,0.08)'
                const textColor = isSuccess ? '#16A34A' : isError ? '#DC2626' : 'var(--text-secondary)'
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: isLast ? 0 : 16 }}>
                    {!isLast && <div style={{ position: 'absolute', left: 11, top: 24, bottom: -2, width: 2, background: 'var(--border)' }} />}
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: dotBg, color: dotColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, zIndex: 1 }}>
                      {isSuccess ? '✓' : isError ? '✕' : i + 1}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: (isSuccess || isError) ? 700 : 500, color: textColor, paddingTop: 2 }}>{clean}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'staff' && (
        <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {staffList.map(staff => (
            <StaffCard key={staff.id} staff={staff} />
          ))}
          {staffList.length === 0 && <div className="empty-state"><p>Nessuno staff registrato.</p></div>}
        </div>
      )}

      {tab === 'stats' && (stats ? <StatsTab stats={stats} /> : (
        <div style={{ padding: '60px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--text-secondary)' }}>
          <div className="spinner" />
          <div style={{ fontSize: 13 }}>Carico le statistiche…</div>
        </div>
      ))}
      {tab === 'premi' && <PremiTab scope={scopeShifts} />}
      {tab === 'incassi' && <IncassiTab data={incassiData} loading={!incassiData} onRefresh={fetchIncassi} />}
      {tab === 'cassa' && <CassaTab />}
      {tab === 'pax' && <PaxContentTab scope={scopeShifts} />}
    </div>
  )
}

function StaffCard({ staff }) {
  const [open, setOpen] = useState(false)
  const assigned = staff.assigned_shifts || []
  const initials = ((staff.nome?.[0] || '') + (staff.cognome?.[0] || '')).toUpperCase()
  const inattivo = staff.attivo === false
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('it-IT') : null
  const info = [
    ['Ruolo', staff.ruolo],
    ['Tipologia', staff.tipologia],
    ['Nascita', fmtDate(staff.nascita)],
    ['Città', staff.citta],
    ['Sesso', staff.sesso],
    ['Telefono', staff.telefono],
    ['Email', staff.email],
    ['Taglia maglia', staff.taglia_maglia],
    ['Anno ingresso', staff.anno_ingresso],
    ['Crew leader', staff.crew_leader],
    ['Settimane 2024', staff.settimane_2024],
    ['Settimane 2025', staff.settimane_2025],
    ['Settimane 2026', staff.settimane_2026],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '')
  return (
    <div className="card" style={inattivo ? { opacity: 0.6 } : undefined}>
      <button style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => setOpen(o => !o)}>
        <div className="initials" style={{ width: 36, height: 36, fontSize: 12 }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            {staff.nome} {staff.cognome}
            {inattivo && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', border: '0.5px solid #FCA5A5', padding: '1px 6px', borderRadius: 20, textTransform: 'uppercase' }}>disattivato</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{staff.role === 'admin' ? 'Admin' : (staff.ruolo || (assigned.length + ' turni assegnati'))}</div>
        </div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 18 }}>{open ? '▲' : '▼'}</div>
      </button>

      {open && (
        <div style={{ marginTop: 12, borderTop: '0.5px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {info.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
              {info.map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{String(value)}</div>
                </div>
              ))}
            </div>
          )}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 5 }}>Turni assegnati</div>
            {assigned.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Nessun turno assegnato</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {assigned.map((a, i) => (
                  <span key={i} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'var(--iv-blue-light)', color: 'var(--iv-blue)', border: '0.5px solid var(--iv-blue)' }}>
                    {(DESTINATIONS.find(d => d.id === a.destination)?.name || a.destination)} · {shiftLabel(a.destination, a.shift_num)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const DEST_COLORS = {
  pag: '#1E6BF1', corfu: '#059669', zante: '#D97706',
  gallipoli: '#DC2626', sardegna: '#7C3AED',
}

const SVC_PALETTE = ['#1E6BF1', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0EA5E9', '#DB2777', '#65A30D', '#EA580C', '#4F46E5']

const fmtEur = (n) => '€ ' + Math.round(n || 0).toLocaleString('it-IT')
const fmtNum = (n) => (n || 0).toLocaleString('it-IT')

// Per una lista di gruppi + i servizi della meta: quantità venduta, n. gruppi col servizio, incasso (qta*prezzo)
function computeServices(grp, services) {
  return services.map((s, i) => {
    let qty = 0, groupsWith = 0
    for (const g of grp) {
      const v = Number(g[s.id]) || 0
      if (v > 0) { qty += v; groupsWith++ }
    }
    return { ...s, qty, groupsWith, revenue: qty * (s.prezzo || 0), color: SVC_PALETTE[i % SVC_PALETTE.length] }
  })
}

function chipStyle(active, col) {
  return { padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: active ? col : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (active ? col : 'var(--border)') }
}

function KpiCard({ value, label, accent, icon }) {
  return (
    <div className="card" style={{ padding: '14px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: accent }} />
      <div style={{ fontSize: 17, marginBottom: 3 }}>{icon}</div>
      <div style={{ fontSize: 23, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>{label}</div>
    </div>
  )
}

// Riga servizio: label, quantità, incasso, barra = % gruppi che hanno il servizio
function ServiceRow({ s, totalGroups }) {
  const pct = totalGroups > 0 ? Math.round((s.groupsWith / totalGroups) * 100) : 0
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{ width: 8, height: 8, borderRadius: 3, background: s.color, flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtNum(s.qty)} pz</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{fmtEur(s.revenue)}</span>
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 4, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', background: s.color, borderRadius: 4, transition: 'width 0.5s' }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 66, textAlign: 'right' }}>{s.groupsWith} grp · {pct}%</span>
      </div>
    </div>
  )
}

function PremiTab({ scope }) {
  const scopeSet = scope ? new Set(scope.map(s => `${s.destination}__${s.shift_num}`)) : null
  const scopeMetas = scope ? [...new Set(scope.map(s => s.destination))] : null
  const [votes, setVotes] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDest, setSelectedDest] = useState(null)
  const [selectedShift, setSelectedShift] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: v }, { data: p }] = await Promise.all([
        supabase.from('votes').select('voted_for_id, type, destination, shift_num'),
        supabase.from('staff_profiles').select('id, nome, cognome, ruolo'),
      ])
      setVotes((v || []).filter(vote => !scopeSet || scopeSet.has(`${vote.destination}__${vote.shift_num}`)))
      setProfiles(p || [])
      setLoading(false)
    }
    load()
  }, [])

  function getProfile(id) { return profiles.find(p => p.id === id) }

  function getRanking(destId, sNum, type) {
    const filtered = votes.filter(v => v.destination === destId && v.shift_num === sNum && v.type === type)
    const counts = {}
    filtered.forEach(v => { counts[v.voted_for_id] = (counts[v.voted_for_id] || 0) + 1 })
    return Object.entries(counts).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, 5)
  }

  const availableShifts = selectedDest
    ? [...new Set(votes.filter(v => v.destination === selectedDest).map(v => v.shift_num))].sort((a, b) => a - b)
    : []

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>Carico...</div>

  return (
    <div style={{ padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Selettore destinazione */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {DESTINATIONS.filter(d => !scopeMetas || scopeMetas.includes(d.id)).map(dest => {
          const hasVotes = votes.some(v => v.destination === dest.id)
          if (!hasVotes) return null
          const col = DEST_COLORS[dest.id]
          const active = selectedDest === dest.id
          return (
            <button key={dest.id} onClick={() => { setSelectedDest(active ? null : dest.id); setSelectedShift(null) }} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: active ? col : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)',
              border: '0.5px solid ' + (active ? col : 'var(--border)'),
            }}>
              {dest.name}
            </button>
          )
        })}
        {!votes.length && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun voto ancora registrato</div>}
      </div>

      {/* Selettore turno */}
      {selectedDest && availableShifts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {availableShifts.map(sNum => {
            const active = selectedShift === sNum
            const col = DEST_COLORS[selectedDest]
            return (
              <button key={sNum} onClick={() => setSelectedShift(active ? null : sNum)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: active ? col : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)',
                border: '0.5px solid ' + (active ? col : 'var(--border)'),
              }}>
                {shiftLabel(selectedDest, sNum)}
              </button>
            )
          })}
        </div>
      )}

      {/* Classifiche */}
      {selectedDest && selectedShift && (() => {
        const dailyRank = getRanking(selectedDest, selectedShift, 'daily')
        const weeklyRank = getRanking(selectedDest, selectedShift, 'weekly')
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Daily */}
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                ⭐ Migliori del giorno — {shiftLabel(selectedDest, selectedShift)}
              </div>
              {dailyRank.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun voto ancora</div>
                : dailyRank.map((v, i) => {
                    const p = getProfile(v.id)
                    if (!p) return null
                    return (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < dailyRank.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                        <div style={{ width: 28, textAlign: 'center', fontSize: 16, flexShrink: 0 }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}°`}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome} {p.cognome}</div>
                          {p.ruolo && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.ruolo}</div>}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' }}>
                          {v.count} ⭐
                        </div>
                      </div>
                    )
                  })
              }
            </div>
            {/* Weekly */}
            <div className="card">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                🏆 Migliore della settimana — {shiftLabel(selectedDest, selectedShift)}
              </div>
              {weeklyRank.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun voto ancora</div>
                : weeklyRank.map((v, i) => {
                    const p = getProfile(v.id)
                    if (!p) return null
                    return (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < weeklyRank.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                        <div style={{ width: 28, textAlign: 'center', fontSize: 16, flexShrink: 0 }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}°`}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome} {p.cognome}</div>
                          {p.ruolo && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.ruolo}</div>}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' }}>
                          {v.count} 🏆
                        </div>
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )
      })()}

      {selectedDest && !selectedShift && (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Seleziona un turno per vedere la classifica
        </div>
      )}
    </div>
  )
}

function VotesSection({ voteData, staffProfiles, loading, filterDest, filterShift }) {
  function getProfile(id) { return staffProfiles.find(p => p.id === id) }

  // Filtra per dest/shift se attivi
  const filtered = voteData.filter(v => {
    if (filterDest && v.destination !== filterDest) return false
    if (filterShift && v.shift_num !== filterShift) return false
    return true
  })

  // Aggrega per staff (somma tutti i turni se no filtro)
  const byStaff = {}
  filtered.forEach(v => {
    if (!byStaff[v.staffId]) byStaff[v.staffId] = { staffId: v.staffId, daily: 0, weekly: 0 }
    byStaff[v.staffId].daily += v.daily
    byStaff[v.staffId].weekly += v.weekly
  })
  const dailyRanking = Object.values(byStaff).filter(v => v.daily > 0).sort((a, b) => b.daily - a.daily).slice(0, 10)
  const weeklyRanking = Object.values(byStaff).filter(v => v.weekly > 0).sort((a, b) => b.weekly - a.weekly).slice(0, 10)

  if (loading) return (
    <div className="card" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: 13 }}>Carico voti...</div>
  )

  if (dailyRanking.length === 0 && weeklyRanking.length === 0) return (
    <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>🏆</div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun voto ancora registrato</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Migliori del giorno */}
      {dailyRanking.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            ⭐ Migliori del giorno — classifica
          </div>
          {dailyRanking.map((v, i) => {
            const p = getProfile(v.staffId)
            if (!p) return null
            return (
              <div key={v.staffId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < dailyRanking.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                <div style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 800, color: i === 0 ? '#D4AC0D' : i === 1 ? '#9CA3AF' : i === 2 ? '#CD7F32' : 'var(--text-tertiary)', flexShrink: 0 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}°`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome} {p.cognome}</div>
                  {p.ruolo && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.ruolo}</div>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' }}>
                  {v.daily} ⭐
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Migliori della settimana */}
      {weeklyRanking.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
            🏆 Migliori della settimana — classifica
          </div>
          {weeklyRanking.map((v, i) => {
            const p = getProfile(v.staffId)
            if (!p) return null
            return (
              <div key={v.staffId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < weeklyRanking.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                <div style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 800, color: i === 0 ? '#D4AC0D' : i === 1 ? '#9CA3AF' : i === 2 ? '#CD7F32' : 'var(--text-tertiary)', flexShrink: 0 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}°`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome} {p.cognome}</div>
                  {p.ruolo && <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{p.ruolo}</div>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' }}>
                  {v.weekly} 🏆
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function IncassiTab({ data, loading, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false)
  async function doRefresh() { setRefreshing(true); await onRefresh(); setRefreshing(false) }
  const [filterDest, setFilterDest] = useState(null)
  const [filterShift, setFilterShift] = useState(null)
  const [viewMode, setViewMode] = useState('euro') // 'euro' | 'quantita' | 'percentuale'

  if (loading || !data) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}><div className="spinner" style={{ margin: '0 auto 12px' }} />Carico incassi...</div>

  // Servizi mostrati come colonne: quelli della meta selezionata. In "Tutte" niente colonne servizio (metas diverse), solo Pax e Totale.
  const SV = filterDest ? getServices(filterDest) : null
  const isQty = viewMode === 'quantita'
  const isPct = viewMode === 'percentuale'

  // Colori soglia penetrazione vendite: verde >=70%, giallo 40-69%, rosso <40%
  function pctStyle(p) {
    if (p == null) return { color: 'var(--text-tertiary)' }
    if (p >= 70) return { color: '#15803D', background: '#F0FDF4', fontWeight: 700 }
    if (p >= 40) return { color: '#A16207', background: '#FEFCE8', fontWeight: 700 }
    return { color: '#B91C1C', background: '#FEF2F2', fontWeight: 700 }
  }
  function fmtPct(p) { return p == null ? '\u2014' : Math.round(p) + '%' }

  // Quantità di un servizio per un gruppo: SEMPRE la colonna a quantità (modello nuovo)
  // true se il servizio, per quel gruppo, è pagato in prebooking (quindi NON è cassa in meta).
  // Le colonne "cash" (es. Pag SSP cash) sono SEMPRE incasso in meta: il conteggio
  // prebooking va solo sulla colonna bonifico (o sull'SSP a colonna unica delle altre mete).
  function isPrebPaid(g, sv) {
    if (sv.id.includes('cash')) return false
    const pk = prebookKeyForService(sv.id)
    return pk != null && isPrebookingPagato(sv.id, g.destination, g.shift_num)
  }
  function svQty(g, sv) {
    if (isPrebPaid(g, sv)) {
      const pk = prebookKeyForService(sv.id)
      return (g.prebook && g.prebook[pk] != null) ? Number(g.prebook[pk]) : 0
    }
    return g[sv.id] || 0
  }
  // Valore in € (quantità × prezzo). I servizi pagati in prebooking valgono 0 €:
  // i soldi sono già incassati fuori dalla meta, non vanno nella cassa.
  function svValue(g, sv) {
    if (isPrebPaid(g, sv)) return 0
    return sv.prezzo * (g[sv.id] || 0)
  }
  // Cella mostrata: € o numero secondo la vista scelta
  function svCell(g, sv) {
    return isQty ? svQty(g, sv) : svValue(g, sv)
  }
  // Percentuale di penetrazione di un servizio per un gruppo: quantita venduta (prebook+meta) / pax
  function svPct(g, sv) {
    const pax = g.num_partecipanti || 0
    if (pax === 0) return null
    return (svQty(g, sv) / pax) * 100
  }
  // Percentuale aggregata su un set di gruppi per un servizio: somma quantita / somma pax
  function colPct(gs, sv) {
    const pax = gs.reduce((t, g) => t + (g.num_partecipanti || 0), 0)
    if (pax === 0) return null
    const qty = gs.reduce((t, g) => t + svQty(g, sv), 0)
    return (qty / pax) * 100
  }
  // Percentuale totale riga: media pesata su tutti i servizi della meta del gruppo
  function rowPct(g) {
    const sv = groupServices(g)
    const pax = g.num_partecipanti || 0
    if (pax === 0 || sv.length === 0) return null
    const qty = sv.reduce((t, s) => t + svQty(g, s), 0)
    return (qty / (pax * sv.length)) * 100
  }
  // Percentuale totale aggregata su un set di gruppi: somma quantita (sui servizi di ciascuna
  // destinazione) / somma (pax * n. servizi). Funziona sia filtrando una meta sia su "Tutte".
  function grandPct(gs) {
    let qty = 0, denom = 0
    gs.forEach(g => {
      const sv = groupServices(g)
      const pax = g.num_partecipanti || 0
      if (pax > 0 && sv.length > 0) {
        qty += sv.reduce((t, s) => t + svQty(g, s), 0)
        denom += pax * sv.length
      }
    })
    return denom > 0 ? (qty / denom) * 100 : null
  }
  // Servizi che concorrono al totale di un gruppo: quelli della SUA meta
  function groupServices(g) {
    return filterDest ? SV : getServices(g.destination)
  }

  // Filtra gruppi
  const groups = data.filter(g => {
    if (filterDest && g.destination !== filterDest) return false
    if (filterShift && g.shift_num !== filterShift) return false
    return true
  })

  // Struttura: per meta → per turno → gruppi
  const dests = [...new Set(groups.map(g => g.destination))]
  const availableShifts = filterDest
    ? [...new Set(data.filter(g => g.destination === filterDest).map(g => g.shift_num))].sort((a, b) => a - b)
    : []

  // Calcola totale riga (sui servizi della meta del gruppo)
  function rowTotal(g) {
    return groupServices(g).reduce((t, sv) => t + svCell(g, sv), 0)
  }

  // Calcola totale colonna per un set di gruppi
  function colTotal(gs, sv) {
    return gs.reduce((t, g) => t + svCell(g, sv), 0)
  }

  function grandTotal(gs) {
    return gs.reduce((t, g) => t + rowTotal(g), 0)
  }

  const thStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1.5px solid var(--border)', background: 'var(--bg-secondary)' }
  const thLeftStyle = { ...thStyle, textAlign: 'left' }
  const tdStyle = { fontSize: 12, padding: '9px 10px', textAlign: 'right', borderBottom: '0.5px solid var(--border)', color: 'var(--text-secondary)' }
  const tdLeftStyle = { ...tdStyle, textAlign: 'left', color: 'var(--text-primary)', fontWeight: 500 }
  const subtotalStyle = { background: 'var(--bg-secondary)', fontWeight: 700, fontSize: 12 }
  const grandStyle = { background: 'var(--iv-blue)', color: '#fff', fontWeight: 800 }

  return (
    <div style={{ padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Vista:</span>
        <button onClick={() => setViewMode('euro')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: viewMode === 'euro' ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: viewMode === 'euro' ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (viewMode === 'euro' ? 'var(--iv-blue)' : 'var(--border)') }}>
          € Importi
        </button>
        <button onClick={() => setViewMode('quantita')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: isQty ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: isQty ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (isQty ? 'var(--iv-blue)' : 'var(--border)') }}>
          # Quantità
        </button>
        <button onClick={() => setViewMode('percentuale')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: isPct ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: isPct ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (isPct ? 'var(--iv-blue)' : 'var(--border)') }}>
          % Vendite
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Meta:</span>
        <button onClick={() => { setFilterDest(null); setFilterShift(null) }} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: !filterDest ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: !filterDest ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (!filterDest ? 'var(--iv-blue)' : 'var(--border)') }}>
          Tutte
        </button>
        {DESTINATIONS.map(d => {
          const hasData = data.some(g => g.destination === d.id)
          if (!hasData) return null
          const col = DEST_COLORS[d.id]
          const active = filterDest === d.id
          return (
            <button key={d.id} onClick={() => { setFilterDest(active ? null : d.id); setFilterShift(null) }} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: active ? col : 'var(--bg-secondary)', color: active ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (active ? col : 'var(--border)') }}>
              {d.name}
            </button>
          )
        })}
      </div>

      {filterDest && availableShifts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Turno:</span>
          <button onClick={() => setFilterShift(null)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: !filterShift ? DEST_COLORS[filterDest] : 'var(--bg-secondary)', color: !filterShift ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (!filterShift ? DEST_COLORS[filterDest] : 'var(--border)') }}>Tutti</button>
          {availableShifts.map(sNum => (
            <button key={sNum} onClick={() => setFilterShift(filterShift === sNum ? null : sNum)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filterShift === sNum ? DEST_COLORS[filterDest] : 'var(--bg-secondary)', color: filterShift === sNum ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (filterShift === sNum ? DEST_COLORS[filterDest] : 'var(--border)') }}>
              {shiftLabel(filterDest, sNum)}
            </button>
          ))}
        </div>
      )}

      {/* Legenda */}
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ color: 'var(--iv-blue)', fontWeight: 700 }}>6</span> = già pagato in prebooking (conteggio, non €)</span>
        <span>€ = incassato in meta (cassa)</span>
        {isPct && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#F0FDF4', border: '1px solid #15803D' }} /> ≥70%</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#FEFCE8', border: '1px solid #A16207' }} /> 40-69%</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#FEF2F2', border: '1px solid #B91C1C' }} /> &lt;40%</span>
        </span>}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ fontSize: 9.5, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', border: '0.5px solid #FCA5A5', padding: '1px 6px', borderRadius: 20 }}>-N</span> = partecipanti rimossi dal gruppo (non vengono più)</span>
        <button onClick={doRefresh} disabled={refreshing} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--iv-blue)', color: '#fff', border: 'none', opacity: refreshing ? 0.6 : 1 }}>{refreshing ? 'Aggiorno…' : '↻ Aggiorna dati'}</button>
      </div>

      {/* Tabella pivot */}
      <div className="incassi-table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ ...thLeftStyle, minWidth: 140 }}>Capogruppo</th>
              <th style={{ ...thStyle, minWidth: 60 }}>Pax</th>
              {SV && SV.map(sv => <th key={sv.id} style={{ ...thStyle, minWidth: 90 }}>{sv.label}</th>)}
              <th style={{ ...thStyle, minWidth: 80, color: 'var(--iv-blue)' }}>{isQty ? 'Tot. servizi' : 'Totale'}</th>
            </tr>
            {groups.length > 0 && (
              <tr>
                <td style={{ ...tdLeftStyle, ...grandStyle, color: '#fff', fontSize: 13 }}>TOTALE GENERALE</td>
                <td style={{ ...tdStyle, ...grandStyle, color: '#fff' }}>{groups.reduce((t, g) => t + (g.num_partecipanti || 0), 0)}</td>
                {SV && SV.map(sv => <td key={sv.id} style={{ ...tdStyle, ...grandStyle, color: '#fff' }}>{isPct ? fmtPct(colPct(groups, sv)) : isQty ? colTotal(groups, sv) : `€${colTotal(groups, sv)}`}</td>)}
                <td style={{ ...tdStyle, ...grandStyle, color: '#fff', fontSize: 15 }}>{isPct ? fmtPct(grandPct(groups)) : isQty ? grandTotal(groups) : `€${grandTotal(groups)}`}</td>
              </tr>
            )}
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr><td colSpan={3 + (SV ? SV.length : 0)} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Nessun dato</td></tr>
            ) : (() => {
              const rows = []
              // Raggruppa per dest → shift
              const byDest = {}
              groups.forEach(g => {
                if (!byDest[g.destination]) byDest[g.destination] = {}
                if (!byDest[g.destination][g.shift_num]) byDest[g.destination][g.shift_num] = []
                byDest[g.destination][g.shift_num].push(g)
              })

              Object.entries(byDest).forEach(([destId, shifts]) => {
                const dest = DESTINATIONS.find(d => d.id === destId)
                const destColor = DEST_COLORS[destId]
                const allDestGroups = Object.values(shifts).flat()

                Object.entries(shifts).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([sNum, sGroups]) => {
                  // Header turno
                  rows.push(
                    <tr key={`h-${destId}-${sNum}`}>
                      <td colSpan={3 + (SV ? SV.length : 0)} style={{ padding: '8px 12px', background: destColor + '15', borderBottom: '0.5px solid var(--border)', borderTop: '1px solid ' + destColor + '33' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: destColor }}>{dest?.name} · {shiftLabel(destId, Number(sNum))}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>{sGroups.length} gruppi</span>
                      </td>
                    </tr>
                  )
                  // Righe gruppo
                  sGroups.forEach(g => {
                    const n = g.num_partecipanti || 0
                    const tot = rowTotal(g)
                    rows.push(
                      <tr key={g.id}>
                        <td style={tdLeftStyle}>
                          {capogruppoCode(g.capogruppo_code) && <span className="code-chip" style={{ marginRight: 6 }}>{capogruppoCode(g.capogruppo_code)}</span>}
                          {g.capogruppo_display}
                          {g.num_rimossi > 0 && <span title={`${g.num_rimossi} partecipante${g.num_rimossi > 1 ? 'i' : ''} rimosso/i dal gruppo`} style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', border: '0.5px solid #FCA5A5', padding: '1px 6px', borderRadius: 20 }}>-{g.num_rimossi}</span>}
                        </td>
                        <td style={tdStyle}>{n}</td>
                        {SV && SV.map(sv => {
                          if (isPct) {
                            const p = svPct(g, sv)
                            return <td key={sv.id} style={{ ...tdStyle, ...pctStyle(p) }}>{fmtPct(p)}</td>
                          }
                          const prebPaid = isPrebPaid(g, sv)
                          const val = svCell(g, sv)
                          if (prebPaid) {
                            // pagato in prebooking: conteggio BLU in vista quantità, 0 in vista euro
                            return <td key={sv.id} style={{ ...tdStyle, color: isQty ? 'var(--iv-blue)' : 'var(--text-tertiary)', fontWeight: isQty && val > 0 ? 700 : 400 }}>{isQty ? (val > 0 ? val : '—') : '€0'}</td>
                          }
                          return <td key={sv.id} style={{ ...tdStyle, color: val > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{val > 0 ? (isQty ? val : `€${val}`) : '—'}</td>
                        })}
                        <td style={{ ...tdStyle, fontWeight: 700, ...(isPct ? pctStyle(rowPct(g)) : { color: tot > 0 ? 'var(--iv-blue)' : 'var(--text-tertiary)' }) }}>{isPct ? fmtPct(rowPct(g)) : (tot > 0 ? (isQty ? tot : `€${tot}`) : '—')}</td>
                      </tr>
                    )
                  })
                  // Subtotale turno
                  rows.push(
                    <tr key={`sub-${destId}-${sNum}`} style={subtotalStyle}>
                      <td style={{ ...tdLeftStyle, ...subtotalStyle }}>Subtotale {shiftLabel(destId, Number(sNum))}</td>
                      <td style={{ ...tdStyle, ...subtotalStyle }}>{sGroups.reduce((t, g) => t + (g.num_partecipanti || 0), 0)}</td>
                      {SV && SV.map(sv => <td key={sv.id} style={{ ...tdStyle, ...subtotalStyle }}>{isPct ? fmtPct(colPct(sGroups, sv)) : isQty ? colTotal(sGroups, sv) : `€${colTotal(sGroups, sv)}`}</td>)}
                      <td style={{ ...tdStyle, ...subtotalStyle, color: 'var(--iv-blue)' }}>{isPct ? fmtPct(grandPct(sGroups)) : isQty ? grandTotal(sGroups) : `€${grandTotal(sGroups)}`}</td>
                    </tr>
                  )
                })

                // Subtotale meta (solo se >1 turno)
                if (Object.keys(shifts).length > 1) {
                  rows.push(
                    <tr key={`dest-${destId}`} style={{ background: destColor + '20' }}>
                      <td style={{ ...tdLeftStyle, background: 'transparent', color: destColor, fontWeight: 800 }}>TOTALE {dest?.name?.toUpperCase()}</td>
                      <td style={{ ...tdStyle, background: 'transparent', fontWeight: 700 }}>{allDestGroups.reduce((t, g) => t + (g.num_partecipanti || 0), 0)}</td>
                      {SV && SV.map(sv => <td key={sv.id} style={{ ...tdStyle, background: 'transparent', fontWeight: 700 }}>{isPct ? fmtPct(colPct(allDestGroups, sv)) : isQty ? colTotal(allDestGroups, sv) : `€${colTotal(allDestGroups, sv)}`}</td>)}
                      <td style={{ ...tdStyle, background: 'transparent', fontWeight: 800, color: destColor }}>{isPct ? fmtPct(grandPct(allDestGroups)) : isQty ? grandTotal(allDestGroups) : `€${grandTotal(allDestGroups)}`}</td>
                    </tr>
                  )
                }
              })

              return rows
            })()}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatsTab({ stats }) {
  const [filterDest, setFilterDest] = useState(null)
  const [filterShift, setFilterShift] = useState(null)

  const groups = stats.groups
  const totalGroups = groups.length
  const totalParts = stats.totalParts
  // Solo le mete che hanno gruppi (scoping CM/ACM: mostra solo le loro).
  const metasPresent = DESTINATIONS.filter(d => groups.some(g => g.destination === d.id))

  // Riepilogo per destinazione (sempre calcolato)
  const destRows = metasPresent.map(dest => {
    const dg = groups.filter(g => g.destination === dest.id)
    if (!dg.length) return null
    const services = computeServices(dg, getServices(dest.id))
    const participants = dg.reduce((a, g) => a + (g.num_partecipanti || 0), 0)
    const revenue = services.reduce((a, s) => a + s.revenue, 0)
    return { dest, groups: dg.length, participants, revenue, services }
  }).filter(Boolean)

  const totalRevenue = destRows.reduce((a, d) => a + d.revenue, 0)
  const totalServizi = destRows.reduce((a, d) => a + d.services.reduce((x, s) => x + s.qty, 0), 0)

  // Turni disponibili per la dest selezionata
  const availableShifts = filterDest
    ? [...new Set(groups.filter(g => g.destination === filterDest).map(g => g.shift_num))].sort((a, b) => a - b)
    : []

  // Vista filtrata (dest [+ shift])
  const filtered = groups.filter(g => {
    if (filterDest && g.destination !== filterDest) return false
    if (filterShift && g.shift_num !== filterShift) return false
    return true
  })
  const filteredServices = filterDest ? computeServices(filtered, getServices(filterDest)) : []
  const filteredParts = filtered.reduce((a, g) => a + (g.num_partecipanti || 0), 0)
  const filteredRevenue = filteredServices.reduce((a, s) => a + s.revenue, 0)

  // Breakdown per turno (dest selezionata, nessun turno)
  const shiftRows = (filterDest && !filterShift)
    ? availableShifts.map(sNum => {
        const sg = groups.filter(g => g.destination === filterDest && g.shift_num === sNum)
        const svc = computeServices(sg, getServices(filterDest))
        return { sNum, groups: sg.length, participants: sg.reduce((a, g) => a + (g.num_partecipanti || 0), 0), revenue: svc.reduce((a, s) => a + s.revenue, 0) }
      })
    : []

  const accent = filterDest ? DEST_COLORS[filterDest] : 'var(--iv-blue)'
  const scopeLabel = filterDest
    ? DESTINATIONS.find(d => d.id === filterDest)?.name + (filterShift ? ' · ' + shiftLabel(filterDest, filterShift) : '')
    : 'Tutte le mete'

  // KPI: globali o filtrati
  const kGroups = filterDest ? filtered.length : totalGroups
  const kParts = filterDest ? filteredParts : totalParts
  const kRevenue = filterDest ? filteredRevenue : totalRevenue
  const kServizi = filterDest ? filteredServices.reduce((a, s) => a + s.qty, 0) : totalServizi

  return (
    <div style={{ padding: '14px 16px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <KpiCard value={fmtNum(kGroups)} label="Gruppi" accent="#1E6BF1" icon="👥" />
        <KpiCard value={fmtNum(kParts)} label="Partecipanti" accent="#059669" icon="🧍" />
        <KpiCard value={fmtEur(kRevenue)} label="Incasso previsto" accent="#D97706" icon="💶" />
        <KpiCard value={fmtNum(kServizi)} label="Servizi venduti" accent="#7C3AED" icon="🎟️" />
      </div>

      {/* Filtri meta */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {metasPresent.map(dest => {
          const active = filterDest === dest.id
          const col = DEST_COLORS[dest.id]
          const exists = destRows.some(r => r.dest.id === dest.id)
          return (
            <button key={dest.id} disabled={!exists}
              onClick={() => { setFilterDest(active ? null : dest.id); setFilterShift(null) }}
              style={{
                padding: '6px 13px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: exists ? 'pointer' : 'not-allowed', opacity: exists ? 1 : 0.4,
                background: active ? col : 'var(--bg-secondary)',
                color: active ? '#fff' : 'var(--text-secondary)',
                border: '0.5px solid ' + (active ? col : 'var(--border)')
              }}>
              {dest.flag} {dest.name}
            </button>
          )
        })}
        {filterDest && (
          <button onClick={() => { setFilterDest(null); setFilterShift(null) }}
            style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--danger-light)', color: 'var(--danger)', border: '0.5px solid #FECACA' }}>
            ✕ Reset
          </button>
        )}
      </div>

      {/* Filtro turni */}
      {filterDest && availableShifts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterShift(null)} style={chipStyle(!filterShift, DEST_COLORS[filterDest])}>Tutti i turni</button>
          {availableShifts.map(sNum => (
            <button key={sNum} onClick={() => setFilterShift(filterShift === sNum ? null : sNum)} style={chipStyle(filterShift === sNum, DEST_COLORS[filterDest])}>
              {shiftLabel(filterDest, sNum)}
            </button>
          ))}
        </div>
      )}

      {/* Servizi (vista filtrata) */}
      {filterDest && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Servizi · <span style={{ color: accent }}>{scopeLabel}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: accent, whiteSpace: 'nowrap' }}>{fmtEur(filteredRevenue)}</div>
          </div>
          {filteredServices.length === 0
            ? <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Nessun servizio venduto.</div>
            : filteredServices.map(s => <ServiceRow key={s.id} s={s} totalGroups={filtered.length} />)}
        </div>
      )}

      {/* Breakdown per turno */}
      {filterDest && !filterShift && shiftRows.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Per turno</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shiftRows.map(r => (
              <button key={r.sNum} onClick={() => setFilterShift(r.sNum)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{shiftLabel(filterDest, r.sNum)}</span>
                <span style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtNum(r.groups)} grp</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtNum(r.participants)} pax</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: accent, minWidth: 70, textAlign: 'right' }}>{fmtEur(r.revenue)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Panoramica per meta (no filtro) */}
      {!filterDest && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          {destRows.map(({ dest, groups: dg, participants, revenue, services }) => (
            <button key={dest.id} className="card" onClick={() => { setFilterDest(dest.id); setFilterShift(null) }}
              style={{ textAlign: 'left', cursor: 'pointer', display: 'block', width: '100%', borderTop: '3px solid ' + DEST_COLORS[dest.id] }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{dest.flag} {dest.name}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: DEST_COLORS[dest.id], whiteSpace: 'nowrap' }}>{fmtEur(revenue)}</div>
              </div>
              <div style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
                <div><div style={{ fontSize: 17, fontWeight: 700 }}>{fmtNum(dg)}</div><div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gruppi</div></div>
                <div><div style={{ fontSize: 17, fontWeight: 700 }}>{fmtNum(participants)}</div><div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pax</div></div>
              </div>
              {services.map(s => <ServiceRow key={s.id} s={s} totalGroups={dg} />)}
              <div style={{ fontSize: 11, color: DEST_COLORS[dest.id], fontWeight: 600, marginTop: 4 }}>Dettaglio per turno →</div>
            </button>
          ))}
        </div>
      )}

    </div>
  )
}

function CassaTab() {
  const { isFullAccess, profile } = useAuth()
  const myShifts = isFullAccess ? null : (profile?.assigned_shifts || [])
  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterDest, setFilterDest] = useState(null)
  const [selectedRow, setSelectedRow] = useState(null) // { destination, shift_num }

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    let all = [], from = 0
    const pageSize = 1000
    while (true) {
      const { data } = await supabase.from('cassa_movimenti').select('*').range(from, from + pageSize - 1)
      if (!data || data.length === 0) break
      all = all.concat(data)
      if (data.length < pageSize) break
      from += pageSize
    }
    setMovimenti(all)
    setLoading(false)
  }

  if (selectedRow) {
    return <CassaTurnoDetail destination={selectedRow.destination} shiftNum={selectedRow.shift_num} onBack={() => { setSelectedRow(null); fetchAll() }} />
  }

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}><div className="spinner" style={{ margin: '0 auto 12px' }} />Carico cassa...</div>

  const groupKey = (dest, shift) => `${dest}__${shift}`
  const allowedKeys = myShifts ? new Set(myShifts.map(s => groupKey(s.destination, s.shift_num))) : null
  const scoped = allowedKeys ? movimenti.filter(m => allowedKeys.has(groupKey(m.destination, m.shift_num))) : movimenti
  const filtered = filterDest ? scoped.filter(m => m.destination === filterDest) : scoped

  // Raggruppa per destinazione + turno
  const byShift = {}
  filtered.forEach(m => {
    const k = groupKey(m.destination, m.shift_num)
    if (!byShift[k]) byShift[k] = { destination: m.destination, shift_num: m.shift_num, entrate: 0, uscite: 0, count: 0 }
    if (m.tipo === 'entrata') byShift[k].entrate += Number(m.importo)
    else byShift[k].uscite += Number(m.importo)
    byShift[k].count++
  })

  // Aggiunge i turni a zero movimenti. Full: tutti i turni delle mete mostrate. CM/ACM: solo i propri.
  if (myShifts) {
    myShifts.filter(s => !filterDest || s.destination === filterDest).forEach(s => {
      const k = groupKey(s.destination, s.shift_num)
      if (!byShift[k]) byShift[k] = { destination: s.destination, shift_num: s.shift_num, entrate: 0, uscite: 0, count: 0 }
    })
  } else {
    const destsToShow = filterDest ? [filterDest] : DESTINATIONS.map(d => d.id)
    destsToShow.forEach(destId => {
      (SHIFTS[destId] || []).forEach(s => {
        const k = groupKey(destId, s.num)
        if (!byShift[k]) byShift[k] = { destination: destId, shift_num: s.num, entrate: 0, uscite: 0, count: 0 }
      })
    })
  }

  const shiftRows = Object.values(byShift).sort((a, b) => a.destination.localeCompare(b.destination) || a.shift_num - b.shift_num)

  const totEntrate = filtered.filter(m => m.tipo === 'entrata').reduce((t, m) => t + Number(m.importo), 0)
  const totUscite = filtered.filter(m => m.tipo === 'uscita').reduce((t, m) => t + Number(m.importo), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Meta:</span>
        <button onClick={() => setFilterDest(null)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: !filterDest ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: !filterDest ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (!filterDest ? 'var(--iv-blue)' : 'var(--border)') }}>Tutte</button>
        {DESTINATIONS.filter(d => !myShifts || myShifts.some(s => s.destination === d.id)).map(d => (
          <button key={d.id} onClick={() => setFilterDest(d.id)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filterDest === d.id ? 'var(--iv-blue)' : 'var(--bg-secondary)', color: filterDest === d.id ? '#fff' : 'var(--text-secondary)', border: '0.5px solid ' + (filterDest === d.id ? 'var(--iv-blue)' : 'var(--border)') }}>{d.name}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, background: '#ECFDF5', border: '1px solid #16A34A33', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>Entrate totali</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A', marginTop: 4 }}>€{totEntrate.toFixed(2)}</div>
        </div>
        <div style={{ flex: 1, background: '#FEF2F2', border: '1px solid #DC262633', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Uscite totali</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#DC2626', marginTop: 4 }}>€{totUscite.toFixed(2)}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--iv-blue-light)', border: '1px solid var(--iv-blue)33', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--iv-blue)', textTransform: 'uppercase' }}>Saldo</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--iv-blue)', marginTop: 4 }}>€{(totEntrate - totUscite).toFixed(2)}</div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 100px', padding: '10px 16px', background: 'var(--bg-secondary)', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          <div>Turno</div><div>Movimenti</div><div>Entrate</div><div>Uscite</div><div>Saldo</div>
        </div>
        {shiftRows.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Nessun movimento registrato</div>
        ) : shiftRows.map((r, i) => {
          const dest = DESTINATIONS.find(d => d.id === r.destination)
          const saldoTurno = r.entrate - r.uscite
          return (
            <div key={i} onClick={() => setSelectedRow({ destination: r.destination, shift_num: r.shift_num })}
              style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 100px', padding: '11px 16px', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none', fontSize: 13, alignItems: 'center', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontWeight: 600, color: 'var(--iv-blue)' }}>{dest?.name || r.destination} · {shiftLabel(r.destination, r.shift_num)}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{r.count}</div>
              <div style={{ color: '#16A34A' }}>€{r.entrate.toFixed(2)}</div>
              <div style={{ color: '#DC2626' }}>€{r.uscite.toFixed(2)}</div>
              <div style={{ fontWeight: 700 }}>€{saldoTurno.toFixed(2)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const METODI = ['Cash', 'Bonifico', 'Scalapay', 'Wivawallet']
const METODO_COLORS = { Cash: '#16A34A', Bonifico: '#1E6BF1', Scalapay: '#7C3AED', Wivawallet: '#D97706' }

function CassaTurnoDetail({ destination, shiftNum, onBack }) {
  const { canEditCassa } = useAuth()
  const categorie = getCategorie(destination)   // categorie in base alla meta del turno
  const [movimenti, setMovimenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filtroMetodo, setFiltroMetodo] = useState('Tutti')
  const [form, setForm] = useState({ tipo: 'entrata', categoria: categorie[0], importo: '', descrizione: '', data: new Date().toISOString().slice(0, 10), metodo: 'Cash' })
  const [saveError, setSaveError] = useState(null)
  const [triedSave, setTriedSave] = useState(false)

  const dest = DESTINATIONS.find(d => d.id === destination)

  useEffect(() => { load() }, [destination, shiftNum])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('cassa_movimenti')
      .select('*').eq('destination', destination).eq('shift_num', shiftNum)
      .order('data', { ascending: false }).order('created_at', { ascending: false })
    setMovimenti(data || [])
    setLoading(false)
  }

  function openForm() {
    setForm({ tipo: 'entrata', categoria: categorie[0], importo: '', descrizione: '', data: new Date().toISOString().slice(0, 10), metodo: 'Cash' })
    setSaveError(null)
    setTriedSave(false)
    setShowForm(true)
  }

  async function handleSave() {
    setTriedSave(true)
    const amount = parseFloat(form.importo)
    // Obbligatori: importo (>0), categoria, metodo, data. Descrizione facoltativa.
    if (!amount || amount <= 0 || !form.categoria || !form.metodo || !form.data) return
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase.from('cassa_movimenti').insert({
      destination, shift_num: shiftNum, data: form.data,
      tipo: form.tipo,
      categoria: form.categoria, importo: amount,
      descrizione: form.descrizione || null, inserito_da: 'Ufficio', metodo: form.metodo || 'Cash',
    })
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    // invia il movimento al foglio di rendicontazione (fire-and-forget)
    sendCassaToSheet({
      destination, shift_num: shiftNum, azione: 'add',
      tipoMov: form.tipo, importo: amount, descrizione: form.descrizione || '',
      categoria: form.categoria || '', metodo: form.metodo || 'Cash', data: form.data,
    })
    setShowForm(false); load()
  }

  async function handleDelete(id) {
    const m = movimenti.find(x => x.id === id)
    await supabase.from('cassa_movimenti').delete().eq('id', id)
    if (m) {
      sendCassaToSheet({
        destination, shift_num: shiftNum, azione: 'elimina',
        tipoMov: m.tipo, importo: m.importo, descrizione: m.descrizione || '',
        categoria: m.categoria || '', metodo: m.metodo || 'Cash', data: m.data,
      })
      // Se il movimento era AUTOMATICO (nato dal toggle di un servizio del gruppo),
      // spengo quel servizio nella scheda del capogruppo: quantità a 0 + rimuovo il metodo.
      if (m.auto && m.group_id && m.servizio_id) {
        try {
          const { data: g } = await supabase.from('groups').select('servizi_metodo').eq('id', m.group_id).maybeSingle()
          const nextMetodo = { ...((g && g.servizi_metodo) || {}) }
          delete nextMetodo[m.servizio_id]
          await supabase.from('groups').update({ [m.servizio_id]: 0, servizi_metodo: nextMetodo }).eq('id', m.group_id)
        } catch (e) {
          console.error('Spegnimento toggle servizio fallito:', e)
        }
      }
    }
    load()
  }

  const movVisibili = movimenti.filter(m => filtroMetodo === 'Tutti' || (m.metodo || 'Cash') === filtroMetodo)
  const totEntrate = movVisibili.filter(m => m.tipo === 'entrata').reduce((t, m) => t + Number(m.importo), 0)
  const totUscite = movVisibili.filter(m => m.tipo === 'uscita').reduce((t, m) => t + Number(m.importo), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--iv-blue)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0, width: 'fit-content' }}>
        <ChevronLeft size={16} /> Tutti i turni
      </button>

      <div style={{ fontSize: 20, fontWeight: 800 }}>{dest?.name || destination} · {shiftLabel(destination, shiftNum)}</div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, background: '#ECFDF5', border: '1px solid #16A34A33', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase' }}>Entrate</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#16A34A', marginTop: 4 }}>€{totEntrate.toFixed(2)}</div>
        </div>
        <div style={{ flex: 1, background: '#FEF2F2', border: '1px solid #DC262633', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Uscite</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626', marginTop: 4 }}>€{totUscite.toFixed(2)}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--iv-blue-light)', border: '1px solid var(--iv-blue)33', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--iv-blue)', textTransform: 'uppercase' }}>Saldo</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--iv-blue)', marginTop: 4 }}>€{(totEntrate - totUscite).toFixed(2)}</div>
        </div>
      </div>

      {canEditCassa && (
        <button onClick={openForm} style={{ padding: '12px', borderRadius: 12, background: 'var(--iv-blue)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', width: 'fit-content', paddingLeft: 20, paddingRight: 20 }}>
          <Plus size={16} /> Nuovo movimento
        </button>
      )}

      {/* Filtro metodo di pagamento */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {['Tutti', ...METODI].map(mt => {
          const on = filtroMetodo === mt
          const c = mt === 'Tutti' ? 'var(--iv-blue)' : METODO_COLORS[mt]
          return (
            <button key={mt} onClick={() => setFiltroMetodo(mt)} style={{
              padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: on ? c : 'var(--bg-secondary)', color: on ? '#fff' : 'var(--text-secondary)',
              border: '0.5px solid ' + (on ? c : 'var(--border)'),
            }}>{mt}</button>
          )
        })}
      </div>

      <div style={{ background: 'var(--bg-primary)', borderRadius: 14, border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : movVisibili.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Nessun movimento{filtroMetodo !== 'Tutti' ? ' con ' + filtroMetodo : ' per questo turno'}</div>
        ) : movVisibili.map((m, i) => {
          const isEntrata = m.tipo === 'entrata'
          const dataFmt = new Date(m.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
          const oraFmt = m.created_at ? new Date(m.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : null
          const mMet = m.metodo || 'Cash'
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>
              {isEntrata ? <ArrowDownCircle size={18} color="#16A34A" style={{ flexShrink: 0 }} /> : <ArrowUpCircle size={18} color="#DC2626" style={{ flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  {m.categoria}
                  <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', padding: '1px 7px', borderRadius: 20, background: (METODO_COLORS[mMet] || '#64748B') + '18', color: METODO_COLORS[mMet] || '#64748B' }}>{mMet}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {dataFmt}{oraFmt ? ` · ${oraFmt}` : ''}{m.descrizione ? ` · ${m.descrizione}` : ''}{m.inserito_da ? ` · ${m.inserito_da}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isEntrata ? '#16A34A' : '#DC2626', flexShrink: 0 }}>
                {isEntrata ? '+' : '-'}€{Number(m.importo).toFixed(2)}
              </div>
              {canEditCassa && (
                <button onClick={() => handleDelete(m.id)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                  <X size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowForm(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-primary)', borderRadius: 16, padding: 22, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Nuovo movimento</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setForm(f => ({ ...f, tipo: 'entrata' }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid ' + (form.tipo === 'entrata' ? '#16A34A' : 'var(--border)'), background: form.tipo === 'entrata' ? '#ECFDF5' : 'transparent', color: form.tipo === 'entrata' ? '#16A34A' : 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <ArrowDownCircle size={15} /> Entrata
                </button>
                <button onClick={() => setForm(f => ({ ...f, tipo: 'uscita' }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid ' + (form.tipo === 'uscita' ? '#DC2626' : 'var(--border)'), background: form.tipo === 'uscita' ? '#FEF2F2' : 'transparent', color: form.tipo === 'uscita' ? '#DC2626' : 'var(--text-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <ArrowUpCircle size={15} /> Uscita
                </button>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Importo (€) <span style={{ color: '#DC2626' }}>*</span></label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={form.importo} onChange={e => setForm(f => ({ ...f, importo: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + (!form.importo ? '#DC2626' : 'var(--border)'), fontSize: 18, fontWeight: 700, marginTop: 4, color: form.tipo === 'entrata' ? '#16A34A' : '#DC2626' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Categoria <span style={{ color: '#DC2626' }}>*</span></label>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + (!form.categoria ? '#DC2626' : 'var(--border)'), fontSize: 14, marginTop: 4 }}>
                  {categorie.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Metodo di pagamento <span style={{ color: '#DC2626' }}>*</span></label>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 6, ...(!form.metodo ? { padding: 6, border: '1px solid #DC2626', borderRadius: 12 } : {}) }}>
                  {METODI.map(mt => {
                    const on = form.metodo === mt
                    const c = METODO_COLORS[mt]
                    return (
                      <button key={mt} type="button" onClick={() => setForm(f => ({ ...f, metodo: mt }))} style={{
                        flex: '1 1 auto', padding: '9px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                        background: on ? c : 'transparent', color: on ? '#fff' : 'var(--text-secondary)',
                        border: '1.5px solid ' + (on ? c : 'var(--border)'),
                      }}>{mt}</button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Descrizione (opzionale)</label>
                <input type="text" placeholder="es. tax Lavrion c2-c3-c4" value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 13, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Data <span style={{ color: '#DC2626' }}>*</span></label>
                <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + (!form.data ? '#DC2626' : 'var(--border)'), fontSize: 13, marginTop: 4 }} />
              </div>
              {triedSave && (!form.importo || parseFloat(form.importo) <= 0 || !form.categoria || !form.metodo || !form.data) && (
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #DC262633', color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
                  Compila tutti i campi obbligatori (contrassegnati con *).
                </div>
              )}
              {saveError && (
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #DC262633', color: '#DC2626', fontSize: 12 }}>
                  Errore nel salvataggio: {saveError}
                </div>
              )}
              <button onClick={handleSave} disabled={saving || !form.importo || parseFloat(form.importo) <= 0 || !form.categoria || !form.metodo || !form.data}
                style={{ marginTop: 6, padding: '13px', borderRadius: 12, border: 'none', background: form.tipo === 'entrata' ? '#16A34A' : '#DC2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.importo || parseFloat(form.importo) <= 0 || !form.categoria || !form.metodo || !form.data ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Plus size={16} /> {saving ? 'Salvo...' : 'Aggiungi movimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
