import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/boards — list task boards
 * POST /api/boards — create board
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("task_boards")
    .select(`
      id, name, department_id, org_id, archived_at, created_at,
      departments(name, color),
      task_columns(id, name, position, color)
    `)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ boards: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("role, org_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "am", "internal"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, department_id } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data: board, error } = await supabase
    .from("task_boards")
    .insert({
      name: name.trim(),
      department_id: department_id || null,
      org_id: profile.org_id,
      created_by: user.id,
    })
    .select("id, name, department_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Re-fetch with columns (created by trigger)
  const { data: full } = await supabase
    .from("task_boards")
    .select("id, name, department_id, task_columns(id, name, position, color)")
    .eq("id", board.id)
    .single();

  return NextResponse.json({ board: full }, { status: 201 });
}
