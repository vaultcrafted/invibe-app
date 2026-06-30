import { supabase } from './supabase'
import { syncToSheet } from './sheetsSync'

// Coda di scritture offline.
// - Le scritture vengono accodate e applicate subito se c'è rete (comportamento identico a prima).
// - Offline restano in coda (persistite su localStorage, sopravvivono a chiusura app).
// - Al ritorno della connessione la coda viene svuotata: prima Supabase, poi il foglio Google.
// - Gli UPDATE collassano per dedupKey: di uno stesso campo (gruppo+servizio, nota, ecc.) tiene l'ultimo valore.

const KEY = 'invibe_sync_queue_v1'
const listeners = new Set()
let flushing = false

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function persist(q) {
  try { localStorage.setItem(KEY, JSON.stringify(q)) } catch (e) { /* quota */ }
  notify()
}
function notify() {
  const st = getState()
  listeners.forEach(cb => { try { cb(st) } catch (e) {} })
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }

export function getState() {
  return { pending: load().length, online: typeof navigator !== 'undefined' ? navigator.onLine : true, syncing: flushing }
}
export function subscribe(cb) {
  listeners.add(cb)
  cb(getState())
  return () => listeners.delete(cb)
}

// UPDATE con collasso per dedupKey (l'ultimo valore vince). sheet = array di payload per syncToSheet (opzionale).
export function enqueueUpdate(table, match, payload, opts = {}) {
  const op = { id: uid(), type: 'update', table, match, payload, dedupKey: opts.dedupKey || null, sheet: opts.sheet || null, ts: Date.now() }
  const q = load()
  const next = op.dedupKey ? q.filter(o => o.dedupKey !== op.dedupKey) : q.slice()
  next.push(op)
  persist(next)
  flush()
  return op.id
}

export function enqueueInsert(table, row) {
  const op = { id: uid(), type: 'insert', table, payload: row, dedupKey: null, sheet: null, ts: Date.now() }
  const q = load(); q.push(op); persist(q)
  flush()
  return op.id
}

export function enqueueDelete(table, match) {
  const op = { id: uid(), type: 'delete', table, match, dedupKey: null, sheet: null, ts: Date.now() }
  const q = load(); q.push(op); persist(q)
  flush()
  return op.id
}

// Annulla un'operazione ancora non sincronizzata (es. cancellare un inserimento cassa fatto offline).
// Ritorna true se era ancora in coda.
export function cancelOp(opId) {
  const q = load()
  const next = q.filter(o => o.id !== opId)
  const removed = next.length !== q.length
  if (removed) persist(next)
  return removed
}

export async function flush() {
  if (flushing) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) { notify(); return }
  flushing = true; notify()
  try {
    while (true) {
      const q = load()
      if (!q.length) break
      const op = q[0]
      try {
        if (op.type === 'update') {
          const { error } = await supabase.from(op.table).update(op.payload).match(op.match)
          if (error) throw error
        } else if (op.type === 'insert') {
          const { error } = await supabase.from(op.table).insert(op.payload)
          if (error) throw error
        } else if (op.type === 'delete') {
          const { error } = await supabase.from(op.table).delete().match(op.match)
          if (error) throw error
        }
        if (op.sheet) {
          if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('offline prima del sync foglio')
          for (const s of op.sheet) { await syncToSheet(s) }
        }
        // rimuovo l'op svolta (ricarico, potrebbe essere cambiata nel frattempo)
        const cur = load()
        const idx = cur.findIndex(o => o.id === op.id)
        if (idx >= 0) { cur.splice(idx, 1); persist(cur) }
        else persist(cur) // op già rimossa (collasso): ricalcolo stato
      } catch (e) {
        // probabile assenza di rete o errore server: mi fermo, riprovo più tardi
        console.warn('Sync in pausa, riprovo:', e?.message || e)
        break
      }
    }
  } finally {
    flushing = false; notify()
  }
}

// Auto-flush: al ritorno online, periodicamente, e all'avvio.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flush())
  window.addEventListener('offline', () => notify())
  setInterval(() => { if (navigator.onLine && load().length) flush() }, 30000)
  setTimeout(() => flush(), 1500)
}
