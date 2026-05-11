import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
];

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * POST /api/upload
 * Upload a file to Supabase Storage. Returns the public URL.
 * Body: FormData with "file" field and "room_id" field.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const roomId = formData.get("room_id") as string | null;

  if (!file || !roomId) {
    return NextResponse.json(
      { error: "file and room_id required" },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed" },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 25MB)" },
      { status: 400 },
    );
  }

  // Generate a unique filename
  const ext = file.name.split(".").pop() ?? "bin";
  const safeName = `${roomId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(safeName, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("attachments").getPublicUrl(safeName);

  const isImage = IMAGE_TYPES.includes(file.type);

  // Insert message with attachment
  const { data: message, error: msgError } = await supabase
    .from("messages")
    .insert({
      room_id: roomId,
      sender_id: user.id,
      kind: isImage ? "image" : "text",
      body: isImage ? null : file.name,
      metadata: {
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
      },
    })
    .select("id")
    .single();

  if (msgError) {
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    message_id: message.id,
    url: publicUrl,
    is_image: isImage,
  });
}
