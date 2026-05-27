-- ============================================================
-- INVIBE STAFF APP — Schema Supabase
-- Esegui questo SQL in Supabase → SQL Editor
-- ============================================================

-- 1. Staff profiles (linked to auth.users)
create table if not exists staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  cognome text not null,
  role text not null default 'staff', -- 'staff' | 'admin'
  assigned_shifts jsonb default '[]'::jsonb, -- [{"destination":"pag","shift_num":3}, ...]
  created_at timestamptz default now()
);

-- 2. Groups (one per capogruppo per turno)
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  capogruppo_code text not null,
  capogruppo_display text not null,
  destination text not null,
  shift_num int not null,
  pratica text,
  escursioni boolean default false,
  navetta boolean default false,
  assicurazione boolean default false,
  iscrizione boolean default false,
  alloggio text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(capogruppo_code, destination, shift_num)
);

-- 3. Participants
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  cognome text,
  nome text,
  sesso text,
  nascita date,
  pratica text,
  stato text,
  created_at timestamptz default now()
);

-- 4. Auto-update updated_at on groups
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists groups_updated_at on groups;
create trigger groups_updated_at
  before update on groups
  for each row execute function update_updated_at();

-- 5. Row Level Security
alter table staff_profiles enable row level security;
alter table groups enable row level security;
alter table participants enable row level security;

-- Staff profiles: only own row, admin sees all
create policy "Staff can read own profile"
  on staff_profiles for select
  using (auth.uid() = id);

create policy "Admin can read all profiles"
  on staff_profiles for select
  using (exists (select 1 from staff_profiles where id = auth.uid() and role = 'admin'));

create policy "Admin can update profiles"
  on staff_profiles for update
  using (exists (select 1 from staff_profiles where id = auth.uid() and role = 'admin'));

-- Groups: authenticated users can read/write
create policy "Authenticated can read groups"
  on groups for select
  using (auth.role() = 'authenticated');

create policy "Authenticated can update groups"
  on groups for update
  using (auth.role() = 'authenticated');

create policy "Admin can insert groups"
  on groups for insert
  with check (exists (select 1 from staff_profiles where id = auth.uid() and role = 'admin'));

create policy "Admin can delete groups"
  on groups for delete
  using (exists (select 1 from staff_profiles where id = auth.uid() and role = 'admin'));

-- Participants: read for all authenticated, write for admin
create policy "Authenticated can read participants"
  on participants for select
  using (auth.role() = 'authenticated');

create policy "Admin can manage participants"
  on participants for all
  using (exists (select 1 from staff_profiles where id = auth.uid() and role = 'admin'));

-- 6. Helper function: create staff user (call from admin or Supabase dashboard)
-- Use Supabase Auth UI or this function to create users manually:
-- supabase.auth.admin.createUser({ email, password, user_metadata: { nome, cognome, role } })
-- Then insert into staff_profiles manually.

-- ============================================================
-- SAMPLE ADMIN INSERT (after creating user via Auth)
-- Replace 'YOUR-USER-UUID' with the actual UUID from auth.users
-- ============================================================
-- insert into staff_profiles (id, nome, cognome, role)
-- values ('YOUR-USER-UUID', 'Fabio', 'Admin', 'admin');
