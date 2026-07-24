import { supabase } from './supabase'
import { syncToSheet, sendCassaToSheet } from './sheetsSync'

// Coda di scritture offline.
// - Le scritture vengono accodate e applicate subito se c'è rete (comportamento identico a prima).
// - Offline restano in coda (persistite su localStorage, sopravvivono a chiusura app).
// - Al ritorno della connessione la coda viene svuotata: prima Supabase, poi il foglio Google.
// - Gli UPDATE collassano per dedupKey: di uno stesso campo (gruppo+servizio, nota, ecc.) tiene l'ultimo valore.

const KEY = 'invibe_sync_queue_v1'
const listeners = new Set()
let flushing = false
let batchTotal = 0   // picco della coda nel lotto corrente (per la percentuale)

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function persist(q) {
  try { localStorage.setItem(KEY, JSON.stringify(q)) } catch (e) { /* quota */ }
  batchTotal = q.length === 0 ? 0 : Math.max(batchTotal, q.length)
  notify()
}
function notify() {
  const st = getState()
  listeners.forEach(cb => { try { cb(st) } catch (e) {} })
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }

export function getState() {
  const pending = load().length
  return {
    pending,
    total: batchTotal,
    done: Math.max(0, batchTotal - pending),
    percent: batchTotal > 0 ? Math.round(((batchTotal - pending) / batchTotal) * 100) : 100,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncing: flushing,
  }
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

// INSERT. sheet = array di payload per syncToSheet (opzionale, stesso meccanismo di retry di enqueueUpdate).
export function enqueueInsert(table, row, opts = {}) {
  const op = { id: uid(), type: 'insert', table, payload: row, dedupKey: null, sheet: opts.sheet || null, ts: Date.now() }
  const q = load(); q.push(op); persist(q)
  flush()
  return op.id
}

export function enqueueDelete(table, match, opts = {}) {
  const op = { id: uid(), type: 'delete', table, match, dedupKey: null, sheet: opts.sheet || null, ts: Date.now() }
  const q = load(); q.push(op); persist(q)
  flush()
  return op.id
}

// Mette in coda con retry SOLO la parte foglio, senza nessuna operazione DB associata — utile
// quando il salvataggio su Supabase è già stato fatto a parte (es. un form che vuole un errore
// immediato se il DB fallisce), ma si vuole comunque che il sync verso il foglio Google riprovi
// automaticamente se fallisce, invece di essere "spara e spera".
export function enqueueSheetOnly(sheetPayloads) {
  const op = { id: uid(), type: 'sheet-retry', sheet: sheetPayloads, sheetRetryCount: 0, dedupKey: null, ts: Date.now() }
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

// Manda un singolo payload al foglio. Per i movimenti di CASSA, registra prima l'intenzione in
// una tabella lato server (cassa_sheet_queue): così, anche se questo tentativo fallisce E il
// browser si chiude prima di riuscire a riprovare, resta una traccia che una Edge Function
// schedulata (cron, lato server) può riprendere da sola — non dipende più dal fatto che sia
// rimasto aperto proprio QUESTO browser/dispositivo.
async function sendSheetPayload(s) {
  if (!(s && s.__kind === 'cassa')) { await syncToSheet(s); return }
  let queueId = null
  try {
    const { data } = await supabase.from('cassa_sheet_queue').insert({ payload: s }).select('id').single()
    queueId = data?.id ?? null
  } catch (e) { /* offline o RLS: pace, il retry locale prova comunque a mandarlo lo stesso */ }
  await sendCassaToSheet(s)
  if (queueId != null) {
    supabase.from('cassa_sheet_queue').update({ done: true, done_at: new Date().toISOString() }).eq('id', queueId)
      .then(() => {}, () => {}) // se questo fallisce non è grave: il cron la rimanderà (doppione raro e innocuo)
  }
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
        if (op.type === 'sheet-retry') {
          // Riprova solo il sync foglio di un'operazione DB già andata a buon fine in precedenza.
          // Non deve MAI bloccare la coda: se fallisce ancora, si riaccoda da solo (fino al tetto).
          try {
            for (const s of op.sheet) { await sendSheetPayload(s) }
          } catch (sheetErr) {
            console.warn('Retry sync foglio fallito ancora:', sheetErr?.message || sheetErr)
            const retryCount = (op.sheetRetryCount || 0) + 1
            if (retryCount <= 5) {
              const cur = load()
              cur.push({ id: uid(), type: 'sheet-retry', sheet: op.sheet, sheetRetryCount: retryCount, dedupKey: null, ts: Date.now() })
              persist(cur)
            } else {
              console.error('Sync foglio abbandonato dopo troppi tentativi:', op.sheet)
            }
          }
        } else {
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
          // Il salvataggio su Supabase (fonte di verità) è andato a buon fine: da qui in poi
          // un eventuale fallimento riguarda SOLO il foglio Google, e non deve bloccare le
          // altre operazioni in coda (altrimenti un foglio irraggiungibile ferma tutta l'app),
          // né far ripetere la scrittura DB già riuscita (che duplicherebbe l'inserimento).
          if (op.sheet) {
            const offline = typeof navigator !== 'undefined' && !navigator.onLine
            let sheetOk = false
            if (!offline) {
              try {
                for (const s of op.sheet) { await sendSheetPayload(s) }
                sheetOk = true
              } catch (sheetErr) {
                console.warn('Sync foglio fallito, riprovo più tardi (non blocca il resto):', sheetErr?.message || sheetErr)
              }
            }
            if (!sheetOk) {
              const retryCount = (op.sheetRetryCount || 0) + 1
              if (retryCount <= 5) {
                const cur = load()
                cur.push({ id: uid(), type: 'sheet-retry', sheet: op.sheet, sheetRetryCount: retryCount, dedupKey: null, ts: Date.now() })
                persist(cur)
              } else {
                console.error('Sync foglio abbandonato dopo troppi tentativi:', op.sheet)
              }
            }
          }
        }
        // rimuovo l'op svolta (ricarico, potrebbe essere cambiata nel frattempo)
        const cur = load()
        const idx = cur.findIndex(o => o.id === op.id)
        if (idx >= 0) { cur.splice(idx, 1); persist(cur) }
        else persist(cur) // op già rimossa (collasso): ricalcolo stato
      } catch (e) {
        // probabile assenza di rete o errore server sul DB: mi fermo, riprovo più tardi
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
