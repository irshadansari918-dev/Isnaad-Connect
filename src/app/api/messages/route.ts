import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Parse @mentions and create notifications (fire-and-forget)
  const mentions = messageBody.match(/@(\w+)/g);
  if (mentions && mentions.length > 0) {
    createMentionNotifications(
      mentions.map((m: string) => m.slice(1).toLowerCase()),
      user.id,
      room_id,
      message.id,
      messageBody,
    ).catch((err) => console.error("Mention notification failed:", err));
  }

  // Trigger Sanad AI if message contains @sanad (case-insensitive)
  if (/@sanad\b/i.test(messageBody)) {
    // Fire-and-forget: call agent endpoint asynchronously
    const origin = request.nextUrl.origin;
    fetch(`${origin}/api/agent/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        room_id,
        trigger_message_id: message.id,
      }),
    }).catch((err) => console.error("Agent trigger failed:", err));
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

/**
 * Create notifications for @mentioned users.
 * Matches mention text against user full_name (first name or full name, case-insensitive).
 */
async function createMentionNotifications(
  mentionNames: string[],
  senderId: string,
  roomId: string,
  messageId: string,
  messageBody: string,
) {
  const adminSupabase = createAdminClient();

  // Get room members
  const { data: members } = await adminSupabase
    .from("room_members")
    .select("user_id, users!inner(id, full_name, is_ai)")
    .eq("room_id", roomId);

  if (!members) return;

  type MemberRow = {
    user_id: string;
    users: { id: string; full_name: string; is_ai: boolean };
  };

  // Get sender name for notification title
  const { data: sender } = await adminSupabase
    .from("users")
    .select("full_name")
    .eq("id", senderId)
    .single();

  const { data: room } = await adminSupabase
    .from("rooms")
    .select("name")
    .eq("id", roomId)
    .single();

  const senderName = sender?.full_name ?? "Someone";
  const roomName = room?.name ?? "a room";

  // Match mentions to room members
  const notifications: Array<{
    user_id: string;
    kind: string;
    title: string;
    body: string;
    link: string;
    metadata: Record<string, unknown>;
  }> = [];

  for (const member of members as unknown as MemberRow[]) {
    if (member.users.is_ai || member.user_id === senderId) continue;

    const firstName = member.users.full_name.split(" ")[0].toLowerCase();
    const fullName = member.users.full_name.toLowerCase().replace(/\s+/g, "");

    const isMentioned = mentionNames.some(
      (name) => name === firstName || name === fullName,
    );

    if (isMentioned) {
      notifications.push({
        user_id: member.user_id,
        kind: "mention",
        title: `${senderName} mentioned you in ${roomName}`,
        body:
          messageBody.length > 100
            ? messageBody.slice(0, 100) + "…"
            : messageBody,
        link: `/rooms/${roomId}`,
        metadata: { message_id: messageId, sender_id: senderId },
      });
    }
  }

  if (notifications.length > 0) {
    await adminSupabase.from("notifications").insert(notifications);
  }
}
