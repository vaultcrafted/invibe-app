-- Colonne servizi "in meta" per Zante / Gallipoli / Sardegna
-- Eseguire UNA VOLTA nel SQL editor di Supabase, prima di usare la sync su queste mete.
alter table groups
  -- Zante
  add column if not exists zan_escursioni      numeric default 0,
  add column if not exists zan_boat            numeric default 0,
  add column if not exists zan_tassa_soggiorno numeric default 0,
  add column if not exists zan_cebu            numeric default 0,
  add column if not exists zan_bbq             numeric default 0,
  -- Gallipoli
  add column if not exists gal_escursioni      numeric default 0,
  add column if not exists gal_boat_party      numeric default 0,
  add column if not exists gal_tassa_soggiorno numeric default 0,
  add column if not exists gal_vega            numeric default 0,
  add column if not exists gal_dinner_elegant  numeric default 0,
  add column if not exists gal_praja           numeric default 0,
  -- Sardegna
  add column if not exists sar_escursioni        numeric default 0,
  add column if not exists sar_ssp               numeric default 0,
  add column if not exists sar_tassa_soggiorno   numeric default 0,
  add column if not exists sar_pacchetto_serate  numeric default 0,
  add column if not exists sar_pacchetto_saltafila numeric default 0;
