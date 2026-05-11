import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are Sanad, the AI assistant for Isnaad Connect — a communication and work management platform for Isnaad, a logistics and warehousing company in Saudi Arabia.

Your role:
- Help staff (AMs, admins) and clients with questions about their operations
- Propose creating tickets or tasks when appropriate
- Provide summaries of room activity when asked
- Be concise, helpful, and professional
- Respond in the same language the user writes in (English or Arabic)
- When you detect a client issue or complaint, suggest creating a ticket
- When you detect an action item, suggest creating a task

You have access to the following tools:
- create_ticket: Create a support ticket for a client issue
- create_task: Create a task/action item for the team
- room_summary: Summarize recent activity in the current room

When using tools, always explain what you're about to do first. If a tool returns a result, incorporate it naturally into your response.`;

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
      "Summarize recent activity in the current chat room. Use when asked for a summary or recap.",
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
];

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
Current date: ${new Date().toISOString().split("T")[0]}
`.trim();

  try {
    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
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

    // If Claude wants to use tools, create a confirm card instead of executing
    if (proposedActions.length > 0) {
      const action = proposedActions[0];
      const metadata: Record<string, unknown> = {
        action_type: action.tool_name,
        action_input: action.input,
        status: "pending", // pending | confirmed | cancelled
        room_id,
        trigger_message_id,
      };

      if (action.tool_name === "create_ticket") {
        metadata.client_org_id = room.client_org_id;
      }

      // Build the response text
      const actionLabel =
        action.tool_name === "create_ticket"
          ? `📋 Create ticket: "${action.input.title}"`
          : action.tool_name === "create_task"
            ? `✅ Create task: "${action.input.title}"`
            : `📊 ${action.tool_name}`;

      const fullReply = replyText
        ? `${replyText}\n\n${actionLabel}`
        : actionLabel;

      // Insert AI message with action metadata
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
