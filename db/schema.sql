-- ============================================================================
-- Isnaad Connect — schema
-- Day 1, Task 4. PLAN.md Section 2.4.
--
-- 8 tables: organizations, users, rooms, room_members, messages, tasks,
-- tickets, events.
--
-- RLS is enabled and policies applied separately in rls-policies.sql.
-- Helpers in rls-helpers.sql. Triggers in triggers.sql.
-- ============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type org_kind as enum ('isnaad', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role as enum ('admin', 'am', 'internal', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type room_kind as enum ('client', 'internal', 'dm');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_kind as enum ('text', 'image', 'system', 'ai');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('open', 'in_progress', 'done', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum ('open', 'in_progress', 'pending_client', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id              uuid primary key default gen_random_uuid(),
  kind            org_kind not null,
  name            text not null,
  portal_org_id   text,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists organizations_name_active_idx
  on organizations (lower(name)) where archived_at is null;
create unique index if not exists organizations_portal_org_id_idx
  on organizations (portal_org_id) where portal_org_id is not null;

-- ---------------------------------------------------------------------------
-- users (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists users (
  id              uuid primary key references auth.users(id) on delete cascade,
  org_id          uuid not null references organizations(id) on delete restrict,
  role            user_role not null,
  email           text not null,
  full_name       text not null,
  portal_user_id  text,
  is_ai           boolean not null default false,
  deactivated_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists users_email_idx on users (lower(email));
create index if not exists users_org_idx on users (org_id);

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table if not exists rooms (
  id              uuid primary key default gen_random_uuid(),
  kind            room_kind not null,
  name            text not null,
  client_org_id   uuid references organizations(id) on delete restrict,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Client rooms must have a client org. Internal/DM rooms must not.
  constraint rooms_client_org_consistency check (
    (kind = 'client' and client_org_id is not null) or
    (kind <> 'client' and client_org_id is null)
  )
);
create index if not exists rooms_client_org_idx on rooms (client_org_id);

-- ---------------------------------------------------------------------------
-- room_members
-- ---------------------------------------------------------------------------
create table if not exists room_members (
  id                    uuid primary key default gen_random_uuid(),
  room_id               uuid not null references rooms(id) on delete cascade,
  user_id               uuid not null references users(id) on delete cascade,
  is_assigned_am        boolean not null default false,
  last_read_message_id  uuid,
  joined_at             timestamptz not null default now(),
  unique (room_id, user_id)
);
create index if not exists room_members_user_idx on room_members (user_id);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references rooms(id) on delete cascade,
  sender_id   uuid not null references users(id) on delete restrict,
  kind        message_kind not null default 'text',
  body        text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists messages_room_created_idx on messages (room_id, created_at desc);
create index if not exists messages_sender_idx on messages (sender_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists tasks (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid references rooms(id) on delete set null,
  source_message_id uuid references messages(id) on delete set null,
  client_org_id     uuid references organizations(id) on delete restrict,
  title             text not null,
  description       text,
  assignee_id       uuid references users(id) on delete set null,
  creator_id        uuid not null references users(id) on delete restrict,
  due_at            timestamptz,
  status            task_status not null default 'open',
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists tasks_assignee_status_idx on tasks (assignee_id, status);
create index if not exists tasks_client_org_idx on tasks (client_org_id);
create index if not exists tasks_room_idx on tasks (room_id);

-- ---------------------------------------------------------------------------
-- tickets
-- ---------------------------------------------------------------------------
create table if not exists tickets (
  id              uuid primary key default gen_random_uuid(),
  ticket_number   text not null unique,
  room_id         uuid references rooms(id) on delete set null,
  client_org_id   uuid not null references organizations(id) on delete restrict,
  title           text not null,
  description     text,
  status          ticket_status not null default 'open',
  assigned_am_id  uuid references users(id) on delete set null,
  creator_id      uuid not null references users(id) on delete restrict,
  sla_due_at      timestamptz,
  sla_breached    boolean not null default false,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists tickets_status_idx on tickets (status);
create index if not exists tickets_client_org_idx on tickets (client_org_id);
create index if not exists tickets_assigned_am_idx on tickets (assigned_am_id);
create index if not exists tickets_sla_due_idx on tickets (sla_due_at) where sla_breached = false and status in ('open','in_progress','pending_client');

-- Ticket number generator (sequence + format ISN-NNNNN)
create sequence if not exists tickets_number_seq;

-- ---------------------------------------------------------------------------
-- events (audit log, append-only)
-- ---------------------------------------------------------------------------
create table if not exists events (
  id            bigint generated always as identity primary key,
  actor_id      uuid references users(id) on delete set null,
  entity_type   text not null,
  entity_id     uuid not null,
  action        text not null,
  changes       jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists events_entity_idx on events (entity_type, entity_id, created_at desc);
create index if not exists events_actor_idx on events (actor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — enable on every table (policies live in rls-policies.sql)
-- ---------------------------------------------------------------------------
alter table organizations enable row level security;
alter table users         enable row level security;
alter table rooms         enable row level security;
alter table room_members  enable row level security;
alter table messages      enable row level security;
alter table tasks         enable row level security;
alter table tickets       enable row level security;
alter table events        enable row level security;
