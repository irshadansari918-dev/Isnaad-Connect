/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Isnaad Connect — Day 2 messaging smoke test
 *
 * Verifies:
 *   1. AM can send a message to a room
 *   2. Client A can read messages in their room
 *   3. Client A can send a reply
 *   4. Client B cannot read messages from Client A's room
 *   5. Supabase Realtime delivers messages within 5s
 *   6. Read tracking (last_read_message_id) updates correctly
 *
 * Run: `npm run smoke:messaging`
 * Required env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *               SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SEED_PASSWORD = "Day1-Smoke-Test-Pw!";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: SEED_PASSWORD,
  });
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
  return client;
}

function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function main() {
  console.log("\n🧪 Day 2 — Messaging smoke test\n");

  const admin = serviceClient();

  // --- Find seeded rooms and users ---
  const { data: rooms } = await admin.from("rooms").select("id, name, kind");
  const clientARoom = rooms?.find((r: any) => r.name.includes("Client A") || r.kind === "client");
  if (!clientARoom) {
    console.error("❌ No client room found — run the seeder first (npm run seed)");
    process.exit(1);
  }

  console.log(`  Using room: "${clientARoom.name}" (${clientARoom.id})\n`);

  // Sign in as AM and Client A
  const amClient = await signIn("am1@isnaad.test");
  const clientAClient = await signIn("user-a@trial-client-a.test");
  const clientBClient = await signIn("user-b@trial-client-b.test");

  // Get user IDs
  const amUser = (await amClient.auth.getUser()).data.user!;
  const clientAUser = (await clientAClient.auth.getUser()).data.user!;

  // --- Test 1: AM can send a message ---
  console.log("Test 1: AM sends a message");
  const testBody = `Smoke test ${Date.now()}`;
  const { data: amMsg, error: amErr } = await amClient
    .from("messages")
    .insert({
      room_id: clientARoom.id,
      sender_id: amUser.id,
      kind: "text",
      body: testBody,
    })
    .select("id, body, sender_id")
    .single();

  assert("AM can INSERT a message", !amErr && !!amMsg, amErr?.message);

  // --- Test 2: Client A can read messages in their room ---
  console.log("\nTest 2: Client A reads messages");
  const { data: clientAMsgs, error: clientAErr } = await clientAClient
    .from("messages")
    .select("id, body, sender_id")
    .eq("room_id", clientARoom.id)
    .order("created_at", { ascending: false })
    .limit(10);

  assert(
    "Client A can SELECT messages in their room",
    !clientAErr && Array.isArray(clientAMsgs) && clientAMsgs.length > 0,
    clientAErr?.message,
  );

  const foundAmMsg = clientAMsgs?.find((m: any) => m.body === testBody);
  assert("Client A sees the AM's message", !!foundAmMsg);

  // --- Test 3: Client A can send a reply ---
  console.log("\nTest 3: Client A sends a reply");
  const replyBody = `Reply ${Date.now()}`;
  const { data: reply, error: replyErr } = await clientAClient
    .from("messages")
    .insert({
      room_id: clientARoom.id,
      sender_id: clientAUser.id,
      kind: "text",
      body: replyBody,
    })
    .select("id, body")
    .single();

  assert("Client A can INSERT a reply", !replyErr && !!reply, replyErr?.message);

  // --- Test 4: Client B cannot read Client A's room messages ---
  console.log("\nTest 4: Client B isolation");
  const { data: clientBMsgs } = await clientBClient
    .from("messages")
    .select("id")
    .eq("room_id", clientARoom.id);

  assert(
    "Client B gets 0 messages from Client A's room",
    Array.isArray(clientBMsgs) && clientBMsgs.length === 0,
    `got ${clientBMsgs?.length ?? "null"} rows`,
  );

  // Client B also cannot insert
  const { error: clientBInsertErr } = await clientBClient
    .from("messages")
    .insert({
      room_id: clientARoom.id,
      sender_id: (await clientBClient.auth.getUser()).data.user!.id,
      kind: "text",
      body: "Should fail",
    });

  assert("Client B cannot INSERT into Client A's room", !!clientBInsertErr);

  // --- Test 5: Realtime delivery ---
  console.log("\nTest 5: Realtime delivery");
  let realtimeReceived = false;

  const channel = clientAClient
    .channel(`test-room-${clientARoom.id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `room_id=eq.${clientARoom.id}`,
      },
      () => {
        realtimeReceived = true;
      },
    )
    .subscribe();

  // Wait for subscription to be ready
  await new Promise((r) => setTimeout(r, 2000));

  // AM sends another message
  const rtBody = `Realtime test ${Date.now()}`;
  await amClient.from("messages").insert({
    room_id: clientARoom.id,
    sender_id: amUser.id,
    kind: "text",
    body: rtBody,
  });

  // Wait up to 5 seconds for realtime delivery
  for (let i = 0; i < 10; i++) {
    if (realtimeReceived) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  assert("Realtime INSERT event received within 5s", realtimeReceived);

  await clientAClient.removeChannel(channel);

  // --- Test 6: Read tracking ---
  console.log("\nTest 6: Read tracking");
  if (amMsg) {
    const { error: readErr } = await clientAClient
      .from("room_members")
      .update({ last_read_message_id: amMsg.id })
      .eq("room_id", clientARoom.id)
      .eq("user_id", clientAUser.id);

    assert("Client A can update last_read_message_id", !readErr, readErr?.message);

    // Verify it stuck
    const { data: membership } = await clientAClient
      .from("room_members")
      .select("last_read_message_id")
      .eq("room_id", clientARoom.id)
      .eq("user_id", clientAUser.id)
      .single();

    assert(
      "last_read_message_id persisted correctly",
      membership?.last_read_message_id === amMsg.id,
    );
  }

  // --- Summary ---
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Day 2 smoke test: ${passed} passed, ${failed} failed`);
  console.log(`${"─".repeat(50)}\n`);

  // Cleanup test messages
  if (amMsg?.id) await admin.from("messages").delete().eq("body", testBody);
  if (reply?.id) await admin.from("messages").delete().eq("body", replyBody);
  await admin.from("messages").delete().eq("body", rtBody);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Smoke test crashed:", e);
  process.exit(1);
});
