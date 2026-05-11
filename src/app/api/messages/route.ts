import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { room_id, body: messageBody, kind = "text" } = body;

  if (!room_id || typeof room_id !== "string") {
    return NextResponse.json({ error: "room_id is required" }, { status: 400 });
  }
  if (!messageBody || typeof messageBody !== "string" || messageBody.trim().length === 0) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  if (messageBody.length > 10000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  // RLS ensures the user can only insert into rooms they are a member of.
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      room_id,
      sender_id: user.id,
      kind,
      body: messageBody.trim(),
    })
    .select("id, room_id, sender_id, kind, body, metadata, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 403 },
    );
  }

  return NextResponse.json({ message }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("room_id");
  const before = searchParams.get("before"); // cursor for pagination
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

  if (!roomId) {
    return NextResponse.json({ error: "room_id is required" }, { status: 400 });
  }

  let query = supabase
    .from("messages")
    .select(
      "id, room_id, sender_id, kind, body, metadata, created_at, users!inner(id, full_name, role, is_ai)",
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to load messages" }, { status: 403 });
  }

  // Reverse to chronological order for display
  const messages = (data ?? []).reverse();

  return NextResponse.json({ messages, hasMore: data?.length === limit });
}
