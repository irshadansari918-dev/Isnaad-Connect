import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_EMOJI = ["👍", "❤️", "✅", "👀", "🎉", "🤔"];

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/messages/:id/reactions
 * Returns reaction counts + user's own reactions for a message.
 */
export async function GET(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: reactions } = await supabase
    .from("message_reactions")
    .select("emoji, user_id")
    .eq("message_id", id);

  // Aggregate: { emoji: { count, reacted } }
  const counts: Record<string, { count: number; reacted: boolean }> = {};
  for (const r of reactions ?? []) {
    if (!counts[r.emoji]) counts[r.emoji] = { count: 0, reacted: false };
    counts[r.emoji].count++;
    if (r.user_id === user.id) counts[r.emoji].reacted = true;
  }

  return NextResponse.json({ reactions: counts });
}

/**
 * POST /api/messages/:id/reactions
 * Toggle a reaction on a message.
 * Body: { emoji: "👍" }
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { emoji } = body;

  if (!ALLOWED_EMOJI.includes(emoji)) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  // Check if reaction already exists
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", id)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .single();

  if (existing) {
    // Remove reaction (toggle off)
    await supabase
      .from("message_reactions")
      .delete()
      .eq("id", existing.id);

    return NextResponse.json({ action: "removed" });
  }

  // Add reaction
  const { error } = await supabase
    .from("message_reactions")
    .insert({
      message_id: id,
      user_id: user.id,
      emoji,
    });

  if (error) {
    return NextResponse.json({ error: "Failed to add reaction" }, { status: 403 });
  }

  return NextResponse.json({ action: "added" });
}
