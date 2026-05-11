-- ============================================================================
-- Isnaad Connect — triggers
-- Day 1, Task 7. PLAN.md Section 8.1.5.
--
-- Two trigger families:
--   1. set_updated_at — bump updated_at on row updates
--   2. log_event      — append-only audit row to events for every write to
--                       messages, tasks, tickets, rooms, room_members
-- ============================================================================

-- ---------------------------------------------------------------------------
-- set_updated_at()
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Apply to tables that have updated_at
drop trigger if exists organizations_set_updated_at on organizations;
create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function public.set_updated_at();

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at
  before update on users
  for each row execute function public.set_updated_at();

drop trigger if exists rooms_set_updated_at on rooms;
create trigger rooms_set_updated_at
  before update on rooms
  for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function public.set_updated_at();

drop trigger if exists tickets_set_updated_at on tickets;
create trigger tickets_set_updated_at
  before update on tickets
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- log_event()
--   Generic audit logger. Uses TG_TABLE_NAME as entity_type and the row's id
--   column as entity_id. SECURITY DEFINER so it can insert into events even
--   though events has no public insert policy.
-- ---------------------------------------------------------------------------
create or replace function public.log_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor      uuid := auth.uid();
  v_action     text := lower(tg_op);
  v_entity_id  uuid;
  v_changes    jsonb;
begin
  if tg_op = 'DELETE' then
    v_entity_id := old.id;
    v_changes   := jsonb_build_object('old', to_jsonb(old));
  elsif tg_op = 'INSERT' then
    v_entity_id := new.id;
    v_changes   := jsonb_build_object('new', to_jsonb(new));
  else
    v_entity_id := new.id;
    v_changes   := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  end if;

  insert into public.events (actor_id, entity_type, entity_id, action, changes)
  values (v_actor, tg_table_name, v_entity_id, v_action, v_changes);

  return null; -- AFTER trigger, return value ignored
end;
$$;

revoke all on function public.log_event() from public;

-- Apply audit triggers to the 5 tables per PLAN.md 8.1.5
drop trigger if exists messages_log_event on messages;
create trigger messages_log_event
  after insert or update or delete on messages
  for each row execute function public.log_event();

drop trigger if exists tasks_log_event on tasks;
create trigger tasks_log_event
  after insert or update or delete on tasks
  for each row execute function public.log_event();

drop trigger if exists tickets_log_event on tickets;
create trigger tickets_log_event
  after insert or update or delete on tickets
  for each row execute function public.log_event();

drop trigger if exists rooms_log_event on rooms;
create trigger rooms_log_event
  after insert or update or delete on rooms
  for each row execute function public.log_event();

drop trigger if exists room_members_log_event on room_members;
create trigger room_members_log_event
  after insert or update or delete on room_members
  for each row execute function public.log_event();


-- ---------------------------------------------------------------------------
-- assign_ticket_number()
--   Auto-fill ticket_number on insert. Format ISN-00001.
-- ---------------------------------------------------------------------------
create or replace function public.assign_ticket_number()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_number is null or new.ticket_number = '' then
    new.ticket_number := 'ISN-' || lpad(nextval('tickets_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_assign_number on tickets;
create trigger tickets_assign_number
  before insert on tickets
  for each row execute function public.assign_ticket_number();
