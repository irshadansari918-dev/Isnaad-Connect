import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/search?q=<query>&type=all|messages|tasks|tickets&limit=20
 * Full-text search across messages, tasks, and tickets.
 * Results are RLS-scoped — users only see what they have access to.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const type = searchParams.get("type") ?? "all";
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 },
    );
  }

  // Convert to tsquery format: split words and join with &
  const tsquery = query
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w}:*`)
    .join(" & ");

  const results: {
    messages: SearchMessage[];
    tasks: SearchTask[];
    tickets: SearchTicket[];
  } = {
    messages: [],
    tasks: [],
    tickets: [],
  };

  // Search messages
  if (type === "all" || type === "messages") {
    const { data } = await supabase
      .from("messages")
      .select(
        "id, room_id, body, kind, created_at, users!inner(full_name), rooms!inner(name)",
      )
      .textSearch("search_vector", tsquery)
      .in("kind", ["text", "ai"])
      .order("created_at", { ascending: false })
      .limit(limit);

    results.messages = ((data as unknown as RawMessage[]) ?? []).map((m) => ({
      id: m.id,
      room_id: m.room_id,
      body: m.body,
      sender_name: m.users?.full_name ?? "",
      room_name: m.rooms?.name ?? "",
      created_at: m.created_at,
    }));
  }

  // Search tasks
  if (type === "all" || type === "tasks") {
    const { data } = await supabase
      .from("tasks")
      .select(
        "id, title, description, status, due_at, created_at, users!tasks_assignee_id_fkey(full_name)",
      )
      .textSearch("search_vector", tsquery)
      .order("created_at", { ascending: false })
      .limit(limit);

    results.tasks = ((data as unknown as RawTask[]) ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      due_at: t.due_at,
      assignee_name: t.users?.full_name ?? null,
      created_at: t.created_at,
    }));
  }

  // Search tickets
  if (type === "all" || type === "tickets") {
    const { data } = await supabase
      .from("tickets")
      .select(
        "id, ticket_number, title, description, status, sla_due_at, sla_breached, created_at, organizations!inner(name)",
      )
      .textSearch("search_vector", tsquery)
      .order("created_at", { ascending: false })
      .limit(limit);

    results.tickets = ((data as unknown as RawTicket[]) ?? []).map((t) => ({
      id: t.id,
      ticket_number: t.ticket_number,
      title: t.title,
      description: t.description,
      status: t.status,
      sla_breached: t.sla_breached,
      org_name: t.organizations?.name ?? "",
      created_at: t.created_at,
    }));
  }

  return NextResponse.json(results);
}

// Raw types from Supabase
type RawMessage = {
  id: string;
  room_id: string;
  body: string | null;
  kind: string;
  created_at: string;
  users: { full_name: string } | null;
  rooms: { name: string } | null;
};

type RawTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
  created_at: string;
  users: { full_name: string } | null;
};

type RawTicket = {
  id: string;
  ticket_number: string;
  title: string;
  description: string | null;
  status: string;
  sla_due_at: string | null;
  sla_breached: boolean;
  created_at: string;
  organizations: { name: string } | null;
};

// Clean result types
type SearchMessage = {
  id: string;
  room_id: string;
  body: string | null;
  sender_name: string;
  room_name: string;
  created_at: string;
};

type SearchTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
  assignee_name: string | null;
  created_at: string;
};

type SearchTicket = {
  id: string;
  ticket_number: string;
  title: string;
  description: string | null;
  status: string;
  sla_breached: boolean;
  org_name: string;
  created_at: string;
};
