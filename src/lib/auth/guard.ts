import { createClient } from "@/lib/supabase/server";
import type { Me } from "@/lib/queries/me";
import { getMe } from "@/lib/queries/me";

export type AllowedRole = Me["role"];

/**
 * Server-side guard: returns the current user if authenticated and has one of
 * the allowed roles. Returns null otherwise.
 */
export async function requireRole(
  ...roles: AllowedRole[]
): Promise<Me | null> {
  const me = await getMe();
  if (!me) return null;
  if (roles.length > 0 && !roles.includes(me.role)) return null;
  return me;
}

/**
 * API route guard: returns { user, supabase } or throws a Response.
 * Use in API routes to enforce auth + role.
 */
export async function apiGuard(...roles: AllowedRole[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (roles.length > 0) {
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !roles.includes(profile.role as AllowedRole)) {
      throw new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return { user, supabase };
}
