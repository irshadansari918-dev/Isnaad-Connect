import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

/**
 * GET /api/boards/:id — board detail with columns and tasks
 * PATCH /api/boards/:id — update board name
 * DELETE /api/boards/:id — archive board
 */
export async function GET(_request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: board, error } = await supabase
    .from("task_boards")
    .select(`
      id, name, department_id, org_id, created_at,
      departments(name, color),
      task_columns(id, name, position, color)
    `)
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error || !board) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Load tasks for this board
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, description, status, due_at, assignee_id, column_id, position, created_at, users!tasks_assignee_id_fkey(full_name)")
    .eq("board_id", id)
    .order("position");

  // Sort columns by position
  const columns = ((board.task_columns as { id: string; name: string; position: number; color: string }[]) ?? [])
    .sort((a, b) => a.position - b.position);

  return NextResponse.json({
    board: { ...board, task_columns: columns },
    tasks: tasks ?? [],
  });
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name.trim();

  const { error } = await supabase.from("task_boards").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("task_boards")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
