"use client";

import { cn } from "@/lib/utils";
import type { MessageRow } from "@/lib/queries/room";

type Props = {
  message: MessageRow;
  isOwn: boolean;
  showSender: boolean; // false when consecutive messages from same sender
};

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

export function MessageBubble({ message, isOwn, showSender }: Props) {
  const isAi = message.sender.is_ai;
  const isSystem = message.kind === "system";

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

  return (
    <div
      className={cn(
        "flex gap-2",
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
      <div className={cn("max-w-[75%] min-w-0", isOwn ? "items-end" : "items-start")}>
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
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        </div>

        <span
          className={cn(
            "mt-0.5 block text-[10px] text-muted-foreground",
            isOwn ? "text-right" : "text-left",
          )}
        >
          {formatTime(message.created_at)}
        </span>
      </div>
    </div>
  );
}
