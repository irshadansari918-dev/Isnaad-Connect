"use client";

import { useState } from "react";
import { MoreHorizontal, Reply, Pencil, Trash2 } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";

type Props = {
  messageId: string;
  isOwn: boolean;
  isAdmin: boolean;
  canEdit: boolean; // only text messages by the sender
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function MessageActions({
  messageId,
  isOwn,
  isAdmin,
  canEdit,
  onReply,
  onEdit,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/bubble:opacity-100 hover:bg-accent"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-20 mt-1 min-w-32 rounded-lg border bg-card py-1 shadow-lg">
            <button
              onClick={() => {
                setOpen(false);
                onReply();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Reply className="h-3.5 w-3.5" />
              {t("message.reply")}
            </button>
            {canEdit && (
              <button
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("message.edit")}
              </button>
            )}
            {(isOwn || isAdmin) && (
              <button
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-accent"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("message.delete")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
