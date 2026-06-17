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

// Servizi extra specifici di Corfù — quantità libera inserita dall'admin (non legata ai pax)
// NB: prezzo Motorino da confermare (mancante nel foglio rendicontazione)
export const EXTRA_SERVICES_CORFU = [
  { id: 'qta_pazuzu', label: 'Solo Pazuzu', prezzo: 40 },
  { id: 'qta_barche_paleo', label: 'Barche Paleo', prezzo: 20 },
  { id: 'qta_montecristo', label: 'Montecristo', prezzo: 20 },
  { id: 'qta_mojito2', label: 'Mojito 2', prezzo: 10 },
  { id: 'qta_pranzo_laviron', label: 'Pranzo Laviron', prezzo: 10 },
  { id: 'qta_motorino', label: 'Motorino', prezzo: 0 },
]

// Nome esatto della colonna nel foglio Google Sheets di rendicontazione, per ogni servizio
// (deve combaciare carattere per carattere con l'header del foglio)
export const SHEET_SERVIZIO_MAP = {
  pkg_escursioni: 'Escursioni in meta',
  tassa_soggiorno: 'Tassa di Soggiorno',
  pkg_ssp: 'SSP',
  qta_pazuzu: 'Solo Pazuzu',
  qta_barche_paleo: 'Barche Paleo',
  qta_montecristo: 'Montecristo',
  qta_mojito2: 'Mojito 2',
  qta_pranzo_laviron: 'Pranzo Laviron',
  qta_motorino: 'Motorino',
  // cauzione: non presente nel foglio Corfù, non viene sincronizzata
}

// Nome del tab del foglio Google Sheets corrispondente a destinazione + turno
// Per ora collegato solo Corfù — le altre mete tornano null (nessuna sync)
export function getTurnoSheetName(destination, shiftNum) {
  if (destination === 'corfu') return `CORFU' TURNO ${shiftNum}`
  return null
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
