"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Paperclip, Send, X, Loader2 } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/utils";

type ReplyState = {
  messageId: string;
  senderName: string;
  body: string;
} | null;

type Props = {
  onSend: (body: string, replyToId?: string | null) => Promise<void>;
  sending: boolean;
  roomId: string;
  replyTo?: ReplyState;
  onCancelReply?: () => void;
};

export function Composer({ onSend, sending, roomId, replyTo, onCancelReply }: Props) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { t } = useLocale();

  const handleSubmit = async () => {
    if (preview) {
      await uploadFile(preview.file);
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText("");
    await onSend(trimmed, replyTo?.messageId ?? null);
    onCancelReply?.();
    inputRef.current?.focus();
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("room_id", roomId);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        console.error("Upload failed:", err);
      }
    } finally {
      setUploading(false);
      clearPreview();
    }
  };

  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const handleFile = (file: File) => {
    const isImage = file.type.startsWith("image/");
    if (isImage) {
      setPreview({ file, url: URL.createObjectURL(file) });
    } else {
      uploadFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFile(file);
        return;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="border-t bg-card px-4 py-3"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Reply preview */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md border-s-2 border-blue-400 bg-muted/50 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">{replyTo.senderName}</p>
            <p className="truncate text-xs text-muted-foreground">{replyTo.body}</p>
          </div>
          <button onClick={onCancelReply} className="shrink-0 rounded-md p-1 hover:bg-accent">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Image preview */}
      {preview && (
        <div className="mb-2 flex items-start gap-2">
          <div className="relative">
            <img
              src={preview.url}
              alt="Preview"
              className="h-20 w-20 rounded-lg border object-cover"
            />
            <button
              onClick={clearPreview}
              className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white shadow"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{preview.file.name}</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Attachment button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-accent disabled:opacity-40"
          title={t("chat.attach")}
        >
          <Paperclip className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Image button */}
        <button
          onClick={() => {
            if (fileRef.current) {
              fileRef.current.accept = "image/*";
              fileRef.current.click();
              fileRef.current.accept = "";
            }
          }}
          disabled={uploading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-accent disabled:opacity-40 sm:hidden"
          title={t("chat.image")}
        >
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        </button>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={t("chat.sendMessage")}
          rows={1}
          className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring placeholder:text-muted-foreground focus:ring-2"
          style={{ minHeight: "40px", maxHeight: "120px" }}
          disabled={sending || uploading}
        />

        <button
          onClick={handleSubmit}
          disabled={(!text.trim() && !preview) || sending || uploading}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40",
            "bg-[var(--isnaad-navy)] hover:opacity-90",
          )}
          title={t("chat.send")}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
