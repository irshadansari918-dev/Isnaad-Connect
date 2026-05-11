import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

/**
 * GET /api/tasks/:id/labels — list labels for a task
 * POST /api/tasks/:id/labels — toggle label on task
 */
export async function GET(_request: NextRequest, { params }: Props) {
  const { id: taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("task_label_assignments")
    .select("label_id, task_labels!inner(id, name, color)")
    .eq("task_id", taskId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = { label_id: string; task_labels: { id: string; name: string; color: string } };
  const labels = ((data as unknown as Row[]) ?? []).map((r) => r.task_labels);

  return NextResponse.json({ labels });
}

export async function POST(request: NextRequest, { params }: Props) {
  const { id: taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { label_id } = await request.json();
  if (!label_id) return NextResponse.json({ error: "label_id required" }, { status: 400 });

  // Toggle: check if exists
  const { data: existing } = await supabase
    .from("task_label_assignments")
    .select("id")
    .eq("task_id", taskId)
    .eq("label_id", label_id)
    .single();

  if (existing) {
    await supabase.from("task_label_assignments").delete().eq("id", existing.id);
    return NextResponse.json({ action: "removed" });
  }

  const { error } = await supabase
    .from("task_label_assignments")
    .insert({ task_id: taskId, label_id });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ action: "added" }, { status: 201 });
}
