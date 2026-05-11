import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/agent/confirm
 * Executes a proposed AI action (ticket or task creation) after user confirms.
 * Body: { message_id, action: "confirm" | "cancel" }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { message_id, action } = body;

  if (!message_id || !action) {
    return NextResponse.json(
      { error: "message_id and action required" },
      { status: 400 },
    );
  }

  // Load the AI message with pending action
  const { data: msg, error: msgErr } = await adminSupabase
    .from("messages")
    .select("id, room_id, metadata, kind")
    .eq("id", message_id)
    .eq("kind", "ai")
    .single();

  if (msgErr || !msg) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const metadata = msg.metadata as Record<string, unknown>;
  if (metadata.status !== "pending") {
    return NextResponse.json(
      { error: "Action already processed" },
      { status: 400 },
    );
  }

  if (action === "cancel") {
    // Mark as cancelled
    await adminSupabase
      .from("messages")
      .update({ metadata: { ...metadata, status: "cancelled" } })
      .eq("id", message_id);

    // Post system message
    const sanadUser = await getSanadId(adminSupabase);
    if (sanadUser) {
      await adminSupabase.from("messages").insert({
        room_id: msg.room_id,
        sender_id: sanadUser,
        kind: "system",
        body: "Action cancelled.",
      });
    }

    return NextResponse.json({ status: "cancelled" });
  }

  if (action === "confirm") {
    const actionType = metadata.action_type as string;
    const actionInput = metadata.action_input as Record<string, unknown>;

    try {
      if (actionType === "create_ticket") {
        const result = await createTicket(
          supabase,
          adminSupabase,
          user.id,
          msg.room_id,
          metadata.client_org_id as string | null,
          actionInput,
        );

        // Update message metadata
        await adminSupabase
          .from("messages")
          .update({
            metadata: {
              ...metadata,
              status: "confirmed",
              result_id: result.id,
              result_number: result.ticket_number,
            },
          })
          .eq("id", message_id);

        return NextResponse.json({
          status: "confirmed",
          type: "ticket",
          id: result.id,
          ticket_number: result.ticket_number,
        });
      }

      if (actionType === "create_task") {
        const result = await createTask(
          adminSupabase,
          user.id,
          msg.room_id,
          actionInput,
        );

        await adminSupabase
          .from("messages")
          .update({
            metadata: { ...metadata, status: "confirmed", result_id: result.id },
          })
          .eq("id", message_id);

        return NextResponse.json({
          status: "confirmed",
          type: "task",
          id: result.id,
        });
      }

      if (actionType === "room_summary") {
        // Summary doesn't create anything — just mark confirmed
        await adminSupabase
          .from("messages")
          .update({ metadata: { ...metadata, status: "confirmed" } })
          .eq("id", message_id);

        return NextResponse.json({ status: "confirmed", type: "summary" });
      }

      return NextResponse.json(
        { error: "Unknown action type" },
        { status: 400 },
      );
    } catch (err) {
      console.error("Confirm action error:", err);
      return NextResponse.json(
        { error: "Failed to execute action" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

async function getSanadId(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("is_ai", true)
    .single();
  return data?.id ?? null;
}

async function createTicket(
  userSupabase: Awaited<ReturnType<typeof createClient>>,
  adminSupabase: ReturnType<typeof createAdminClient>,
  userId: string,
  roomId: string,
  clientOrgId: string | null,
  input: Record<string, unknown>,
) {
  // Generate ticket number
  const { data: seqData } = await adminSupabase.rpc("nextval", {
    seq_name: "tickets_number_seq",
  });
  const num = seqData ?? Date.now() % 100000;
  const ticketNumber = `ISC-${String(num).padStart(5, "0")}`;

  const slaHours = (input.sla_hours as number) || 24;
  const slaDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();

  // Determine client_org_id from room if not provided
  let orgId = clientOrgId;
  if (!orgId) {
    const { data: room } = await adminSupabase
      .from("rooms")
      .select("client_org_id")
      .eq("id", roomId)
      .single();
    orgId = room?.client_org_id;
  }

  if (!orgId) {
    // Fallback: get the first client org
    const { data: orgs } = await adminSupabase
      .from("organizations")
      .select("id")
      .eq("kind", "client")
      .limit(1);
    orgId = orgs?.[0]?.id;
  }

  const { data: ticket, error } = await adminSupabase
    .from("tickets")
    .insert({
      ticket_number: ticketNumber,
      title: input.title as string,
      description: (input.description as string) || null,
      client_org_id: orgId,
      creator_id: userId,
      room_id: roomId,
      sla_due_at: slaDueAt,
    })
    .select("id, ticket_number")
    .single();

  if (error) throw error;

  // Post system message in room
  const sanadId = await getSanadId(adminSupabase);
  if (sanadId) {
    await adminSupabase.from("messages").insert({
      room_id: roomId,
      sender_id: sanadId,
      kind: "system",
      body: `Ticket ${ticket.ticket_number} created: "${input.title}"`,
    });
  }

  return ticket;
}

async function createTask(
  adminSupabase: ReturnType<typeof createAdminClient>,
  userId: string,
  roomId: string,
  input: Record<string, unknown>,
) {
  const dueDays = (input.due_days as number) || 3;
  const dueAt = new Date(
    Date.now() + dueDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: task, error } = await adminSupabase
    .from("tasks")
    .insert({
      title: input.title as string,
      description: (input.description as string) || null,
      assignee_id: userId,
      creator_id: userId,
      room_id: roomId,
      due_at: dueAt,
    })
    .select("id")
    .single();

  if (error) throw error;

  // Post system message
  const sanadId = await getSanadId(adminSupabase);
  if (sanadId) {
    await adminSupabase.from("messages").insert({
      room_id: roomId,
      sender_id: sanadId,
      kind: "system",
      body: `Task created: "${input.title}"`,
    });
  }

  return task;
}
