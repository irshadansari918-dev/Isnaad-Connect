/* eslint-disable no-console */
/**
 * Isnaad Connect — Day 1 Task 10 seed.
 *
 * Creates exactly:
 *   - 1 Isnaad org   ("Isnaad")
 *   - 2 client orgs  ("Trial Client A", "Trial Client B")
 *   - 1 admin        admin@isnaad.test     (Isnaad)
 *   - 1 AM           am1@isnaad.test       (Isnaad)
 *   - 2 client users user-a@trial-client-a.test, user-b@trial-client-b.test
 *   - 2 client rooms ("Trial Client A", "Trial Client B")
 *   - room members   AM in both client rooms; each client user in their own
 *   - 3 messages     1 in room A (sent by AM), 2 in room B (AM + client B)
 *
 * Idempotent: re-running deletes the seeded fixtures and re-creates them.
 * Uses the service-role key — bypasses RLS — server-only.
 *
 * Run: `npm run seed`
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const SEED_PASSWORD = "Day1-Smoke-Test-Pw!";

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Role = "admin" | "am" | "internal" | "client";

const ORGS = [
  { kind: "isnaad" as const, name: "Isnaad" },
  { kind: "client" as const, name: "Trial Client A" },
  { kind: "client" as const, name: "Trial Client B" },
];

const USERS = [
  { email: "admin@isnaad.test", fullName: "Day1 Admin", role: "admin" as Role, org: "Isnaad" },
  { email: "am1@isnaad.test", fullName: "Day1 AM", role: "am" as Role, org: "Isnaad" },
  {
    email: "user-a@trial-client-a.test",
    fullName: "Client A User",
    role: "client" as Role,
    org: "Trial Client A",
  },
  {
    email: "user-b@trial-client-b.test",
    fullName: "Client B User",
    role: "client" as Role,
    org: "Trial Client B",
  },
];

const SEED_EMAILS = USERS.map((u) => u.email);

async function deletePreviousFixtures() {
  console.log("Clearing previous seed…");

  const { data: list } = await supa.auth.admin.listUsers({ page: 1, perPage: 200 });
  const toDelete = (list?.users ?? []).filter((u) =>
    SEED_EMAILS.includes((u.email ?? "").toLowerCase()),
  );
  for (const u of toDelete) {
    await supa.auth.admin.deleteUser(u.id);
  }

  const { data: clientOrgs } = await supa
    .from("organizations")
    .select("id, name")
    .in("name", ORGS.map((o) => o.name));
  const orgIds = (clientOrgs ?? []).map((o) => o.id);

  if (orgIds.length > 0) {
    const { data: roomsToClear } = await supa
      .from("rooms")
      .select("id")
      .in("client_org_id", orgIds);
    const roomIds = (roomsToClear ?? []).map((r) => r.id);
    if (roomIds.length > 0) {
      await supa.from("messages").delete().in("room_id", roomIds);
    }
    await supa.from("rooms").delete().in("client_org_id", orgIds);
    await supa.from("organizations").delete().in("id", orgIds);
  }

  await supa.from("organizations").delete().eq("name", "Isnaad");
}

async function ensureOrgs() {
  const out: Record<string, string> = {};
  for (const o of ORGS) {
    const { data, error } = await supa
      .from("organizations")
      .insert({ kind: o.kind, name: o.name })
      .select("id, name")
      .single();
    if (error) throw new Error(`org insert ${o.name}: ${error.message}`);
    out[data.name] = data.id;
  }
  console.log("Orgs:", out);
  return out;
}

async function ensureUser(args: {
  email: string;
  fullName: string;
  role: Role;
  orgId: string;
}) {
  const { data: created, error: authErr } = await supa.auth.admin.createUser({
    email: args.email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: args.fullName, seed: true },
  });
  if (authErr || !created.user) throw new Error(`auth create ${args.email}: ${authErr?.message}`);

  const { error: profileErr } = await supa.from("users").insert({
    id: created.user.id,
    org_id: args.orgId,
    role: args.role,
    email: args.email,
    full_name: args.fullName,
  });
  if (profileErr) throw new Error(`users insert ${args.email}: ${profileErr.message}`);

  return created.user.id;
}

async function main() {
  await deletePreviousFixtures();

  const orgIds = await ensureOrgs();

  const userIds: Record<string, string> = {};
  for (const u of USERS) {
    userIds[u.email] = await ensureUser({
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      orgId: orgIds[u.org],
    });
    console.log(`User ${u.email} → ${userIds[u.email]}`);
  }

  const { data: roomA, error: rerrA } = await supa
    .from("rooms")
    .insert({ kind: "client", name: "Trial Client A", client_org_id: orgIds["Trial Client A"] })
    .select("id")
    .single();
  if (rerrA) throw new Error(`rooms A: ${rerrA.message}`);

  const { data: roomB, error: rerrB } = await supa
    .from("rooms")
    .insert({ kind: "client", name: "Trial Client B", client_org_id: orgIds["Trial Client B"] })
    .select("id")
    .single();
  if (rerrB) throw new Error(`rooms B: ${rerrB.message}`);

  console.log("Rooms:", { A: roomA.id, B: roomB.id });

  await supa.from("room_members").insert([
    { room_id: roomA.id, user_id: userIds["am1@isnaad.test"], is_assigned_am: true },
    { room_id: roomB.id, user_id: userIds["am1@isnaad.test"], is_assigned_am: true },
    { room_id: roomA.id, user_id: userIds["user-a@trial-client-a.test"] },
    { room_id: roomB.id, user_id: userIds["user-b@trial-client-b.test"] },
  ]);

  await supa.from("messages").insert([
    {
      room_id: roomA.id,
      sender_id: userIds["am1@isnaad.test"],
      kind: "text",
      body: "Welcome to your Isnaad Connect room.",
    },
    {
      room_id: roomB.id,
      sender_id: userIds["am1@isnaad.test"],
      kind: "text",
      body: "Welcome to your Isnaad Connect room.",
    },
    {
      room_id: roomB.id,
      sender_id: userIds["user-b@trial-client-b.test"],
      kind: "text",
      body: "Thanks!",
    },
  ]);

  console.log("");
  console.log("Seed complete.");
  console.log(`Sign-in credentials (Day 1 only): password = ${SEED_PASSWORD}`);
  console.log("  admin@isnaad.test                 (Isnaad / admin)");
  console.log("  am1@isnaad.test                   (Isnaad / am)");
  console.log("  user-a@trial-client-a.test        (Trial Client A / client)");
  console.log("  user-b@trial-client-b.test        (Trial Client B / client)");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
