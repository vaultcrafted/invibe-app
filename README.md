# Invibe Staff App

Gestionale interno per lo staff Invibe — Summer 2026.

## Stack
- React + Vite (frontend)
- Supabase (database + auth)
- Vercel (hosting gratuito)
- PWA (installabile su iPhone/Android)

---

## Setup (da fare una volta sola)

### 1. Supabase — crea il database

1. Vai su [supabase.com](https://supabase.com) → apri il progetto "Invibe app"
2. Vai su **SQL Editor**
3. Incolla il contenuto di `supabase_schema.sql` ed esegui

### 2. Configura le variabili d'ambiente

Copia `.env.example` in `.env`:
```
cp .env.example .env
```
Poi apri `.env` e inserisci la tua **anon key** da Supabase → Settings → API:
```
VITE_SUPABASE_URL=https://kiqghrxygraijcozdmkp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...la-tua-chiave...
```

### 3. Installa dipendenze e avvia in locale
```bash
npm install
npm run dev
```
L'app gira su http://localhost:5173

### 4. Crea il primo utente admin

1. Vai su Supabase → **Authentication → Users → Add user**
2. Inserisci email e password (es. `fabio@invibe.it` / password sicura)
3. Copia l'UUID mostrato
4. Vai su **SQL Editor** ed esegui:
```sql
insert into staff_profiles (id, nome, cognome, role)
values ('UUID-COPIATO', 'Fabio', 'Cognome', 'admin');
```
5. Ora puoi loggarti con quell'utente nell'app

### 5. Crea utenti staff

Per ogni membro dello staff:
1. Supabase → Authentication → Users → Add user
2. Copia UUID
3. Inserisci in staff_profiles con role = 'staff'
4. L'admin nell'app può poi assegnargli i turni

---

## Deploy su Vercel (gratuito)

### Prima volta:
1. Carica il codice su GitHub (nuovo repository)
2. Vai su [vercel.com](https://vercel.com) → New Project → importa il repo
3. In "Environment Variables" aggiungi:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy → l'app è live su `invibe-staff.vercel.app`

### Aggiornamenti futuri:
Ogni push su GitHub aggiorna automaticamente l'app su Vercel.

---

## Struttura pagine

| Route | Pagina |
|-------|--------|
| `/login` | Login |
| `/` | Selezione meta |
| `/destination/:destId` | Selezione turno |
| `/shift/:destId/:shiftNum` | Lista gruppi |
| `/group/:groupId` | Dettaglio gruppo |
| `/admin` | Pannello admin |

---

## Importare partecipanti (admin)

1. Accedi come admin
2. Vai in **Pannello Admin → Import Excel**
3. Carica il file `FILE_CM_2026.xlsx` (stesso formato del 2025)
4. L'app importa tutti i gruppi e partecipanti automaticamente
5. I flag già salvati (escursioni, navetta, ecc.) non vengono sovrascritti

---

## Installare l'app su telefono (PWA)

**iPhone (Safari):**
1. Apri il link dell'app in Safari
2. Tocca il tasto condividi (□↑)
3. "Aggiungi a schermata Home"

**Android (Chrome):**
1. Apri il link in Chrome
2. Tocca i tre puntini → "Aggiungi a schermata Home"
