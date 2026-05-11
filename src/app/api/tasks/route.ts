import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/queries/me";

export async function GET(request: NextRequest) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "mine"; // mine | all | overdue | room
  const roomId = searchParams.get("room_id");

  let query = supabase
    .from("tasks")
    .select(
      "id, title, description, status, due_at, completed_at, created_at, room_id, source_message_id, assignee_id, creator_id, users!tasks_assignee_id_fkey(full_name), creator:users!tasks_creator_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false });

  if (filter === "mine") {
    query = query.eq("assignee_id", me.authId);
  } else if (filter === "overdue") {
    query = query
      .lt("due_at", new Date().toISOString())
      .neq("status", "done")
      .neq("status", "cancelled");
  } else if (filter === "room" && roomId) {
    query = query.eq("room_id", roomId);
  }

  const { data, error } = await query.limit(100);
  if (error) return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });

  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(request: NextRequest) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, description, assignee_id, due_at, room_id, source_message_id, client_org_id } = body;

  if (!title || typeof title !== "string" || title.trim().length < 2) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      assignee_id: assignee_id || null,
      creator_id: me.authId,
      due_at: due_at || null,
      room_id: room_id || null,
      source_message_id: source_message_id || null,
      client_org_id: client_org_id || null,
    })
    .select("id, title, status, created_at")
    .single();

  if (error) return NextResponse.json({ error: "Failed to create task" }, { status: 422 });

  // If created from a message, post a system message
  if (source_message_id && room_id) {
    await supabase.from("messages").insert({
      room_id,
      sender_id: me.authId,
      kind: "system",
      body: `Task created: "${title.trim()}"`,
      metadata: { task_id: data.id, source_message_id },
    });
  }

  return NextResponse.json({ task: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, status, assignee_id, title, due_at } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (status && ["open", "in_progress", "done", "cancelled"].includes(status)) {
    updates.status = status;
    if (status === "done") updates.completed_at = new Date().toISOString();
    if (status !== "done") updates.completed_at = null;
  }
  if (assignee_id !== undefined) updates.assignee_id = assignee_id || null;
  if (title) updates.title = title.trim();
  if (due_at !== undefined) updates.due_at = due_at || null;

  const { error } = await supabase.from("tasks").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 422 });

  return NextResponse.json({ ok: true });
}
