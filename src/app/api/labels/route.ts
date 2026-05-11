import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/labels — list labels for the user's org
 * POST /api/labels — create a label (staff only)
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("task_labels")
    .select("id, name, color, org_id, created_at")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ labels: data ?? [] });
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
  const { name, color } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data: label, error } = await supabase
    .from("task_labels")
    .insert({
      org_id: profile.org_id,
      name: name.trim(),
      color: color || "#94A3B8",
    })
    .select("id, name, color")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Label already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ label }, { status: 201 });
}
