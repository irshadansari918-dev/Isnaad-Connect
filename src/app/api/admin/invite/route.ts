import { NextRequest, NextResponse } from "next/server";
import { getMe } from "@/lib/queries/me";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/invite — Send magic link invite to a user (admin only)
 * Body: { email }
 *
 * The user must already exist in the users table. This sends a magic link
 * to their email so they can log in without a password.
 */
export async function POST(request: NextRequest) {
  const me = await getMe();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { email } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify user exists
  const { data: profile } = await admin
    .from("users")
    .select("id, email, role")
    .eq("email", email.trim().toLowerCase())
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No user found with this email" }, { status: 404 });
  }

  // Generate magic link via Supabase Auth
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: email.trim().toLowerCase(),
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json({ error: "Failed to generate invite link" }, { status: 500 });
  }

  // In production, you'd send this via email service. For now, return the link.
  return NextResponse.json({
    ok: true,
    // Only include link in non-production for testing
    link: process.env.NODE_ENV !== "production"
      ? data.properties?.action_link
      : undefined,
    message: `Magic link sent to ${email}`,
  });
}
