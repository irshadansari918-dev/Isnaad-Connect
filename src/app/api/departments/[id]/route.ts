import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

/**
 * GET /api/departments/:id — department detail with members
 * PATCH /api/departments/:id — update department (admin only)
 * DELETE /api/departments/:id — archive department (admin only)
 */
export async function GET(_request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: dept, error } = await supabase
    .from("departments")
    .select(`
      id, name, slug, color, description, head_id, room_id, org_id, created_at,
      department_members(user_id, is_head, users!inner(id, full_name, email, role))
    `)
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error || !dept) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  type MemberRow = {
    user_id: string;
    is_head: boolean;
    users: { id: string; full_name: string; email: string; role: string };
  };

  return NextResponse.json({
    department: {
      ...dept,
      members: ((dept.department_members as unknown as MemberRow[]) ?? []).map((m) => ({
        userId: m.user_id,
        isHead: m.is_head,
        fullName: m.users.full_name,
        email: m.users.email,
        role: m.users.role,
      })),
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.color !== undefined) updates.color = body.color;
  if (body.head_id !== undefined) updates.head_id = body.head_id || null;

  const { data: dept, error } = await supabase
    .from("departments")
    .update(updates)
    .eq("id", id)
    .select("id, name, slug, color")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ department: dept });
}

export async function DELETE(_request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Soft-archive
  const { error } = await supabase
    .from("departments")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
