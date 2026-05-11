"use client";

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";

type Props = {
  onSend: (body: string) => Promise<void>;
  sending: boolean;
};

export function Composer({ onSend, sending }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useLocale();

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText("");
    await onSend(trimmed);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t bg-card px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.sendMessage")}
          rows={1}
          className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring placeholder:text-muted-foreground focus:ring-2"
          style={{ minHeight: "40px", maxHeight: "120px" }}
          disabled={sending}
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--isnaad-navy)] text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          title={t("chat.send")}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
