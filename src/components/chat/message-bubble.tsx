"use client";

import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { AiConfirmCard } from "./ai-confirm-card";
import { ReactionBar } from "./reaction-bar";
import { MessageActions } from "./message-actions";
import type { MessageRow } from "@/lib/queries/room";

type Props = {
  message: MessageRow;
  isOwn: boolean;
  isAdmin?: boolean;
  showSender: boolean;
  replyPreview?: { senderName: string; body: string } | null;
  onReply?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const roleBadgeColor: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  am: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  internal: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  client: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export function MessageBubble({
  message,
  isOwn,
  isAdmin = false,
  showSender,
  replyPreview,
  onReply,
  onEdit,
  onDelete,
}: Props) {
  const isAi = message.sender.is_ai;
  const isSystem = message.kind === "system";
  const isDeleted = !!message.deleted_at;
  const hasAction = isAi && typeof message.metadata?.action_type === "string";

  // System messages render as centered text
  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {message.body}
        </span>
      </div>
    );
  }

  // Deleted messages
  if (isDeleted) {
    return (
      <div
        className={cn(
          "flex gap-2",
          isOwn ? "flex-row-reverse" : "flex-row",
          showSender ? "mt-3" : "mt-0.5",
        )}
      >
        {showSender ? <div className="h-8 w-8 shrink-0" /> : <div className="w-8 shrink-0" />}
        <p className="py-1 text-xs italic text-muted-foreground">
          This message was deleted
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/bubble flex gap-2",
        isOwn ? "flex-row-reverse" : "flex-row",
        showSender ? "mt-3" : "mt-0.5",
      )}
    >
      {/* Avatar */}
      {showSender ? (
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
            isAi
              ? "bg-[var(--isnaad-red)]"
              : isOwn
                ? "bg-[var(--isnaad-navy)]"
                : "bg-slate-500",
          )}
        >
          {isAi ? "AI" : getInitials(message.sender.full_name)}
        </div>
      ) : (
        <div className="w-8 shrink-0" />
      )}

      {/* Bubble */}
      <div className={cn("max-w-[75%] min-w-0 relative", isOwn ? "items-end" : "items-start")}>
        {/* Actions menu (appears on hover) */}
        {onReply && (
          <div className={cn("absolute top-0 z-10", isOwn ? "start-0 -translate-x-full pe-1" : "end-0 translate-x-full ps-1")}>
            <MessageActions
              messageId={message.id}
              isOwn={isOwn}
              isAdmin={isAdmin}
              canEdit={isOwn && message.kind === "text"}
              onReply={() => onReply(message.id)}
              onEdit={() => onEdit?.(message.id)}
              onDelete={() => onDelete?.(message.id)}
            />
          </div>
        )}
        {/* Reply preview */}
        {replyPreview && (
          <div className={cn("mb-1 rounded-md border-s-2 border-blue-400 bg-muted/50 px-2 py-1 text-xs", isOwn ? "text-right" : "")}>
            <span className="font-semibold">{replyPreview.senderName}</span>
            <p className="truncate text-muted-foreground">{replyPreview.body}</p>
          </div>
        )}

        {showSender && (
          <div
            className={cn(
              "mb-0.5 flex items-center gap-1.5 text-xs",
              isOwn ? "flex-row-reverse" : "flex-row",
            )}
          >
            <span className="font-semibold text-foreground">
              {message.sender.full_name}
            </span>
            {isAi && (
              <span className="rounded bg-[var(--isnaad-red)] px-1 py-0.5 text-[10px] font-bold text-white">
                AI
              </span>
            )}
            {!isAi && (
              <span
                className={cn(
                  "rounded px-1 py-0.5 text-[10px] font-medium",
                  roleBadgeColor[message.sender.role] ?? roleBadgeColor.internal,
                )}
              >
                {message.sender.role.toUpperCase()}
              </span>
            )}
          </div>
        )}

        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm leading-relaxed",
            isOwn
              ? "rounded-tr-sm bg-[var(--isnaad-navy)] text-white"
              : isAi
                ? "rounded-tl-sm border border-[var(--isnaad-red)]/20 bg-red-50 text-foreground dark:bg-red-950/30"
                : "rounded-tl-sm bg-muted text-foreground",
          )}
        >
          {/* Image attachment */}
          {message.kind === "image" && typeof message.metadata?.file_url === "string" ? (
            <a
              href={message.metadata.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <img
                src={message.metadata.file_url}
                alt={String(message.metadata.file_name ?? "Image")}
                className="max-h-64 rounded-lg object-contain"
                loading="lazy"
              />
            </a>
          ) : null}
          {/* File attachment (non-image) */}
          {message.kind === "text" && typeof message.metadata?.file_url === "string" ? (
            <a
              href={message.metadata.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border bg-background/50 px-3 py-2 text-xs hover:bg-accent/50"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate font-medium">
                {String(message.metadata.file_name ?? "File")}
              </span>
              {typeof message.metadata.file_size === "number" ? (
                <span className="text-muted-foreground">
                  {formatFileSize(message.metadata.file_size)}
                </span>
              ) : null}
            </a>
          ) : null}
          {/* Text body */}
          {message.body && (
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          )}
          {hasAction && (
            <AiConfirmCard
              messageId={message.id}
              metadata={
                message.metadata as {
                  action_type: string;
                  action_input: Record<string, unknown>;
                  status: "pending" | "confirmed" | "cancelled";
                  result_id?: string;
                  result_number?: string;
                }
              }
            />
          )}
        </div>

        <div
          className={cn(
            "mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground",
            isOwn ? "flex-row-reverse" : "flex-row",
          )}
        >
          <span>{formatTime(message.created_at)}</span>
          {message.edited_at && <span className="italic">(edited)</span>}
        </div>

        {/* Reactions */}
        {!isAi && <ReactionBar messageId={message.id} />}
      </div>
    </div>
  );
}
