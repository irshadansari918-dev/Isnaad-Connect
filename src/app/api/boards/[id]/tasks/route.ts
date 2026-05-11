import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

/**
 * POST /api/boards/:id/tasks — create task on a board
 * PATCH /api/boards/:id/tasks — move task to column/position (drag-and-drop)
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { id: boardId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, description, assignee_id, due_at, column_id } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Get max position in the target column
  const { data: maxPos } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", column_id)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? -1) + 1;

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      assignee_id: assignee_id || user.id,
      creator_id: user.id,
      due_at: due_at || null,
      board_id: boardId,
      column_id,
      position,
      status: "open",
    })
    .select("id, title, column_id, position")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task }, { status: 201 });
}

/**
 * PATCH /api/boards/:id/tasks — move task(s)
 * Body: { task_id, column_id, position }
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  const { id: _boardId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { task_id, column_id, position } = body;

  if (!task_id || column_id === undefined) {
    return NextResponse.json({ error: "task_id and column_id required" }, { status: 400 });
  }

  // Map column to task status
  const { data: column } = await supabase
    .from("task_columns")
    .select("name")
    .eq("id", column_id)
    .single();

  let status: string | undefined;
  if (column) {
    const name = column.name.toLowerCase();
    if (name.includes("done") || name.includes("complete")) status = "done";
    else if (name.includes("progress") || name.includes("doing")) status = "in_progress";
    else if (name.includes("cancel")) status = "cancelled";
    else status = "open";
  }

  const updates: Record<string, unknown> = {
    column_id,
    position: position ?? 0,
    updated_at: new Date().toISOString(),
  };
  if (status) updates.status = status;
  if (status === "done") updates.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", task_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
