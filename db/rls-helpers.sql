-- ============================================================================
-- Isnaad Connect — RLS helper functions
-- Day 1, Task 5. PLAN.md Section 2.5.
--
-- All helpers are SECURITY DEFINER so they can read public.users (which itself
-- has RLS). They are STABLE so PostgreSQL can cache per statement.
-- search_path is pinned to defeat search-path injection.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- current_user_org_id()
--   Returns the org_id of the calling user, or null if not signed in / not in
--   public.users yet.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_org_id()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select org_id from public.users where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- current_user_role()
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns user_role
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select role from public.users where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- is_isnaad_admin()
--   True if caller is an admin in an org of kind 'isnaad'.
-- ---------------------------------------------------------------------------
create or replace function public.is_isnaad_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users u
    join public.organizations o on o.id = u.org_id
    where u.id = auth.uid()
      and u.role = 'admin'
      and o.kind = 'isnaad'
      and u.deactivated_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- is_isnaad_internal()
--   True if caller is any Isnaad staff (admin, am, internal). False for clients.
-- ---------------------------------------------------------------------------
create or replace function public.is_isnaad_internal()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users u
    join public.organizations o on o.id = u.org_id
    where u.id = auth.uid()
      and u.role in ('admin', 'am', 'internal')
      and o.kind = 'isnaad'
      and u.deactivated_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- is_room_member(p_room_id uuid)
-- ---------------------------------------------------------------------------
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and user_id = auth.uid()
  );
$$;

-- Lock helpers down — only authenticated callers
revoke all on function public.current_user_org_id() from public;
revoke all on function public.current_user_role()   from public;
revoke all on function public.is_isnaad_admin()     from public;
revoke all on function public.is_isnaad_internal()  from public;
revoke all on function public.is_room_member(uuid)  from public;

grant execute on function public.current_user_org_id() to authenticated;
grant execute on function public.current_user_role()   to authenticated;
grant execute on function public.is_isnaad_admin()     to authenticated;
grant execute on function public.is_isnaad_internal()  to authenticated;
grant execute on function public.is_room_member(uuid)  to authenticated;
