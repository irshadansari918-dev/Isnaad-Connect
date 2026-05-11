import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/rooms/[id]/read
 * Body: { message_id: string }
 *
 * Updates room_members.last_read_message_id for the current user.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: roomId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const messageId = body.message_id;
  if (!messageId || typeof messageId !== "string") {
    return NextResponse.json({ error: "message_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("room_members")
    .update({ last_read_message_id: messageId })
    .eq("room_id", roomId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update read status" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
