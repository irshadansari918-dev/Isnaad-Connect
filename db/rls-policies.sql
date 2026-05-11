-- ============================================================================
-- Isnaad Connect — RLS policies
-- Day 1, Task 6. PLAN.md Section 2.5, 8.1.
--
-- Rule summary:
--   - admin               → can read everything, write everything
--   - am / internal       → can read all orgs; can read messages only in rooms
--                           they are a member of
--   - client              → can read only data scoped to their org / their rooms
--   - service_role        → bypasses RLS automatically (system ops, seeds, tests)
--
-- Pattern: one SELECT policy per role-class per table, plus narrow write
-- policies. No policy = denied (default deny when RLS enabled).
-- ============================================================================

-- Defensive drop-all so re-running is idempotent. We re-create everything.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'organizations','users','rooms','room_members',
        'messages','tasks','tickets','events'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;


-- ===========================================================================
-- organizations
-- ===========================================================================

-- Admin: read all
create policy organizations_admin_read on organizations
  for select to authenticated
  using (public.is_isnaad_admin());

-- Internal staff: read all
create policy organizations_internal_read on organizations
  for select to authenticated
  using (public.is_isnaad_internal());

-- Client: read only own org
create policy organizations_client_read_own on organizations
  for select to authenticated
  using (id = public.current_user_org_id());

-- Writes: admin only
create policy organizations_admin_write on organizations
  for all to authenticated
  using (public.is_isnaad_admin())
  with check (public.is_isnaad_admin());


-- ===========================================================================
-- users
-- ===========================================================================

-- Anyone authenticated: read self (needed before helper functions resolve)
create policy users_read_self on users
  for select to authenticated
  using (id = auth.uid());

-- Admin: read all
create policy users_admin_read on users
  for select to authenticated
  using (public.is_isnaad_admin());

-- Internal staff: read all
create policy users_internal_read on users
  for select to authenticated
  using (public.is_isnaad_internal());

-- Client: read only users in same org
create policy users_client_read_same_org on users
  for select to authenticated
  using (org_id = public.current_user_org_id());

-- Writes: admin only
create policy users_admin_write on users
  for all to authenticated
  using (public.is_isnaad_admin())
  with check (public.is_isnaad_admin());


-- ===========================================================================
-- rooms
-- ===========================================================================

-- Admin: read all
create policy rooms_admin_read on rooms
  for select to authenticated
  using (public.is_isnaad_admin());

-- Internal staff: read all rooms (metadata).
create policy rooms_internal_read on rooms
  for select to authenticated
  using (public.is_isnaad_internal());

-- Client: read rooms they are a member of (typically their one client room)
create policy rooms_client_read_member on rooms
  for select to authenticated
  using (public.is_room_member(id));

-- Writes: admin only
create policy rooms_admin_write on rooms
  for all to authenticated
  using (public.is_isnaad_admin())
  with check (public.is_isnaad_admin());


-- ===========================================================================
-- room_members
-- ===========================================================================

-- Admin: read all
create policy room_members_admin_read on room_members
  for select to authenticated
  using (public.is_isnaad_admin());

-- Internal staff: read all
create policy room_members_internal_read on room_members
  for select to authenticated
  using (public.is_isnaad_internal());

-- Client: read members of rooms they themselves are members of
create policy room_members_client_read_peers on room_members
  for select to authenticated
  using (public.is_room_member(room_id));

-- Writes: admin only (for v1; AMs can be granted later)
create policy room_members_admin_write on room_members
  for all to authenticated
  using (public.is_isnaad_admin())
  with check (public.is_isnaad_admin());

-- Self: a member can update their own last_read_message_id
create policy room_members_self_update_read_marker on room_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ===========================================================================
-- messages
-- ===========================================================================

-- Admin: read all
create policy messages_admin_read on messages
  for select to authenticated
  using (public.is_isnaad_admin());

-- Everyone else (internal staff + client): read only if room member
create policy messages_member_read on messages
  for select to authenticated
  using (public.is_room_member(room_id));

-- Insert: must be room member AND must be sending as self
create policy messages_member_insert on messages
  for insert to authenticated
  with check (
    public.is_room_member(room_id)
    and sender_id = auth.uid()
  );

-- Update / delete: not allowed in v1 (Phase 2 adds edit/delete).
-- Service role bypasses, system ops still possible.


-- ===========================================================================
-- tasks
-- ===========================================================================

-- Admin: read all
create policy tasks_admin_read on tasks
  for select to authenticated
  using (public.is_isnaad_admin());

-- Internal staff: read all
create policy tasks_internal_read on tasks
  for select to authenticated
  using (public.is_isnaad_internal());

-- Client: read tasks scoped to their org OR tasks where they are the assignee
create policy tasks_client_read_own on tasks
  for select to authenticated
  using (
    client_org_id = public.current_user_org_id()
    or assignee_id = auth.uid()
  );

-- Insert: any Isnaad staff (admin/am/internal); clients cannot create tasks directly
create policy tasks_internal_insert on tasks
  for insert to authenticated
  with check (
    public.is_isnaad_internal()
    and creator_id = auth.uid()
  );

-- Update: internal staff freely; assignee can update status of their own
create policy tasks_internal_update on tasks
  for update to authenticated
  using (public.is_isnaad_internal())
  with check (public.is_isnaad_internal());

create policy tasks_assignee_update_status on tasks
  for update to authenticated
  using (assignee_id = auth.uid())
  with check (assignee_id = auth.uid());

-- Delete: admin only
create policy tasks_admin_delete on tasks
  for delete to authenticated
  using (public.is_isnaad_admin());


-- ===========================================================================
-- tickets
-- ===========================================================================

-- Admin: read all
create policy tickets_admin_read on tickets
  for select to authenticated
  using (public.is_isnaad_admin());

-- Internal staff: read all
create policy tickets_internal_read on tickets
  for select to authenticated
  using (public.is_isnaad_internal());

-- Client: read tickets scoped to their org
create policy tickets_client_read_own on tickets
  for select to authenticated
  using (client_org_id = public.current_user_org_id());

-- Insert: client on own org; internal staff on any org
create policy tickets_client_insert_own on tickets
  for insert to authenticated
  with check (
    client_org_id = public.current_user_org_id()
    and creator_id = auth.uid()
  );

create policy tickets_internal_insert on tickets
  for insert to authenticated
  with check (
    public.is_isnaad_internal()
    and creator_id = auth.uid()
  );

-- Update: internal staff fully; clients only on their own org tickets
create policy tickets_internal_update on tickets
  for update to authenticated
  using (public.is_isnaad_internal())
  with check (public.is_isnaad_internal());

create policy tickets_client_update_own on tickets
  for update to authenticated
  using (client_org_id = public.current_user_org_id())
  with check (client_org_id = public.current_user_org_id());

-- Delete: admin only
create policy tickets_admin_delete on tickets
  for delete to authenticated
  using (public.is_isnaad_admin());


-- ===========================================================================
-- events (audit log)
-- ===========================================================================

-- Read: admin + internal staff only. Clients do not see audit log.
create policy events_admin_read on events
  for select to authenticated
  using (public.is_isnaad_admin());

create policy events_internal_read on events
  for select to authenticated
  using (public.is_isnaad_internal());

-- No INSERT/UPDATE/DELETE policies — events is append-only via SECURITY DEFINER
-- trigger functions. Direct writes are denied (no policy = no access).
