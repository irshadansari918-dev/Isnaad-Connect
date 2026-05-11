import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

/**
 * POST /api/boards/:id/columns — add column to board
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { id: boardId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, color } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Get max position
  const { data: maxPos } = await supabase
    .from("task_columns")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? -1) + 1;

  const { data: column, error } = await supabase
    .from("task_columns")
    .insert({
      board_id: boardId,
      name: name.trim(),
      position,
      color: color || "#94A3B8",
    })
    .select("id, name, position, color")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ column }, { status: 201 });
}
