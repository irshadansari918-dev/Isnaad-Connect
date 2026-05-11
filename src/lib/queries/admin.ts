import { createClient } from "@/lib/supabase/server";

export type OrgRow = {
  id: string;
  kind: "isnaad" | "client";
  name: string;
  portalOrgId: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "am" | "internal" | "client";
  orgId: string;
  orgName: string;
  isAi: boolean;
  deactivatedAt: string | null;
  createdAt: string;
};

export type RoomRow = {
  id: string;
  kind: "client" | "internal" | "dm";
  name: string;
  clientOrgId: string | null;
  clientOrgName: string | null;
  archivedAt: string | null;
  memberCount: number;
  createdAt: string;
};

export async function listOrganizations(): Promise<OrgRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, kind, name, portal_org_id, archived_at, created_at")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((o) => ({
    id: o.id,
    kind: o.kind,
    name: o.name,
    portalOrgId: o.portal_org_id,
    archivedAt: o.archived_at,
    createdAt: o.created_at,
  }));
}

export async function listUsers(): Promise<UserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, email, full_name, role, org_id, is_ai, deactivated_at, created_at, organizations!inner(name)",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  type Row = {
    id: string;
    email: string;
    full_name: string;
    role: UserRow["role"];
    org_id: string;
    is_ai: boolean;
    deactivated_at: string | null;
    created_at: string;
    organizations: { name: string };
  };

  return (data as unknown as Row[]).map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    orgId: u.org_id,
    orgName: u.organizations.name,
    isAi: u.is_ai,
    deactivatedAt: u.deactivated_at,
    createdAt: u.created_at,
  }));
}

export async function listRooms(): Promise<RoomRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .select(
      "id, kind, name, client_org_id, archived_at, created_at, organizations(name), room_members(id)",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  type Row = {
    id: string;
    kind: RoomRow["kind"];
    name: string;
    client_org_id: string | null;
    archived_at: string | null;
    created_at: string;
    organizations: { name: string } | null;
    room_members: { id: string }[];
  };

  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    clientOrgId: r.client_org_id,
    clientOrgName: r.organizations?.name ?? null,
    archivedAt: r.archived_at,
    memberCount: r.room_members?.length ?? 0,
    createdAt: r.created_at,
  }));
}
