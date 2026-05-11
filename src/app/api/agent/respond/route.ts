import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are Sanad (سند), the AI assistant for Isnaad Connect — a communication and work management platform for Isnaad, a logistics and warehousing company in Saudi Arabia.

Your role:
- Help staff (AMs, admins) and clients with questions about their operations
- Propose creating tickets or tasks when appropriate — never create without confirmation
- Provide summaries of room activity when asked
- Search existing tasks and tickets to answer status questions
- Be concise, helpful, and professional
- Respond in the same language the user writes in (English or Arabic)
- When you detect a client issue or complaint, suggest creating a ticket
- When you detect an action item, suggest creating a task
- When asked about status or progress, search existing data before answering
- When asked for a summary, use the room_summary tool

Important:
- Always explain what you're about to do before using a tool
- For create_ticket and create_task, propose the action and let the user confirm
- For search and summary tools, execute immediately and present results
- Include relevant details: ticket numbers, assignees, due dates, statuses
- Format responses cleanly with bullet points for lists`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_ticket",
    description:
      "Create a support ticket for a client issue. Use when a client reports a problem or makes a request that needs tracking.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short title for the ticket" },
        description: {
          type: "string",
          description: "Detailed description of the issue",
        },
        sla_hours: {
          type: "number",
          description: "SLA deadline in hours (default 24)",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "create_task",
    description:
      "Create an internal task/action item. Use when someone mentions something that needs follow-up.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short title for the task" },
        description: {
          type: "string",
          description: "Optional description of what needs to be done",
        },
        due_days: {
          type: "number",
          description: "Days until due (default 3)",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "room_summary",
    description:
      "Summarize recent activity in the current chat room. Use when asked for a summary, recap, or 'what did I miss'.",
    input_schema: {
      type: "object" as const,
      properties: {
        num_messages: {
          type: "number",
          description: "Number of recent messages to summarize (default 50)",
        },
      },
      required: [],
    },
  },
  {
    name: "search_tickets",
    description:
      "Search existing tickets. Use when asked about ticket status, open issues, or client requests.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description: "Filter by status: open, in_progress, pending_client, resolved, closed",
        },
        query: {
          type: "string",
          description: "Search term to match against ticket title or number",
        },
        limit: {
          type: "number",
          description: "Max results (default 10)",
        },
      },
      required: [],
    },
  },
  {
    name: "search_tasks",
    description:
      "Search existing tasks. Use when asked about task status, assignments, or what needs to be done.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description: "Filter by status: open, in_progress, done, cancelled",
        },
        assignee_name: {
          type: "string",
          description: "Filter by assignee name (partial match)",
        },
        limit: {
          type: "number",
          description: "Max results (default 10)",
        },
      },
      required: [],
    },
  },
];

// Execute tools that return data (not create actions)
async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  roomId: string,
): Promise<string> {
  const supabase = createAdminClient();

  if (toolName === "room_summary") {
    const limit = (input.num_messages as number) || 50;
    const { data: msgs } = await supabase
      .from("messages")
      .select("body, kind, created_at, users!inner(full_name, role)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(limit);

    type MsgRow = { body: string | null; kind: string; created_at: string; users: { full_name: string; role: string } };
    if (!msgs || msgs.length === 0) return "No messages found in this room.";

    const lines = (msgs as unknown as MsgRow[]).reverse().map((m) => {
      const time = new Date(m.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      return `[${time}] ${m.users.full_name} (${m.users.role}): ${m.body ?? `[${m.kind}]`}`;
    });

    return `Recent ${msgs.length} messages:\n${lines.join("\n")}`;
  }

  if (toolName === "search_tickets") {
    let query = supabase
      .from("tickets")
      .select("ticket_number, title, status, sla_breached, created_at, users!tickets_assigned_am_id_fkey(full_name), organizations!inner(name)")
      .order("created_at", { ascending: false })
      .limit((input.limit as number) || 10);

    if (input.status) query = query.eq("status", input.status);
    if (input.query) {
      const term = `%${input.query}%`;
      query = query.or(`title.ilike.${term},ticket_number.ilike.${term}`);
    }

    const { data: tickets } = await query;
    type TRow = { ticket_number: string; title: string; status: string; sla_breached: boolean; created_at: string; users: { full_name: string } | null; organizations: { name: string } };
    if (!tickets || tickets.length === 0) return "No tickets found matching your criteria.";

    const lines = (tickets as unknown as TRow[]).map((t) => {
      const sla = t.sla_breached ? " ⚠️ SLA BREACHED" : "";
      const am = t.users?.full_name ? ` → ${t.users.full_name}` : "";
      return `• ${t.ticket_number}: ${t.title} [${t.status}]${am}${sla} (${t.organizations.name})`;
    });

    return `Found ${tickets.length} tickets:\n${lines.join("\n")}`;
  }

  if (toolName === "search_tasks") {
    let query = supabase
      .from("tasks")
      .select("title, status, due_at, completed_at, created_at, users!tasks_assignee_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit((input.limit as number) || 10);

    if (input.status) query = query.eq("status", input.status);

    const { data: tasks } = await query;
    type TaskRow = { title: string; status: string; due_at: string | null; completed_at: string | null; created_at: string; users: { full_name: string } | null };
    if (!tasks || tasks.length === 0) return "No tasks found matching your criteria.";

    let results = tasks as unknown as TaskRow[];
    if (input.assignee_name) {
      const name = (input.assignee_name as string).toLowerCase();
      results = results.filter((t) => t.users?.full_name?.toLowerCase().includes(name));
    }

    const lines = results.map((t) => {
      const assignee = t.users?.full_name ?? "Unassigned";
      const due = t.due_at ? ` due ${new Date(t.due_at).toLocaleDateString()}` : "";
      const overdue = t.due_at && new Date(t.due_at) < new Date() && t.status !== "done" ? " ⚠️ OVERDUE" : "";
      return `• ${t.title} [${t.status}] → ${assignee}${due}${overdue}`;
    });

    return `Found ${results.length} tasks:\n${lines.join("\n")}`;
  }

  return "Unknown tool.";
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  const body = await request.json();
  const { room_id, trigger_message_id } = body;

  if (!room_id) {
    return NextResponse.json(
      { error: "room_id is required" },
      { status: 400 },
    );
  }

  // Find the Sanad AI user
  const { data: sanadUser } = await supabase
    .from("users")
    .select("id")
    .eq("is_ai", true)
    .single();

  if (!sanadUser) {
    return NextResponse.json(
      { error: "Sanad AI user not found" },
      { status: 500 },
    );
  }

  // Get room info
  const { data: room } = await supabase
    .from("rooms")
    .select("id, name, kind, client_org_id")
    .eq("id", room_id)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Get client org name if applicable
  let clientOrgName = "";
  if (room.client_org_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", room.client_org_id)
      .single();
    clientOrgName = org?.name ?? "";
  }

  // Get room members for context
  const { data: members } = await supabase
    .from("room_members")
    .select("users!inner(full_name, role, is_ai)")
    .eq("room_id", room_id);

  type MemberRow = { users: { full_name: string; role: string; is_ai: boolean } };
  const memberList = ((members as unknown as MemberRow[]) ?? [])
    .filter((m) => !m.users.is_ai)
    .map((m) => `${m.users.full_name} (${m.users.role})`)
    .join(", ");

  // Get open tickets/tasks count for context
  const [{ count: openTickets }, { count: openTasks }] = await Promise.all([
    supabase.from("tickets").select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),
  ]);

  // Load last 20 messages for context
  const { data: recentMessages } = await supabase
    .from("messages")
    .select(
      "id, sender_id, kind, body, created_at, users!inner(full_name, role, is_ai)",
    )
    .eq("room_id", room_id)
    .order("created_at", { ascending: false })
    .limit(20);

  type RawMsg = {
    id: string;
    sender_id: string;
    kind: string;
    body: string | null;
    created_at: string;
    users: { full_name: string; role: string; is_ai: boolean };
  };

  const contextMessages = ((recentMessages as unknown as RawMsg[]) ?? [])
    .reverse()
    .map((m) => {
      const role = m.users.is_ai ? "assistant" : "user";
      const prefix = m.users.is_ai
        ? ""
        : `[${m.users.full_name} (${m.users.role})] `;
      return { role: role as "user" | "assistant", content: `${prefix}${m.body ?? ""}` };
    });

  // Build context about the room
  const roomContext = `
Room: "${room.name}" (${room.kind} room)
${clientOrgName ? `Client: ${clientOrgName}` : ""}
Members: ${memberList || "none"}
Platform stats: ${openTickets ?? 0} open tickets, ${openTasks ?? 0} open tasks
Current date: ${new Date().toISOString().split("T")[0]}
`.trim();

  try {
    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: `${SYSTEM_PROMPT}\n\nContext:\n${roomContext}`,
      tools: TOOLS,
      messages:
        contextMessages.length > 0
          ? contextMessages
          : [{ role: "user", content: "Hello" }],
    });

    // Process the response
    let replyText = "";
    const proposedActions: Array<{
      type: string;
      tool_name: string;
      input: Record<string, unknown>;
    }> = [];

    for (const block of response.content) {
      if (block.type === "text") {
        replyText += block.text;
      } else if (block.type === "tool_use") {
        proposedActions.push({
          type: "tool_use",
          tool_name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    // Handle tool calls
    if (proposedActions.length > 0) {
      const action = proposedActions[0];

      // Data-fetching tools: execute immediately, then do a second LLM call with results
      if (["room_summary", "search_tickets", "search_tasks"].includes(action.tool_name)) {
        const toolResult = await executeTool(action.tool_name, action.input, room_id);

        // Second call with tool results for a natural response
        const followUp = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: `${SYSTEM_PROMPT}\n\nContext:\n${roomContext}`,
          messages: [
            ...(contextMessages.length > 0 ? contextMessages : [{ role: "user" as const, content: "Hello" }]),
            { role: "assistant" as const, content: response.content },
            {
              role: "user" as const,
              content: [{
                type: "tool_result" as const,
                tool_use_id: response.content.find((b) => b.type === "tool_use")?.type === "tool_use"
                  ? (response.content.find((b) => b.type === "tool_use") as Anthropic.ToolUseBlock).id
                  : "unknown",
                content: toolResult,
              }],
            },
          ],
          tools: TOOLS,
        });

        let finalText = replyText ? `${replyText}\n\n` : "";
        for (const block of followUp.content) {
          if (block.type === "text") finalText += block.text;
        }

        if (finalText.trim()) {
          const { data: aiMsg, error: insertErr } = await supabase
            .from("messages")
            .insert({
              room_id,
              sender_id: sanadUser.id,
              kind: "ai",
              body: finalText.trim(),
            })
            .select("id")
            .single();

          if (insertErr) {
            console.error("Failed to insert AI message:", insertErr);
            return NextResponse.json({ error: "Failed to save AI response" }, { status: 500 });
          }

          return NextResponse.json({ message_id: aiMsg.id, has_action: false });
        }

        return NextResponse.json({ message_id: null, has_action: false });
      }

      // Action tools (create_ticket, create_task): propose with confirm card
      const metadata: Record<string, unknown> = {
        action_type: action.tool_name,
        action_input: action.input,
        status: "pending",
        room_id,
        trigger_message_id,
      };

      if (action.tool_name === "create_ticket") {
        metadata.client_org_id = room.client_org_id;
      }

      const actionLabel =
        action.tool_name === "create_ticket"
          ? `📋 Create ticket: "${action.input.title}"`
          : `✅ Create task: "${action.input.title}"`;

      const fullReply = replyText
        ? `${replyText}\n\n${actionLabel}`
        : actionLabel;

      const { data: aiMsg, error: insertErr } = await supabase
        .from("messages")
        .insert({
          room_id,
          sender_id: sanadUser.id,
          kind: "ai",
          body: fullReply,
          metadata,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("Failed to insert AI message:", insertErr);
        return NextResponse.json(
          { error: "Failed to save AI response" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        message_id: aiMsg.id,
        has_action: true,
        action_type: action.tool_name,
      });
    }

    // No tools — just a text response
    if (replyText) {
      const { data: aiMsg, error: insertErr } = await supabase
        .from("messages")
        .insert({
          room_id,
          sender_id: sanadUser.id,
          kind: "ai",
          body: replyText,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("Failed to insert AI message:", insertErr);
        return NextResponse.json(
          { error: "Failed to save AI response" },
          { status: 500 },
        );
      }

      return NextResponse.json({ message_id: aiMsg.id, has_action: false });
    }

    return NextResponse.json({ message_id: null, has_action: false });
  } catch (err) {
    console.error("Agent error:", err);
    return NextResponse.json(
      { error: "AI Agent failed to respond" },
      { status: 500 },
    );
  }
}
