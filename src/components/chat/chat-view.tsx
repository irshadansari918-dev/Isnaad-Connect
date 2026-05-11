"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useMessages } from "@/lib/realtime/use-messages";
import { useReadTracking } from "@/lib/realtime/use-read-tracking";
import { useTyping } from "@/lib/realtime/use-typing";
import { MessageBubble } from "./message-bubble";
import { Composer } from "./composer";
import { ReadReceipts } from "./read-receipts";
import { useLocale } from "@/lib/i18n/locale-context";
import type { MessageRow, RoomDetail } from "@/lib/queries/room";

type ReplyState = {
  messageId: string;
  senderName: string;
  body: string;
} | null;

type Props = {
  room: RoomDetail;
  initialMessages: MessageRow[];
  currentUserId: string;
  userRole?: string;
};

export function ChatView({ room, initialMessages, currentUserId, userRole = "client" }: Props) {
  const { messages, sendMessage, sending, loadMore, loadingMore, hasMore, setCurrentUser } =
    useMessages(room.id, initialMessages);
  const [replyTo, setReplyTo] = useState<ReplyState>(null);
  const [roomSearch, setRoomSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(initialMessages.length);
  const { t } = useLocale();

  // Resolve current user's name from room members
  const currentUserName = room.members.find((m) => m.userId === currentUserId)?.fullName ?? "User";
  const { typingUsers, startTyping, stopTyping } = useTyping(room.id, currentUserId, currentUserName);

  // Enable optimistic sends by providing current user info
  useEffect(() => {
    setCurrentUser(currentUserId);
  }, [currentUserId, setCurrentUser]);

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

  // In-room search: compute matching message IDs
  const searchTerm = roomSearch.trim().toLowerCase();
  const searchMatchIds = useMemo(() => {
    if (searchTerm.length < 2) return null;
    return new Set(messages.filter((m) => m.body?.toLowerCase().includes(searchTerm)).map((m) => m.id));
  }, [searchTerm, messages]);

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
        <div className="flex items-center gap-2">
          {roomSearch !== "" ? (
            <div className="flex items-center gap-1 rounded-md border bg-background px-2 py-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                placeholder={t("chat.searchInRoom")}
                className="w-32 bg-transparent text-xs outline-none"
                autoFocus
              />
              <button onClick={() => setRoomSearch("")} className="rounded p-0.5 hover:bg-accent">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRoomSearch(" ")}
              className="rounded-md p-1.5 hover:bg-accent"
              title={t("chat.searchInRoom")}
            >
              <Search className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <RoomKindBadge kind={room.kind} />
        </div>
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

              // Resolve reply preview
              let replyPreview = null;
              if (msg.reply_to_id) {
                const parent = messages.find((m) => m.id === msg.reply_to_id);
                if (parent) {
                  replyPreview = {
                    senderName: parent.sender.full_name,
                    body: parent.body ?? "",
                  };
                }
              }

              const isSearchMatch = searchMatchIds?.has(msg.id) ?? false;
              // If searching, dim non-matching messages
              const dimmed = searchMatchIds !== null && !isSearchMatch;

              return (
                <div key={msg.id} className={dimmed ? "opacity-30" : ""}>
                  {showDate && <DateSeparator date={msg.created_at} t={t} />}
                  <MessageBubble
                    message={msg}
                    isOwn={msg.sender_id === currentUserId}
                    isAdmin={userRole === "admin"}
                    showSender={showSender || showDate}
                    replyPreview={replyPreview}
                    highlight={isSearchMatch}
                    onReply={(id) => {
                      const m = messages.find((x) => x.id === id);
                      if (m) setReplyTo({ messageId: id, senderName: m.sender.full_name, body: m.body ?? "" });
                    }}
                    onEdit={async (id) => {
                      const newBody = prompt("Edit message:");
                      if (newBody !== null && newBody.trim()) {
                        await fetch(`/api/messages/${id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ body: newBody.trim() }),
                        });
                      }
                    }}
                    onDelete={async (id) => {
                      if (confirm("Delete this message?")) {
                        await fetch(`/api/messages/${id}`, { method: "DELETE" });
                      }
                    }}
                  />
                </div>
              );
            })}
          </>
        )}
        {/* Read receipts — show under the last message from the current user */}
        {messages.length > 0 && messages[messages.length - 1].sender_id === currentUserId && (
          <ReadReceipts roomId={room.id} messageId={messages[messages.length - 1].id} />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1">
          <p className="text-xs text-muted-foreground animate-pulse">
            {typingUsers.length === 1
              ? `${typingUsers[0].fullName} ${t("chat.typing")}`
              : `${typingUsers.map((u) => u.fullName).join(", ")} ${t("chat.typingPlural")}`}
          </p>
        </div>
      )}

      {/* Composer */}
      <Composer
        onSend={sendMessage}
        sending={sending}
        roomId={room.id}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onTyping={startTyping}
        onStopTyping={stopTyping}
      />
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
