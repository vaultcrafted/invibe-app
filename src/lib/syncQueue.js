import { supabase } from './supabase'
import { syncToSheet, sendCassaToSheet } from './sheetsSync'

// Coda di scritture offline.
// - Le scritture vengono accodate e applicate subito se c'è rete (comportamento identico a prima).
// - Offline restano in coda (persistite su localStorage, sopravvivono a chiusura app).
// - Al ritorno della connessione la coda viene svuotata: prima Supabase, poi il foglio Google.
// - Gli UPDATE collassano per dedupKey: di uno stesso campo (gruppo+servizio, nota, ecc.) tiene l'ultimo valore.

const KEY = 'invibe_sync_queue_v1'
const listeners = new Set()
const avvisiListeners = new Set()
let avvisi = []      // avvisi visibili all'utente sulle scritture verso il foglio
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

// Marchia ogni payload di CASSA con un codice unico e stabile.
// Serve perche' una scrittura verso il foglio puo' essere ritentata piu' volte:
// dalla coda locale, dal cron ogni 5 minuti, o perche' Google ha risposto con un
// errore pur avendo gia' scritto. Senza un codice, l'unico modo per riconoscere
// un ritentativo era confrontare importo e descrizione — e due incassi identici
// ma veri risultavano indistinguibili da un duplicato.
// Con il codice, Apps Script lo registra nel database prima di scrivere: se
// esiste gia', la riga c'e' e non la riscrive.
function marchiaCassa(payloads) {
  if (!Array.isArray(payloads)) return payloads
  payloads.forEach(p => {
    if (p && p.__kind === 'cassa' && !p.movId) p.movId = uid()
  })
  return payloads
}

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
// --- AVVISI sulle scritture verso il foglio -------------------------------
// Finora un movimento poteva non arrivare sul foglio senza che nessuno lo
// sapesse: la coda riprovava in silenzio e, se non ce la faceva, la differenza
// si scopriva solo giorni dopo confrontando i totali. Da qui in poi l'utente
// lo vede subito.
export function subscribeAvvisi(cb) {
  avvisiListeners.add(cb)
  cb(avvisi)
  return () => avvisiListeners.delete(cb)
}
function notificaAvvisi() {
  avvisiListeners.forEach(cb => { try { cb(avvisi) } catch (e) {} })
}
function aggiungiAvviso(testo, dettaglio) {
  avvisi = [...avvisi, { id: uid(), testo, dettaglio: dettaglio || '', ts: Date.now() }].slice(-5)
  notificaAvvisi()
}
export function scartaAvviso(id) {
  avvisi = avvisi.filter(a => a.id !== id)
  notificaAvvisi()
}

export function subscribe(cb) {
  listeners.add(cb)
  cb(getState())
  return () => listeners.delete(cb)
}

// UPDATE con collasso per dedupKey (l'ultimo valore vince). sheet = array di payload per syncToSheet (opzionale).
export function enqueueUpdate(table, match, payload, opts = {}) {
  const op = { id: uid(), type: 'update', table, match, payload, dedupKey: opts.dedupKey || null, sheet: marchiaCassa(opts.sheet) || null, ts: Date.now() }
  const q = load()
  const next = op.dedupKey ? q.filter(o => o.dedupKey !== op.dedupKey) : q.slice()
  next.push(op)
  persist(next)
  flush()
  return op.id
}

// INSERT. sheet = array di payload per syncToSheet (opzionale, stesso meccanismo di retry di enqueueUpdate).
export function enqueueInsert(table, row, opts = {}) {
  const sheet = marchiaCassa(opts.sheet) || null
  // Il movimento e la sua riga sul foglio devono portare la STESSA etichetta:
  // e' cosi' che l'app sa, dopo, se quella riga e' davvero arrivata.
  if (table === 'cassa_movimenti' && sheet && sheet[0] && sheet[0].movId) {
    // sheet_ok resta al suo default (true): la conferma automatica e'
    // disattivata, e marcarli "da confermare" senza nessuno che li confermi
    // lasciava ogni movimento nuovo in rosso per sempre.
    row = { ...row, sheet_mov_id: sheet[0].movId }
  }
  const op = { id: uid(), type: 'insert', table, payload: row, dedupKey: null, sheet, ts: Date.now() }
  const q = load(); q.push(op); persist(q)
  flush()
  return op.id
}

export function enqueueDelete(table, match, opts = {}) {
  const op = { id: uid(), type: 'delete', table, match, dedupKey: null, sheet: marchiaCassa(opts.sheet) || null, ts: Date.now() }
  const q = load(); q.push(op); persist(q)
  flush()
  return op.id
}

// Mette in coda con retry SOLO la parte foglio, senza nessuna operazione DB associata — utile
// quando il salvataggio su Supabase è già stato fatto a parte (es. un form che vuole un errore
// immediato se il DB fallisce), ma si vuole comunque che il sync verso il foglio Google riprovi
// automaticamente se fallisce, invece di essere "spara e spera".
export function enqueueSheetOnly(sheetPayloads) {
  const op = { id: uid(), type: 'sheet-retry', sheet: marchiaCassa(sheetPayloads), sheetRetryCount: 0, dedupKey: null, ts: Date.now() }
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
// una tabella lato server (cassa_sheet_queue), poi chiede alla Edge Function di provarlo SUBITO
// (fetch reale lato server, non 'no-cors' come da browser: qui possiamo davvero sapere se e'
// andato a buon fine, invece di illuderci — Apps Script risponde sempre HTTP 200 anche quando
// fallisce, mettendo l'errore vero dentro al corpo della risposta, che il browser in no-cors non
// può leggere). Se anche questo tentativo fallisce, la riga resta pendente e il cron ogni 5 min
// la riprende da sola.
async function sendSheetPayload(s) {
  if (!(s && s.__kind === 'cassa')) { await syncToSheet(s); return }
  let queueId = null
  try {
    const { data } = await supabase.from('cassa_sheet_queue').insert({ payload: s }).select('id').single()
    queueId = data?.id ?? null
  } catch (e) { /* offline o RLS: pace, resta comunque da processare via il vecchio fallback sotto */ }

  if (queueId != null) {
    const { data, error } = await supabase.functions.invoke('cassa-sheet-reconcile', { body: { onlyId: queueId } })
    if (error || !data || data.succeeded !== 1) {
      throw new Error((data && data.error) || error?.message || 'sync foglio non confermato, il cron lo riprenderà')
    }
    // Riuscito. Controllo cosa e' successo davvero sul foglio: Apps Script
    // registra ogni scrittura in cassa_sheet_scritture con la riga esatta.
    // VERIFICA DISATTIVATA. Si basa sul registro cassa_sheet_scritture, che
    // Apps Script al momento non riesce a compilare: il risultato erano avvisi
    // "non scritto sul foglio" su righe che invece c'erano. Un avviso che
    // sbaglia e' peggio di nessun avviso, perche' insegna a ignorarlo.
    // Da riattivare solo quando il registro si popola davvero.
    // await verificaScrittura(s)
  } else {
    // Fallback raro (RLS/offline sulla insert): meglio tentare comunque alla vecchia maniera
    // che perdere del tutto il tentativo immediato.
    await sendCassaToSheet(s)
  }
}

// Dopo una scrittura riuscita, controlla nel registro che sia finita UNA sola
// riga sul foglio. Il registro e' scritto da Apps Script: se il codice non c'e',
// la riga non e' mai arrivata; se ce ne fossero due, sarebbe un duplicato.
async function verificaScrittura(s) {
  if (!s || !s.movId) return
  // Solo per le AGGIUNTE. Su una cancellazione il registro viene giustamente
  // svuotato, e cercare la riga darebbe un falso allarme "non scritto".
  if (String(s.azione || 'add').toLowerCase() !== 'add') return
  try {
    const { data } = await supabase
      .from('cassa_sheet_scritture')
      .select('mov_id,riga,turno')
      .eq('mov_id', s.movId)
    const n = (data || []).length
    const capo = s.descrizione || s.categoria || 'movimento'
    if (n === 1) {
      // Confermato: la riga c'e', ed e' una sola.
      await supabase.from('cassa_movimenti').update({ sheet_ok: true }).eq('sheet_mov_id', s.movId)
    }
    if (n === 0) {
      aggiungiAvviso(
        'NON scritto sul foglio: ' + capo,
        'Il movimento e\' salvato nell\'app ma la riga non risulta sulla rendicontazione. Verra\' ritentato: se l\'avviso torna, aggiungila a mano.')
    } else if (n > 1) {
      aggiungiAvviso(
        'Scritto piu\' volte sul foglio: ' + capo,
        'Risultano ' + n + ' righe per lo stesso movimento. Vanno tolte le copie in eccesso.')
    }
  } catch (e) { /* la verifica non deve mai bloccare il salvataggio */ }
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
