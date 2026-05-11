import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMe } from "@/lib/queries/me";

export async function POST(request: NextRequest) {
  const me = await getMe();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Name is required (min 2 chars)" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .insert({ kind: "client", name: name.trim() })
    .select("id, name, kind")
    .single();

  if (error) {
    const msg = error.message.includes("unique")
      ? "Organization name already exists"
      : "Failed to create organization";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  return NextResponse.json({ organization: data }, { status: 201 });
}

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

  const supabase = await createClient();

  if (action === "archive") {
    const { error } = await supabase
      .from("organizations")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("kind", "client"); // Cannot archive Isnaad org

    if (error) {
      return NextResponse.json({ error: "Failed to archive" }, { status: 422 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "restore") {
    const { error } = await supabase
      .from("organizations")
      .update({ archived_at: null })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Failed to restore" }, { status: 422 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
