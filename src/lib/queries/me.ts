import { createClient } from "@/lib/supabase/server";

export type Me = {
  authId: string;
  email: string;
  fullName: string;
  role: "admin" | "am" | "internal" | "client";
  orgId: string;
  orgName: string;
  orgKind: "isnaad" | "client";
  isAi: boolean;
};

/**
 * Resolve the signed-in user's profile row and org. Returns null if not signed in
 * or not yet provisioned in public.users (e.g. brand-new auth user with no profile).
 */
export async function getMe(): Promise<Me | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select(
      "id, email, full_name, role, is_ai, org_id, organizations!inner(id, name, kind)",
    )
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  type Row = {
    id: string;
    email: string;
    full_name: string;
    role: Me["role"];
    is_ai: boolean;
    org_id: string;
    organizations: { id: string; name: string; kind: Me["orgKind"] };
  };
  const row = data as unknown as Row;

  return {
    authId: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    orgId: row.org_id,
    orgName: row.organizations.name,
    orgKind: row.organizations.kind,
    isAi: row.is_ai,
  };
}

export type RoomListItem = {
  id: string;
  name: string;
  kind: "client" | "internal" | "dm";
  clientOrgId: string | null;
};

/**
 * Rooms visible to the current user under RLS.
 * - Clients see only rooms they are members of.
 * - Internal staff + admin see all non-archived rooms.
 */
export async function listMyRooms(): Promise<RoomListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, kind, client_org_id, archived_at")
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    clientOrgId: r.client_org_id,
  }));
}
