-- Nuova colonna servizio Corfù: Solo Pool Sunrise
-- Eseguire UNA VOLTA nel SQL editor di Supabase.
alter table groups
  add column if not exists qta_pool_sunrise numeric default 0;
