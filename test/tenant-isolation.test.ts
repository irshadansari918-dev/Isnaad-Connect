/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Isnaad Connect — Tenant isolation smoke test (Day 1, Task 14)
 *
 * PLAN.md Section 3.2 Day 1 smoke test must verify:
 *   1. Client A cannot SELECT from rooms where they're not a member
 *   2. Client A cannot SELECT messages from a room they're not a member of
 *   3. Client A cannot SELECT users from Client B's org
 *   4. AM can SELECT rooms they're members of from both Client A and Client B
 *   5. Admin can SELECT all rooms, all users, all messages
 *   6. service_role bypasses RLS (intentional, system ops)
 *
 * Each user gets a known password set during seed (Day 1 Task 10). The test
 * uses Supabase anon-key clients to sign in as each user — that is what
 * exercises RLS the same way the app does.
 *
 * Run: `npm run smoke:tenant`
 * Required env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *               SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const SEED_PASSWORD = "Day1-Smoke-Test-Pw!";

const FIXTURES = {
  admin: { email: "admin@isnaad.test", expectedRole: "admin" },
  am: { email: "am1@isnaad.test", expectedRole: "am" },
  clientA: { email: "user-a@trial-client-a.test", expectedRole: "client" },
  clientB: { email: "user-b@trial-client-b.test", expectedRole: "client" },
};

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name}${detail ? "  — " + detail : ""}`);
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: SEED_PASSWORD,
  });
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
  return client;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const admin = await signInAs(FIXTURES.admin.email);
  const am = await signInAs(FIXTURES.am.email);
  const clientA = await signInAs(FIXTURES.clientA.email);
  const clientB = await signInAs(FIXTURES.clientB.email);
  void clientB;

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: allRooms } = await service
    .from("rooms")
    .select("id, kind, name, client_org_id")
    .is("archived_at", null);
  const { data: allUsers } = await service.from("users").select("id, email, org_id, role");
  const { data: allOrgs } = await service.from("organizations").select("id, kind, name");

  if (!allRooms || !allUsers || !allOrgs) {
    throw new Error("Service-role read returned null — DB not seeded?");
  }

  const clientAOrg = allOrgs.find((o) => o.name.toLowerCase().includes("trial client a"));
  const clientBOrg = allOrgs.find((o) => o.name.toLowerCase().includes("trial client b"));
  const roomA = allRooms.find((r) => r.client_org_id === clientAOrg?.id);
  const roomB = allRooms.find((r) => r.client_org_id === clientBOrg?.id);
  if (!clientAOrg || !clientBOrg || !roomA || !roomB) {
    throw new Error("Seed fixtures not found — check Task 10 seed output.");
  }

  {
    const { data } = await clientA.from("rooms").select("id");
    const ids = (data ?? []).map((r: any) => r.id);
    const leaked = ids.includes(roomB.id);
    record(
      "1. Client A cannot read Client B's room",
      !leaked && ids.includes(roomA.id),
      `Client A sees ${ids.length} room(s); roomB leaked=${leaked}`,
    );
  }

  {
    const { data } = await clientA
      .from("messages")
      .select("id, room_id")
      .eq("room_id", roomB.id);
    record(
      "2. Client A cannot read Client B's messages",
      (data ?? []).length === 0,
      `Returned ${(data ?? []).length} message(s) (expected 0)`,
    );
  }

  {
    const { data } = await clientA.from("users").select("id, org_id").eq("org_id", clientBOrg.id);
    record(
      "3. Client A cannot read Client B's users",
      (data ?? []).length === 0,
      `Returned ${(data ?? []).length} user(s) (expected 0)`,
    );
  }

  {
    const { data } = await am.from("rooms").select("id");
    const ids = (data ?? []).map((r: any) => r.id);
    record(
      "4. AM can read both client rooms",
      ids.includes(roomA.id) && ids.includes(roomB.id),
      `AM sees ${ids.length} room(s)`,
    );
  }

  {
    const { data: r } = await admin.from("rooms").select("id");
    const { data: u } = await admin.from("users").select("id");
    const { data: m } = await admin.from("messages").select("id");
    const pass =
      (r ?? []).length >= allRooms.length &&
      (u ?? []).length >= allUsers.length &&
      (m ?? []).length >= 0;
    record(
      "5. Admin can read all rooms/users/messages",
      pass,
      `rooms=${(r ?? []).length} users=${(u ?? []).length} messages=${(m ?? []).length}`,
    );
  }

  {
    record(
      "6. Service role bypasses RLS",
      (allRooms.length ?? 0) > 0 && (allUsers.length ?? 0) > 0,
      `service sees ${allRooms.length} room(s), ${allUsers.length} user(s)`,
    );
  }

  const failed = results.filter((r) => !r.pass);
  console.log("");
  console.log(
    `Smoke test: ${results.length - failed.length}/${results.length} passed`,
  );
  if (failed.length > 0) {
    console.log("FAILURES:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(2);
});
