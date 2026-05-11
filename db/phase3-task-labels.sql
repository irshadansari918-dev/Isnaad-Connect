-- ============================================================================
-- Phase 3.3 — Task Labels
-- Tables: task_labels, task_label_assignments (pivot)
-- ============================================================================

set search_path = public;

-- ---------------------------------------------------------------------------
-- task_labels — reusable labels per organization
-- ---------------------------------------------------------------------------
create table if not exists task_labels (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete restrict,
  name       text not null,
  color      text not null default '#94A3B8',
  created_at timestamptz not null default now()
);
create unique index if not exists task_labels_org_name_idx
  on task_labels (org_id, lower(name));

-- ---------------------------------------------------------------------------
-- task_label_assignments — pivot between tasks and labels
-- ---------------------------------------------------------------------------
create table if not exists task_label_assignments (
  id       uuid primary key default gen_random_uuid(),
  task_id  uuid not null references tasks(id) on delete cascade,
  label_id uuid not null references task_labels(id) on delete cascade,
  unique (task_id, label_id)
);
create index if not exists tla_task_idx on task_label_assignments (task_id);
create index if not exists tla_label_idx on task_label_assignments (label_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table task_labels enable row level security;
alter table task_label_assignments enable row level security;

-- Labels: admin full access
create policy "task_labels_admin_full"
  on task_labels for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- Labels: read within own org
create policy "task_labels_read_org"
  on task_labels for select
  using (
    org_id in (select org_id from users where id = auth.uid())
  );

-- Labels: staff can create in own org
create policy "task_labels_staff_insert"
  on task_labels for insert
  with check (
    exists (select 1 from users where id = auth.uid() and role in ('admin', 'am', 'internal'))
  );

-- Label assignments: admin full access
create policy "task_label_assignments_admin_full"
  on task_label_assignments for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- Label assignments: read if you can read the task
create policy "task_label_assignments_read"
  on task_label_assignments for select
  using (
    task_id in (select id from tasks)
  );

-- Label assignments: staff can assign/unassign
create policy "task_label_assignments_staff_insert"
  on task_label_assignments for insert
  with check (
    exists (select 1 from users where id = auth.uid() and role in ('admin', 'am', 'internal'))
  );

create policy "task_label_assignments_staff_delete"
  on task_label_assignments for delete
  using (
    exists (select 1 from users where id = auth.uid() and role in ('admin', 'am', 'internal'))
  );
