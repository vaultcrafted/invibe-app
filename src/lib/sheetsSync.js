import { SHEET_SERVIZIO_MAP, getTurnoSheetName } from './constants'

const WEBHOOK_URL = import.meta.env.VITE_SHEETS_WEBHOOK_URL

// Spara l'aggiornamento al foglio Google Sheets di rendicontazione.
// Fire-and-forget: se fallisce non blocca il salvataggio su Supabase (che resta la fonte di verità).
export async function syncToSheet({ destination, shift_num, capogruppo_code, servizioId, quantita }) {
  if (!WEBHOOK_URL) return

  const servizio = SHEET_SERVIZIO_MAP[servizioId]
  const turno = getTurnoSheetName(destination, shift_num)
  if (!servizio || !turno) return // servizio o destinazione non collegati al foglio

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors', // Apps Script non manda header CORS: non possiamo leggere la risposta
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ turno, codice: capogruppo_code, servizio, quantita }),
    })
  } catch (err) {
    console.error('Sync foglio rendicontazione fallita:', err)
  }
}
