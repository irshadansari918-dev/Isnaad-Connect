import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/queries/me";

export async function GET(request: NextRequest) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientOrgId = searchParams.get("client_org_id");

  let query = supabase
    .from("tickets")
    .select(
      "id, ticket_number, title, description, status, sla_due_at, sla_breached, created_at, resolved_at, room_id, client_org_id, assigned_am_id, creator_id, organizations!inner(name), am:users!tickets_assigned_am_id_fkey(full_name), creator:users!tickets_creator_id_fkey(full_name)",
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (clientOrgId) query = query.eq("client_org_id", clientOrgId);

  // Clients see only their org's tickets (RLS handles this)
  const { data, error } = await query.limit(100);
  if (error) return NextResponse.json({ error: "Failed to load tickets" }, { status: 500 });

  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(request: NextRequest) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, description, client_org_id, assigned_am_id, room_id, sla_hours } = body;

  if (!title || typeof title !== "string" || title.trim().length < 2) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!client_org_id) {
    return NextResponse.json({ error: "client_org_id is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Generate ticket number ISN-NNNNN
  const { data: seqData } = await supabase.rpc("nextval", { seq_name: "tickets_number_seq" }).single();
  const seqNum = typeof seqData === "number" ? seqData : Date.now() % 100000;
  const ticketNumber = `ISC-${String(seqNum).padStart(5, "0")}`;

  // SLA: default 24 hours if not specified
  const hours = Math.min(Math.max(Number(sla_hours) || 24, 1), 720);
  const slaDueAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      ticket_number: ticketNumber,
      title: title.trim(),
      description: description?.trim() || null,
      client_org_id,
      assigned_am_id: assigned_am_id || null,
      creator_id: me.authId,
      room_id: room_id || null,
      sla_due_at: slaDueAt,
    })
    .select("id, ticket_number, title, status, sla_due_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 422 });
  }

  // Post system message if created from a room
  if (room_id) {
    await supabase.from("messages").insert({
      room_id,
      sender_id: me.authId,
      kind: "system",
      body: `Ticket ${ticketNumber} created: "${title.trim()}"`,
      metadata: { ticket_id: data.id, ticket_number: ticketNumber },
    });
  }

  return NextResponse.json({ ticket: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, status, assigned_am_id, title } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const validStatuses = ["open", "in_progress", "pending_client", "resolved", "closed"];

  const supabase = await createClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (status && validStatuses.includes(status)) {
    // Clients can only set pending_client → resolved
    if (me.role === "client" && !["resolved"].includes(status)) {
      return NextResponse.json({ error: "Clients can only resolve tickets" }, { status: 403 });
    }
    updates.status = status;
    if (status === "resolved" || status === "closed") {
      updates.resolved_at = new Date().toISOString();
    }
  }
  if (assigned_am_id !== undefined) updates.assigned_am_id = assigned_am_id || null;
  if (title) updates.title = title.trim();

  const { error } = await supabase.from("tickets").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 422 });

  return NextResponse.json({ ok: true });
}
