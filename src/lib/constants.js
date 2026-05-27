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
  { id: 'escursioni', label: 'Escursioni' },
  { id: 'navetta', label: 'Navetta / Serate' },
  { id: 'assicurazione', label: 'Assicurazione' },
  { id: 'iscrizione', label: 'Iscrizione' },
]

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
