import { NextRequest, NextResponse } from "next/server";
import { getMe } from "@/lib/queries/me";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/users — Create a new user (admin only)
 * Body: { email, full_name, role, org_id, password? }
 *
 * For clients: if no password, creates with auto-generated password (they use magic link).
 * For staff: password required.
 */
export async function POST(request: NextRequest) {
  const me = await getMe();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { email, full_name, role, org_id, password } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!full_name || typeof full_name !== "string" || full_name.trim().length < 2) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (!["admin", "am", "internal", "client"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (!org_id || typeof org_id !== "string") {
    return NextResponse.json({ error: "org_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Create auth user via service role
  const userPassword = password || `ISC-${crypto.randomUUID().slice(0, 12)}!`;
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password: userPassword,
    email_confirm: true,
  });

  if (authError) {
    const msg = authError.message.includes("already")
      ? "A user with this email already exists"
      : authError.message;
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  // Create profile row
  const { error: profileError } = await admin.from("users").insert({
    id: authUser.user.id,
    email: email.trim().toLowerCase(),
    full_name: full_name.trim(),
    role,
    org_id,
  });

  if (profileError) {
    // Rollback: delete the auth user we just created
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: "Failed to create user profile" }, { status: 422 });
  }

  return NextResponse.json(
    {
      user: {
        id: authUser.user.id,
        email: email.trim().toLowerCase(),
        full_name: full_name.trim(),
        role,
      },
      needsPassword: !password,
    },
    { status: 201 },
  );
}

/**
 * PATCH /api/admin/users — Deactivate/reactivate user (admin only)
 * Body: { id, action: "deactivate" | "reactivate" }
 */
export async function PATCH(request: NextRequest) {
  const me = await getMe();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id, action } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Don't allow deactivating yourself
  if (id === me.authId) {
    return NextResponse.json({ error: "Cannot deactivate yourself" }, { status: 400 });
  }

  const supabase = await createClient();

  if (action === "deactivate") {
    const { error } = await supabase
      .from("users")
      .update({ deactivated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Failed" }, { status: 422 });
    return NextResponse.json({ ok: true });
  }

  if (action === "reactivate") {
    const { error } = await supabase
      .from("users")
      .update({ deactivated_at: null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Failed" }, { status: 422 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
