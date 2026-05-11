"use client";

import { useEffect, useRef } from "react";
import { useMessages } from "@/lib/realtime/use-messages";
import { useReadTracking } from "@/lib/realtime/use-read-tracking";
import { MessageBubble } from "./message-bubble";
import { Composer } from "./composer";
import { useLocale } from "@/lib/i18n/locale-context";
import type { MessageRow, RoomDetail } from "@/lib/queries/room";

type Props = {
  room: RoomDetail;
  initialMessages: MessageRow[];
  currentUserId: string;
};

export function ChatView({ room, initialMessages, currentUserId }: Props) {
  const { messages, sendMessage, sending, loadMore, loadingMore, hasMore } =
    useMessages(room.id, initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(initialMessages.length);
  const { t } = useLocale();

  // Mark latest message as read
  const latestMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  useReadTracking(room.id, latestMessageId);

  // Auto-scroll to bottom on new messages (not on load-more)
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const added = messages.length - prevLengthRef.current;
      // Only auto-scroll if new messages were appended (not prepended via loadMore)
      if (added > 0 && added < 5) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on initial mount
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  // Infinite scroll: load more when scrolling to top
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (el.scrollTop < 100 && hasMore && !loadingMore) {
        const oldHeight = el.scrollHeight;
        loadMore().then(() => {
          // Restore scroll position after prepending older messages
          requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight - oldHeight;
          });
        });
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingMore, loadMore]);

  return (
    <div className="flex h-full flex-col">
      {/* Room header */}
      <div className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{room.name}</h2>
          <p className="text-xs text-muted-foreground">
            {room.members.filter((m) => !m.isAi).length} {t("chat.members")}
          </p>
        </div>
        <RoomKindBadge kind={room.kind} />
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-muted-foreground">{t("chat.loading")}</span>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{t("chat.firstMessage")}</p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null;
              const showSender = !prev || prev.sender_id !== msg.sender_id;
              const showDate = !prev || !isSameDay(prev.created_at, msg.created_at);

              return (
                <div key={msg.id}>
                  {showDate && <DateSeparator date={msg.created_at} t={t} />}
                  <MessageBubble
                    message={msg}
                    isOwn={msg.sender_id === currentUserId}
                    showSender={showSender || showDate}
                  />
                </div>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <Composer onSend={sendMessage} sending={sending} />
    </div>
  );
}

// --- Helpers ---

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function DateSeparator({ date, t }: { date: string; t: (key: "chat.today" | "chat.yesterday") => string }) {
  const d = new Date(date);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  let label: string;
  if (isSameDay(date, now.toISOString())) {
    label = t("chat.today");
  } else if (isSameDay(date, yesterday.toISOString())) {
    label = t("chat.yesterday");
  } else {
    label = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function RoomKindBadge({ kind }: { kind: "client" | "internal" | "dm" }) {
  const colors = {
    client: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    internal: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    dm: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${colors[kind]}`}>
      {kind}
    </span>
  );
}
