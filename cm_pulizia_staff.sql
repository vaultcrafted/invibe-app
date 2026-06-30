-- Rimuove le prenotazioni STAFF entrate per errore come gruppi partecipanti
-- (codice capogruppo che contiene "STAFF": ANGELONISTAFF, GJINISTAFF, ecc.)
-- Eseguire UNA VOLTA nel SQL editor di Supabase.
-- NB: NON tocca le vere prenotazioni partecipanti (es. 122ANGELONI), che restano.

delete from participants
  where group_id in (select id from groups where upper(capogruppo_code) like '%STAFF%');

delete from groups
  where upper(capogruppo_code) like '%STAFF%';
