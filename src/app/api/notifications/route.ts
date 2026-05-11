import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/notifications?unread_only=true&limit=50
 * Returns notifications for the current user.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread_only") === "true";
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

  let query = supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, metadata, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }

  // Also get unread count
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return NextResponse.json({
    notifications: data ?? [],
    unread_count: count ?? 0,
  });
}

/**
 * PATCH /api/notifications
 * Mark notifications as read.
 * Body: { ids: string[] } or { all: true }
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.all === true) {
    // Mark all as read
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);

    return NextResponse.json({ status: "ok" });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .in("id", body.ids);

    return NextResponse.json({ status: "ok" });
  }

  return NextResponse.json({ error: "ids or all required" }, { status: 400 });
}
