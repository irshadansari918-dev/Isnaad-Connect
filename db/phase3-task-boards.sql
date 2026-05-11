-- ============================================================================
-- Phase 3.2 — Task Boards (Kanban)
-- Tables: task_boards, task_columns
-- Adds board_id + column_id + position to tasks table.
-- ============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- task_boards — one per department or standalone
-- ---------------------------------------------------------------------------
create table if not exists task_boards (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  department_id uuid references departments(id) on delete set null,
  org_id        uuid not null references organizations(id) on delete restrict,
  created_by    uuid not null references users(id) on delete restrict,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists task_boards_dept_idx on task_boards (department_id);
create index if not exists task_boards_org_idx on task_boards (org_id);

-- ---------------------------------------------------------------------------
-- task_columns — ordered columns in a board
-- ---------------------------------------------------------------------------
create table if not exists task_columns (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references task_boards(id) on delete cascade,
  name       text not null,
  position   integer not null default 0,
  color      text not null default '#94A3B8',
  created_at timestamptz not null default now()
);
create index if not exists task_columns_board_idx on task_columns (board_id, position);

-- ---------------------------------------------------------------------------
-- Extend tasks table: link to board + column + position
-- ---------------------------------------------------------------------------
alter table tasks add column if not exists board_id uuid references task_boards(id) on delete set null;
alter table tasks add column if not exists column_id uuid references task_columns(id) on delete set null;
alter table tasks add column if not exists position integer not null default 0;

create index if not exists tasks_board_idx on tasks (board_id);
create index if not exists tasks_column_position_idx on tasks (column_id, position);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table task_boards enable row level security;
alter table task_columns enable row level security;

-- task_boards: admin full access
create policy "task_boards_admin_full"
  on task_boards for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- task_boards: read if in same org or department member
create policy "task_boards_read_org"
  on task_boards for select
  using (
    org_id in (select org_id from users where id = auth.uid())
    or department_id in (
      select department_id from department_members where user_id = auth.uid()
    )
  );

-- task_boards: staff (am, internal) can create/update in own org
create policy "task_boards_staff_write"
  on task_boards for insert
  with check (
    exists (select 1 from users where id = auth.uid() and role in ('admin', 'am', 'internal'))
  );

create policy "task_boards_staff_update"
  on task_boards for update
  using (
    exists (select 1 from users where id = auth.uid() and role in ('admin', 'am', 'internal'))
  );

-- task_columns: same access as parent board
create policy "task_columns_admin_full"
  on task_columns for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

create policy "task_columns_read"
  on task_columns for select
  using (
    board_id in (select id from task_boards)
  );

create policy "task_columns_staff_write"
  on task_columns for insert
  with check (
    exists (select 1 from users where id = auth.uid() and role in ('admin', 'am', 'internal'))
  );

create policy "task_columns_staff_update"
  on task_columns for update
  using (
    exists (select 1 from users where id = auth.uid() and role in ('admin', 'am', 'internal'))
  );

create policy "task_columns_staff_delete"
  on task_columns for delete
  using (
    exists (select 1 from users where id = auth.uid() and role in ('admin', 'am', 'internal'))
  );

-- ---------------------------------------------------------------------------
-- Default board template: creates default columns when board is created
-- ---------------------------------------------------------------------------
create or replace function create_default_columns()
returns trigger as $$
begin
  insert into task_columns (board_id, name, position, color) values
    (NEW.id, 'To Do',        0, '#94A3B8'),
    (NEW.id, 'In Progress',  1, '#3B82F6'),
    (NEW.id, 'Review',       2, '#F59E0B'),
    (NEW.id, 'Done',         3, '#10B981');
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_create_default_columns on task_boards;
create trigger trg_create_default_columns
  after insert on task_boards
  for each row
  execute function create_default_columns();
