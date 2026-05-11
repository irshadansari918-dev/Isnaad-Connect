import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/rooms/:id/receipts
 * Returns read receipts for all members of a room.
 * Each member's last_read_message_id and full_name.
 */
export async function GET(request: NextRequest, { params }: Props) {
  const { id: roomId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: members, error } = await supabase
    .from("room_members")
    .select(
      "user_id, last_read_message_id, users!inner(full_name, role, is_ai)",
    )
    .eq("room_id", roomId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load receipts" },
      { status: 403 },
    );
  }

  type MemberRow = {
    user_id: string;
    last_read_message_id: string | null;
    users: { full_name: string; role: string; is_ai: boolean };
  };

  const receipts = ((members as unknown as MemberRow[]) ?? [])
    .filter((m) => !m.users.is_ai && m.user_id !== user.id)
    .map((m) => ({
      user_id: m.user_id,
      full_name: m.users.full_name,
      role: m.users.role,
      last_read_message_id: m.last_read_message_id,
    }));

  return NextResponse.json({ receipts });
}
