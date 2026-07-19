import { SHEET_SERVIZIO_MAP, getTurnoSheetName } from './constants'

const WEBHOOK_URL = import.meta.env.VITE_SHEETS_WEBHOOK_URL

// Manda un movimento di cassa al foglio di rendicontazione (aggiunta o eliminazione).
// Propaga l'errore in caso di fallimento: chi la chiama (syncQueue) gestisce il retry.
export async function sendCassaToSheet({ destination, shift_num, azione, tipoMov, importo, descrizione, categoria, metodo, data }) {
  if (!WEBHOOK_URL) return
  const turno = getTurnoSheetName(destination, shift_num)
  if (!turno) return
  await fetch(WEBHOOK_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      tipo: 'cassa',
      azione: azione || 'add',            // 'add' | 'elimina'
      turno,
      tipoMov,                            // 'entrata' | 'uscita'
      importo: Number(importo) || 0,
      descrizione: descrizione || '',
      categoria: categoria || '',
      metodo: metodo || 'Cash',
      data: data || '',
    }),
  })
}

// Spara l'aggiornamento al foglio Google Sheets di rendicontazione.
// Propaga l'errore in caso di fallimento: chi la chiama (syncQueue) gestisce il retry.
export async function syncToSheet({ destination, shift_num, capogruppo_code, servizioId, quantita }) {
  if (!WEBHOOK_URL) return

  const servizio = SHEET_SERVIZIO_MAP[servizioId]
  const turno = getTurnoSheetName(destination, shift_num)
  if (!servizio || !turno) return // servizio o destinazione non collegati al foglio

  await fetch(WEBHOOK_URL, {
    method: 'POST',
    mode: 'no-cors', // Apps Script non manda header CORS: non possiamo leggere la risposta
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ turno, codice: capogruppo_code, servizio, quantita }),
  })
}
