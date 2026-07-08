export const DESTINATIONS = [
  { id: 'pag', name: 'Pag', flag: '🇭🇷', turni: 6 },
  { id: 'corfu', name: 'Corfù', flag: '🇬🇷', turni: 6 },
  { id: 'zante', name: 'Zante', flag: '🇬🇷', turni: 5 },
  { id: 'gallipoli', name: 'Gallipoli', flag: '🇮🇹', turni: 5 },
  { id: 'sardegna', name: 'Sardegna', flag: '🇮🇹', turni: 3 },
]

export const SHIFTS = {
  pag: [
    { num: 1, label: '11 lug – 18 lug', start: '2026-07-11', end: '2026-07-18' },
    { num: 2, label: '18 lug – 25 lug', start: '2026-07-18', end: '2026-07-25' },
    { num: 3, label: '25 lug – 01 ago', start: '2026-07-25', end: '2026-08-01' },
    { num: 4, label: '01 ago – 08 ago', start: '2026-08-01', end: '2026-08-08' },
    { num: 5, label: '08 ago – 15 ago', start: '2026-08-08', end: '2026-08-15' },
    { num: 6, label: '15 ago – 22 ago', start: '2026-08-15', end: '2026-08-22' },
  ],
  corfu: [
    { num: 1, label: '10 lug – 17 lug', start: '2026-07-10', end: '2026-07-17' },
    { num: 2, label: '17 lug – 24 lug', start: '2026-07-17', end: '2026-07-24' },
    { num: 3, label: '24 lug – 31 lug', start: '2026-07-24', end: '2026-07-31' },
    { num: 4, label: '31 lug – 07 ago', start: '2026-07-31', end: '2026-08-07' },
    { num: 5, label: '07 ago – 14 ago', start: '2026-08-07', end: '2026-08-14' },
    { num: 6, label: '14 ago – 21 ago', start: '2026-08-14', end: '2026-08-21' },
  ],
  zante: [
    { num: 1, label: '17 lug – 24 lug', start: '2026-07-17', end: '2026-07-24' },
    { num: 2, label: '24 lug – 31 lug', start: '2026-07-24', end: '2026-07-31' },
    { num: 3, label: '31 lug – 07 ago', start: '2026-07-31', end: '2026-08-07' },
    { num: 4, label: '07 ago – 14 ago', start: '2026-08-07', end: '2026-08-14' },
    { num: 5, label: '14 ago – 21 ago', start: '2026-08-14', end: '2026-08-21' },
  ],
  gallipoli: [
    { num: 1, label: '11 lug – 18 lug', start: '2026-07-11', end: '2026-07-18' },
    { num: 2, label: '18 lug – 25 lug', start: '2026-07-18', end: '2026-07-25' },
    { num: 3, label: '25 lug – 01 ago', start: '2026-07-25', end: '2026-08-01' },
    { num: 4, label: '01 ago – 08 ago', start: '2026-08-01', end: '2026-08-08' },
    { num: 5, label: '08 ago – 15 ago', start: '2026-08-08', end: '2026-08-15' },
  ],
  sardegna: [
    { num: 1, label: '25 lug – 01 ago', start: '2026-07-25', end: '2026-08-01' },
    { num: 2, label: '01 ago – 08 ago', start: '2026-08-01', end: '2026-08-08' },
    { num: 3, label: '08 ago – 15 ago', start: '2026-08-08', end: '2026-08-15' },
  ],
}

export const SERVICES = [
  { id: 'pkg_escursioni', label: 'Escursioni', prezzo: 45 },
  { id: 'tassa_soggiorno', label: 'Tassa di soggiorno', prezzo: 10 },
  { id: 'pkg_ssp', label: 'SSP', prezzo: 45 },
  { id: 'cauzione', label: 'Cauzione', prezzo: 50 },
]

// Tutti i servizi di Corfù, stessa modalità: toggle (tutto il gruppo) + numero modificabile (quantità libera)
export const SERVICES_CORFU = [
  { id: 'qta_escursioni', label: 'Escursioni', prezzo: 45 },
  { id: 'qta_ssp', label: 'SSP', prezzo: 40 },
  { id: 'qta_pazuzu', label: 'Solo Pazuzu', prezzo: 30 },
  { id: 'qta_tassa_soggiorno', label: 'Tassa di soggiorno', prezzo: 15 },
  { id: 'qta_barche_paleo', label: 'Barche Paleo', prezzo: 20 },
  { id: 'qta_montecristo', label: 'Montecristo', prezzo: 20 },
  { id: 'qta_mojito2', label: 'Mojito 2', prezzo: 10 },
  { id: 'qta_pool_sunrise', label: 'Solo Pool Sunrise', prezzo: 10 },
  { id: 'qta_pranzo_laviron', label: 'Pranzo Lavrion', prezzo: 10 },
]

// Servizi "in meta" per Zante / Gallipoli / Sardegna (a quantità, come Corfù).
// Allineati 1:1 agli header dei fogli rendicontazione.
export const SERVICES_ZANTE = [
  { id: 'zan_escursioni', label: 'Escursioni', prezzo: 45 },
  { id: 'zan_boat', label: 'SSP', prezzo: 45 },   // id interno invariato (era Boat), ora è SSP
  { id: 'zan_tassa_soggiorno', label: 'Tassa di soggiorno', prezzo: 15 },
  { id: 'zan_cebu', label: 'Cebu', prezzo: 15 },
  { id: 'zan_bbq', label: 'BBQ', prezzo: 15 },
]

export const SERVICES_GALLIPOLI = [
  { id: 'gal_escursioni', label: 'Escursioni', prezzo: 50 },
  { id: 'gal_boat_party', label: 'SSP', prezzo: 35 },   // id interno invariato (era Boat Party), ora è SSP
  { id: 'gal_tassa_soggiorno', label: 'Tassa di soggiorno', prezzo: 10 },
  { id: 'gal_vega', label: 'Vega', prezzo: 20 },        // G4/G5 = 25 (override per turno)
  { id: 'gal_dinner_elegant', label: 'Dinner Elegant', prezzo: 30 },
  { id: 'gal_praja', label: 'Praja', prezzo: 25 },
]

export const SERVICES_SARDEGNA = [
  { id: 'sar_escursioni', label: 'Escursioni', prezzo: 50 },
  { id: 'sar_ssp', label: 'SSP', prezzo: 30 },
  { id: 'sar_tassa_soggiorno', label: 'Tassa di soggiorno', prezzo: 12 },
  { id: 'sar_pacchetto_serate', label: 'Pacchetto Serate', prezzo: 50 },
  { id: 'sar_pacchetto_saltafila', label: 'Pacchetto Saltafila', prezzo: 20 },
]

// Pag: SSP / Boat / Vida sono sdoppiati cash/bonifico (campi separati)
export const SERVICES_PAG = [
  { id: 'pag_navetta', label: 'Navetta', prezzo: 50 },
  { id: 'pag_tassa_soggiorno', label: 'Tassa di soggiorno', prezzo: 15 },
  { id: 'pag_ssp_cash', label: 'SSP (cash)', prezzo: 55 },
  { id: 'pag_ssp_bonifico', label: 'SSP (bonifico)', prezzo: 55 },
  { id: 'pag_boat_cash', label: 'Boat (cash)', prezzo: 40 },
  { id: 'pag_boat_bonifico', label: 'Boat (bonifico)', prezzo: 40 },
  { id: 'pag_vida_cash', label: 'Vida (cash)', prezzo: 15 },
  { id: 'pag_vida_bonifico', label: 'Vida (bonifico)', prezzo: 15 },
  { id: 'pag_vida_sun', label: 'Vida Sun', prezzo: 11 },
  { id: 'pag_cantante_extra', label: 'Cantante extra', prezzo: 10 },
  { id: 'pag_pizza', label: 'Pizza', prezzo: 20 },     // P1 = 25 (override per turno)
]

// Override prezzo per SINGOLO turno (quando un turno ha un prezzo diverso dalla meta).
// Chiave = codice turno (C1, G4, P1...). Valore = { idServizio: nuovoPrezzo }.
export const PRICE_OVERRIDES = {
  G4: { gal_vega: 25 },
  G5: { gal_vega: 25 },
  P1: { pag_pizza: 25 },
}

// Lista servizi attiva per destinazione, con prezzi eventualmente sovrascritti per il turno.
export function getServices(destination, shiftNum) {
  const base = (destination === 'corfu') ? SERVICES_CORFU
    : (destination === 'zante') ? SERVICES_ZANTE
    : (destination === 'gallipoli') ? SERVICES_GALLIPOLI
    : (destination === 'sardegna') ? SERVICES_SARDEGNA
    : (destination === 'pag') ? SERVICES_PAG
    : SERVICES
  if (!shiftNum) return base
  const code = (DEST_PREFIX[destination] || '') + shiftNum
  const ov = PRICE_OVERRIDES[code]
  if (!ov) return base
  return base.map(s => (ov[s.id] != null ? { ...s, prezzo: ov[s.id] } : s))
}

// ============================================================
// CATEGORIE CASSA — liste DEFINITIVE per meta.
// I doppioni entrata/uscita sono uniti in un'unica voce: la direzione
// (Entrata/Uscita) si sceglie col selettore in cima al form movimento.
// ============================================================
export const CATEGORIE_META = {
  corfu: [
    'Tassa di soggiorno', 'Cauzione', 'SSP', 'Paleo', 'Montecristo', 'Pazuzu',
    'Sunrise pool party', 'Mojito extra', 'Pranzo delicious', 'Cena delicious',
    'Transfer aeroporto', 'Parcheggio', 'Benzina', 'Rimborso spesa', 'Rimborsi',
    'Cassa (week precedente)', 'Cassa (week successiva)', 'Altro',
  ],
  gallipoli: [
    'Tassa di soggiorno', 'Cauzione', 'Praja', 'Vega', 'Rupe delle stelle', 'Boat Party',
    'Spesa', 'Benzina', 'Rimborsi', 'Guardia di sicurezza',
    'Cassa (week precedente)', 'Cassa (week successiva)', 'Altro',
  ],
  zante: [
    'Tassa di soggiorno', 'Cauzione', 'BBQ', 'Prepay LIT', 'Boat Party', 'CEBU',
    'Tavoli/bottiglie', 'Bodyguard Boat', 'Rimborso wifi', 'Rimborso spesa',
    'Benzina', 'Rimborsi', 'Cassa (week precedente)', 'Cassa (week successiva)', 'Altro',
  ],
  sardegna: [
    'Tassa di soggiorno', 'Cauzione', 'Escursioni in meta', 'SSP',
    'Pacchetto serate', 'Pacchetto saltafila', 'Transfer aeroporto',
    'Spesa', 'Benzina', 'Rimborsi', 'Cassa (week precedente)', 'Cassa (week successiva)', 'Altro',
  ],
  pag: [
    'Tassa di soggiorno', 'Cauzione', 'SSP', 'SSP EXTRA', 'Boat', 'Boat EXTRA',
    'Vida', 'Vida EXTRA', 'Pizza', 'Pizza + Papaya', 'Mamacita',
    'Benzina', 'Bolt', 'Rimborso spesa', 'Rimborsi',
    'Cassa (week precedente)', 'Cassa (week successiva)', 'Altro',
  ],
}

// Categorie della cassa in base alla meta del turno.
export function getCategorie(destination) {
  return CATEGORIE_META[destination] || CATEGORIE_META.corfu
}

// Nome esatto della colonna nel foglio Google Sheets di rendicontazione, per ogni servizio
// (il confronto nel foglio ignora maiuscole/spazi, ma le PAROLE devono combaciare)
export const SHEET_SERVIZIO_MAP = {
  pkg_escursioni: 'Escursioni in meta',
  tassa_soggiorno: 'Tassa di Soggiorno',
  pkg_ssp: 'SSP',
  cauzione: 'Cauzione',
  qta_escursioni: 'Escursioni in meta',
  qta_tassa_soggiorno: 'Tassa di Soggiorno',
  qta_ssp: 'SSP in meta',
  qta_pazuzu: 'Solo Pazuzu',
  qta_barche_paleo: 'Barche Paleo',
  qta_montecristo: 'Montecristo',
  qta_mojito2: 'Mojito 2',
  qta_pool_sunrise: 'Solo Pool Sunrise',
  qta_pranzo_laviron: 'Pranzo Lavrion',
  // Zante
  zan_escursioni: 'Escursioni in meta',
  zan_boat: 'SSP',
  zan_tassa_soggiorno: 'Tassa di Soggiorno',
  zan_cebu: 'Cebu',
  zan_bbq: 'BBQ',
  // Gallipoli
  gal_escursioni: 'Escursioni in meta',
  gal_boat_party: 'SSP in meta',
  gal_tassa_soggiorno: 'Tassa di Soggiorno',
  gal_vega: 'Vega',
  gal_dinner_elegant: 'Dinner Elegant',
  gal_praja: 'Praja extra',
  // Sardegna
  sar_escursioni: 'Escursioni in meta',
  sar_ssp: 'SSP',
  sar_tassa_soggiorno: 'Tassa di Soggiorno',
  sar_pacchetto_serate: 'Pacchetto Serate',
  sar_pacchetto_saltafila: 'Pacchetto Saltafila',
  // Pag (cash/bonifico separati)
  pag_navetta: 'Navetta in meta',
  pag_tassa_soggiorno: 'Tassa di Soggiorno',
  pag_ssp_cash: 'SSP CASH in meta',
  pag_ssp_bonifico: 'SSP BONIFICO in meta',
  pag_boat_cash: 'BOAT CASH in meta',
  pag_boat_bonifico: 'BOAT BONIFICO in meta',
  pag_vida_cash: 'VIDA CASH in meta',
  pag_vida_bonifico: 'VIDA BONIFICO in meta',
  pag_vida_sun: 'VIDA SUN',
  pag_cantante_extra: 'Cantante extra',
  pag_pizza: 'Pizza',
}

// Codice turno mandato al webhook (C1, Z3, G2, S2, P1...). L'Apps Script apre il file "{codice} 2026".
// Mete senza servizi mappati (Pag) non sincronizzano comunque, perché SHEET_SERVIZIO_MAP non li copre.
export function getTurnoSheetName(destination, shiftNum) {
  const prefix = DEST_PREFIX[destination]
  if (!prefix || !shiftNum) return null
  return `${prefix}${shiftNum}`
}

// Maps turno column from Excel to destination + shift number
export function parseTurnoExcel(turnoStr) {
  if (!turnoStr) return null
  const s = turnoStr.toUpperCase()
  let dest = null
  if (s.includes('PAG')) dest = 'pag'
  else if (s.includes('CORFU') || s.includes('CORFÙ')) dest = 'corfu'
  else if (s.includes('ZANTE')) dest = 'zante'
  else if (s.includes('GALLIPOLI')) dest = 'gallipoli'
  else if (s.includes('SARDEGNA')) dest = 'sardegna'
  else return null
  const match = s.match(/TURNO\s*(\d+)/)
  if (!match) return null
  return { destination: dest, shift_num: parseInt(match[1]) }
}

export function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function capogruppoCode(code) {
  if (!code) return ''
  const m = String(code).match(/^\s*(\d+)/)
  return m ? m[1] : String(code).trim()
}

// Mappa un id servizio -> chiave "prenotato" (prebook). null se non tracciato.
export function prebookKeyForService(id) {
  if (!id) return null
  if (id.includes('ssp')) return 'ssp'
  if (id.includes('escursioni')) return 'escursioni'
  return null
}

// Categoria Cassa per l'entrata automatica generata dal servizio.
// Allinea i casi comuni alle categorie già esistenti; per gli altri usa la label del servizio.
const SERVICE_CASSA_CATEGORIA = {
  pkg_escursioni: 'Escursioni', qta_escursioni: 'Escursioni', zan_escursioni: 'Escursioni', gal_escursioni: 'Escursioni', sar_escursioni: 'Escursioni',
  pkg_ssp: 'SSP', qta_ssp: 'SSP', sar_ssp: 'SSP', pag_ssp_cash: 'SSP', pag_ssp_bonifico: 'SSP',
  tassa_soggiorno: 'Tassa di soggiorno', qta_tassa_soggiorno: 'Tassa di soggiorno', zan_tassa_soggiorno: 'Tassa di soggiorno', gal_tassa_soggiorno: 'Tassa di soggiorno', sar_tassa_soggiorno: 'Tassa di soggiorno', pag_tassa_soggiorno: 'Tassa di soggiorno',
  cauzione: 'Cauzione',
  qta_pazuzu: 'Pazuzu', qta_barche_paleo: 'Paleo', qta_montecristo: 'Montecristo', qta_mojito2: 'Mojito', qta_pranzo_laviron: 'Pranzo Laviron',
}
export function cassaCategoriaForService(id, label) {
  return SERVICE_CASSA_CATEGORIA[id] || label || 'Altro'
}

export function calcAge(birthDate) {
  if (!birthDate) return null
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}


// Prefissi per i turni per destinazione
const DEST_PREFIX = {
  pag: 'P', corfu: 'C', zante: 'Z', gallipoli: 'G', sardegna: 'S'
}

export function shiftLabel(destination, num) {
  if (!destination || !num) return `T${num}`
  const prefix = DEST_PREFIX[destination] || 'T'
  return `${prefix}${num}`
}
