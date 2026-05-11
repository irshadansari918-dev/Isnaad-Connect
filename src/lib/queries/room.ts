import { createClient } from "@/lib/supabase/server";

export type RoomDetail = {
  id: string;
  name: string;
  kind: "client" | "internal" | "dm";
  clientOrgId: string | null;
  members: RoomMember[];
};

export type RoomMember = {
  userId: string;
  fullName: string;
  role: "admin" | "am" | "internal" | "client";
  isAi: boolean;
  isAssignedAm: boolean;
};

export type MessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  kind: "text" | "image" | "system" | "ai";
  body: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  reply_to_id?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  sender: {
    id: string;
    full_name: string;
    role: string;
    is_ai: boolean;
  };
};

/**
 * Load room details + members. Returns null if room not found or user has no access.
 */
export async function getRoom(roomId: string): Promise<RoomDetail | null> {
  const supabase = await createClient();

  const { data: room, error } = await supabase
    .from("rooms")
    .select("id, name, kind, client_org_id")
    .eq("id", roomId)
    .is("archived_at", null)
    .single();

  if (error || !room) return null;

  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, is_assigned_am, users!inner(id, full_name, role, is_ai)")
    .eq("room_id", roomId);

  type MemberRow = {
    user_id: string;
    is_assigned_am: boolean;
    users: { id: string; full_name: string; role: string; is_ai: boolean };
  };

  return {
    id: room.id,
    name: room.name,
    kind: room.kind,
    clientOrgId: room.client_org_id,
    members: (members as unknown as MemberRow[] | null)?.map((m) => ({
      userId: m.user_id,
      fullName: m.users.full_name,
      role: m.users.role as RoomMember["role"],
      isAi: m.users.is_ai,
      isAssignedAm: m.is_assigned_am,
    })) ?? [],
  };
}

/**
 * Load initial messages for a room (most recent N, chronological order).
 */
export async function getInitialMessages(
  roomId: string,
  limit = 50,
): Promise<MessageRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, room_id, sender_id, kind, body, metadata, created_at, reply_to_id, edited_at, deleted_at, users!inner(id, full_name, role, is_ai)",
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  type RawRow = {
    id: string;
    room_id: string;
    sender_id: string;
    kind: MessageRow["kind"];
    body: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    reply_to_id: string | null;
    edited_at: string | null;
    deleted_at: string | null;
    users: { id: string; full_name: string; role: string; is_ai: boolean };
  };

  return (data as unknown as RawRow[])
    .reverse()
    .map((row) => ({
      id: row.id,
      room_id: row.room_id,
      sender_id: row.sender_id,
      kind: row.kind,
      body: row.body,
      metadata: row.metadata,
      created_at: row.created_at,
      reply_to_id: row.reply_to_id,
      edited_at: row.edited_at,
      deleted_at: row.deleted_at,
      sender: {
        id: row.users.id,
        full_name: row.users.full_name,
        role: row.users.role,
        is_ai: row.users.is_ai,
      },
    }));
}
