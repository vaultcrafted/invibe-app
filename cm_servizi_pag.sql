-- Colonne servizi "in meta" per Pag (SSP/Boat/Vida sdoppiati cash/bonifico)
-- Eseguire UNA VOLTA nel SQL editor di Supabase, prima di usare la sync su Pag.
alter table groups
  add column if not exists pag_navetta         numeric default 0,
  add column if not exists pag_tassa_soggiorno numeric default 0,
  add column if not exists pag_ssp_cash        numeric default 0,
  add column if not exists pag_ssp_bonifico    numeric default 0,
  add column if not exists pag_boat_cash       numeric default 0,
  add column if not exists pag_boat_bonifico   numeric default 0,
  add column if not exists pag_vida_cash       numeric default 0,
  add column if not exists pag_vida_bonifico   numeric default 0,
  add column if not exists pag_vida_sun        numeric default 0,
  add column if not exists pag_cantante_extra  numeric default 0;
