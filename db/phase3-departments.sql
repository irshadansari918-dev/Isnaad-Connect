-- ============================================================================
-- Phase 3.1 — Departments
-- Tables: departments, department_members
-- Auto-creates an internal room when a department is created.
-- ============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
create table if not exists departments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete restrict,
  name        text not null,
  slug        text not null,
  color       text not null default '#3B82F6',
  description text,
  head_id     uuid references users(id) on delete set null,
  room_id     uuid references rooms(id) on delete set null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists departments_org_slug_idx
  on departments (org_id, slug) where archived_at is null;
create index if not exists departments_org_idx on departments (org_id);

-- ---------------------------------------------------------------------------
-- department_members
-- ---------------------------------------------------------------------------
create table if not exists department_members (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  is_head       boolean not null default false,
  joined_at     timestamptz not null default now(),
  unique (department_id, user_id)
);
create index if not exists department_members_user_idx on department_members (user_id);
create index if not exists department_members_dept_idx on department_members (department_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table departments enable row level security;
alter table department_members enable row level security;

-- Departments: admin full access, others read own org
create policy "departments_admin_full"
  on departments for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

create policy "departments_read_own_org"
  on departments for select
  using (
    org_id in (select org_id from users where id = auth.uid())
  );

-- Department members: admin full access, read own department membership, members read co-members
create policy "department_members_admin_full"
  on department_members for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

create policy "department_members_read"
  on department_members for select
  using (
    department_id in (
      select department_id from department_members where user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Trigger: auto-create internal room when department is created
-- ---------------------------------------------------------------------------
create or replace function auto_create_department_room()
returns trigger as $$
declare
  new_room_id uuid;
  sanad_id uuid;
begin
  -- Create internal room named after department
  insert into rooms (kind, name)
  values ('internal', NEW.name)
  returning id into new_room_id;

  -- Link room to department
  update departments set room_id = new_room_id where id = NEW.id;

  -- Auto-add Sanad (AI) to the room
  select id into sanad_id from users where is_ai = true limit 1;
  if sanad_id is not null then
    insert into room_members (room_id, user_id)
    values (new_room_id, sanad_id)
    on conflict do nothing;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_auto_create_department_room on departments;
create trigger trg_auto_create_department_room
  after insert on departments
  for each row
  execute function auto_create_department_room();

-- ---------------------------------------------------------------------------
-- Trigger: sync department members to room members
-- When a user is added to a department, also add them to the department room.
-- ---------------------------------------------------------------------------
create or replace function sync_department_member_to_room()
returns trigger as $$
declare
  dept_room_id uuid;
begin
  select room_id into dept_room_id from departments where id = NEW.department_id;
  if dept_room_id is not null then
    insert into room_members (room_id, user_id)
    values (dept_room_id, NEW.user_id)
    on conflict do nothing;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_dept_member_to_room on department_members;
create trigger trg_sync_dept_member_to_room
  after insert on department_members
  for each row
  execute function sync_department_member_to_room();

-- ---------------------------------------------------------------------------
-- Trigger: remove from room when removed from department
-- ---------------------------------------------------------------------------
create or replace function unsync_department_member_from_room()
returns trigger as $$
declare
  dept_room_id uuid;
begin
  select room_id into dept_room_id from departments where id = OLD.department_id;
  if dept_room_id is not null then
    delete from room_members
    where room_id = dept_room_id and user_id = OLD.user_id;
  end if;
  return OLD;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_unsync_dept_member_from_room on department_members;
create trigger trg_unsync_dept_member_from_room
  after delete on department_members
  for each row
  execute function unsync_department_member_from_room();

-- ---------------------------------------------------------------------------
-- Audit log triggers
-- ---------------------------------------------------------------------------
create or replace function log_department_changes()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into events (actor_id, entity_type, entity_id, action, changes)
    values (auth.uid(), 'department', NEW.id, 'created', to_jsonb(NEW));
  elsif TG_OP = 'UPDATE' then
    insert into events (actor_id, entity_type, entity_id, action, changes)
    values (auth.uid(), 'department', NEW.id, 'updated',
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
  end if;
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

drop trigger if exists trg_log_department_changes on departments;
create trigger trg_log_department_changes
  after insert or update on departments
  for each row
  execute function log_department_changes();
