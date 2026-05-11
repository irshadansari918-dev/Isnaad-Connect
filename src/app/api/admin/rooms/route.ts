import { NextRequest, NextResponse } from "next/server";
import { getMe } from "@/lib/queries/me";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/rooms — Create a new room (admin only)
 * Body: { name, kind, client_org_id?, member_ids: string[] }
 */
export async function POST(request: NextRequest) {
  const me = await getMe();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, kind, client_org_id, member_ids } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Name is required (min 2 chars)" }, { status: 400 });
  }
  if (!["client", "internal", "dm"].includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (kind === "client" && !client_org_id) {
    return NextResponse.json({ error: "client_org_id required for client rooms" }, { status: 400 });
  }

  const supabase = await createClient();

  // Create room
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      name: name.trim(),
      kind,
      client_org_id: kind === "client" ? client_org_id : null,
    })
    .select("id, name, kind")
    .single();

  if (roomError) {
    return NextResponse.json({ error: "Failed to create room" }, { status: 422 });
  }

  // Add members
  if (Array.isArray(member_ids) && member_ids.length > 0) {
    const memberships = member_ids.map((userId: string) => ({
      room_id: room.id,
      user_id: userId,
    }));

    const { error: memberError } = await supabase
      .from("room_members")
      .insert(memberships);

    if (memberError) {
      // Room created but members failed — still return the room
      return NextResponse.json(
        { room, warning: "Room created but some members could not be added" },
        { status: 201 },
      );
    }
  }

  return NextResponse.json({ room }, { status: 201 });
}

/**
 * PATCH /api/admin/rooms — Add/remove members or archive (admin only)
 * Body: { id, action: "add_member" | "remove_member" | "archive" | "restore", user_id? }
 */
export async function PATCH(request: NextRequest) {
  const me = await getMe();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id, action, user_id } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = await createClient();

  if (action === "add_member") {
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });
    const { error } = await supabase
      .from("room_members")
      .insert({ room_id: id, user_id });
    if (error) {
      const msg = error.message.includes("unique") ? "Already a member" : "Failed to add";
      return NextResponse.json({ error: msg }, { status: 422 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "remove_member") {
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });
    const { error } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", id)
      .eq("user_id", user_id);
    if (error) return NextResponse.json({ error: "Failed to remove" }, { status: 422 });
    return NextResponse.json({ ok: true });
  }

  if (action === "archive") {
    const { error } = await supabase
      .from("rooms")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to archive" }, { status: 422 });
    return NextResponse.json({ ok: true });
  }

  if (action === "restore") {
    const { error } = await supabase
      .from("rooms")
      .update({ archived_at: null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to restore" }, { status: 422 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
