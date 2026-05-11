import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/messages/:id
 * Edit a message body. Only the sender can edit their own messages.
 * Body: { body: "new text" }
 */
export async function PATCH(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const newBody = body.body?.trim();

  if (!newBody || typeof newBody !== "string") {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  // Verify ownership
  const { data: msg } = await supabase
    .from("messages")
    .select("id, sender_id, kind")
    .eq("id", id)
    .single();

  if (!msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  if (msg.sender_id !== user.id) {
    return NextResponse.json({ error: "Can only edit own messages" }, { status: 403 });
  }

  if (msg.kind !== "text") {
    return NextResponse.json({ error: "Can only edit text messages" }, { status: 400 });
  }

  const { error } = await supabase
    .from("messages")
    .update({
      body: newBody,
      edited_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to edit" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}

/**
 * DELETE /api/messages/:id
 * Soft-delete a message. Only the sender or an admin can delete.
 */
export async function DELETE(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user role
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  // Verify ownership or admin
  const { data: msg } = await supabase
    .from("messages")
    .select("id, sender_id")
    .eq("id", id)
    .single();

  if (!msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  if (msg.sender_id !== user.id && profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Can only delete own messages" },
      { status: 403 },
    );
  }

  const { error } = await supabase
    .from("messages")
    .update({
      deleted_at: new Date().toISOString(),
      body: null,
      metadata: {},
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
