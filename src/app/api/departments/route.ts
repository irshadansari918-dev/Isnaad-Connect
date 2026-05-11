import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/departments — list departments (admin sees all, others see own org)
 * POST /api/departments — create department (admin only)
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("departments")
    .select(`
      id, name, slug, color, description, head_id, room_id, archived_at, created_at,
      organizations!inner(id, name),
      department_members(user_id)
    `)
    .is("archived_at", null)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    id: string;
    name: string;
    slug: string;
    color: string;
    description: string | null;
    head_id: string | null;
    room_id: string | null;
    archived_at: string | null;
    created_at: string;
    organizations: { id: string; name: string };
    department_members: { user_id: string }[];
  };

  const departments = ((data as unknown as Row[]) ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    color: d.color,
    description: d.description,
    headId: d.head_id,
    roomId: d.room_id,
    orgId: d.organizations.id,
    orgName: d.organizations.name,
    memberCount: d.department_members?.length ?? 0,
    createdAt: d.created_at,
  }));

  return NextResponse.json({ departments });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Admin only
  const { data: profile } = await supabase
    .from("users")
    .select("role, org_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, color, head_id, org_id } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Generate slug from name
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const targetOrgId = org_id || profile.org_id;

  const { data: dept, error } = await supabase
    .from("departments")
    .insert({
      org_id: targetOrgId,
      name: name.trim(),
      slug,
      color: color || "#3B82F6",
      description: description?.trim() || null,
      head_id: head_id || null,
    })
    .select("id, name, slug, room_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If head_id provided, add as member with is_head=true
  if (head_id) {
    await supabase
      .from("department_members")
      .insert({ department_id: dept.id, user_id: head_id, is_head: true })
      .single();
  }

  return NextResponse.json({ department: dept }, { status: 201 });
}
