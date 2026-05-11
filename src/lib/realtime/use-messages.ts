"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MessageRow } from "@/lib/queries/room";

type RealtimePayload = {
  new: {
    id: string;
    room_id: string;
    sender_id: string;
    kind: MessageRow["kind"];
    body: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    reply_to_id?: string | null;
    edited_at?: string | null;
    deleted_at?: string | null;
  };
  old?: { id: string };
};

/**
 * Client-side hook that manages message state for a room:
 * - Initialises with server-fetched messages
 * - Subscribes to Supabase Realtime INSERT + UPDATE events
 * - Provides sendMessage() with optimistic insert
 * - Provides loadMore() for cursor-based pagination
 */
export function useMessages(roomId: string, initial: MessageRow[]) {
  const [messages, setMessages] = useState<MessageRow[]>(initial);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initial.length >= 50);
  const membersCache = useRef<Map<string, MessageRow["sender"]>>(new Map());
  const currentUserRef = useRef<{ id: string; sender: MessageRow["sender"] } | null>(null);

  // Seed cache with initial senders
  useEffect(() => {
    initial.forEach((m) => membersCache.current.set(m.sender_id, m.sender));
  }, [initial]);

  // Subscribe to realtime inserts + updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload: RealtimePayload) => {
          const row = payload.new;

          setMessages((prev) => {
            // Replace optimistic message with server version
            const optimisticIdx = prev.findIndex(
              (m) => m.id.startsWith("optimistic-") && m.sender_id === row.sender_id && m.body === row.body
            );
            if (optimisticIdx >= 0) {
              const updated = [...prev];
              updated[optimisticIdx] = {
                ...updated[optimisticIdx],
                id: row.id,
                created_at: row.created_at,
                metadata: row.metadata ?? {},
              };
              return updated;
            }

            // Skip if already exists
            if (prev.some((m) => m.id === row.id)) return prev;

            // Resolve sender from cache
            let sender = membersCache.current.get(row.sender_id);
            if (!sender) {
              supabase
                .from("users")
                .select("id, full_name, role, is_ai")
                .eq("id", row.sender_id)
                .single()
                .then(({ data }) => {
                  if (data) {
                    const s = {
                      id: data.id,
                      full_name: data.full_name,
                      role: data.role as string,
                      is_ai: data.is_ai,
                    };
                    membersCache.current.set(row.sender_id, s);
                    setMessages((msgs) =>
                      msgs.map((m) =>
                        m.id === row.id ? { ...m, sender: s } : m,
                      ),
                    );
                  }
                });
              sender = {
                id: row.sender_id,
                full_name: "...",
                role: "internal",
                is_ai: false,
              };
            }

            return [
              ...prev,
              {
                id: row.id,
                room_id: row.room_id,
                sender_id: row.sender_id,
                kind: row.kind,
                body: row.body,
                metadata: row.metadata ?? {},
                created_at: row.created_at,
                reply_to_id: row.reply_to_id,
                edited_at: row.edited_at,
                deleted_at: row.deleted_at,
                sender,
              },
            ];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload: RealtimePayload) => {
          const row = payload.new;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    body: row.body,
                    metadata: row.metadata ?? m.metadata,
                    edited_at: row.edited_at,
                    deleted_at: row.deleted_at,
                  }
                : m,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const sendMessage = useCallback(
    async (body: string, replyToId?: string | null) => {
      if (!body.trim() || sending) return;
      setSending(true);

      // Optimistic insert: show message immediately
      const optimisticId = `optimistic-${Date.now()}`;
      const currentUser = currentUserRef.current;
      if (currentUser) {
        const optimisticMsg: MessageRow = {
          id: optimisticId,
          room_id: roomId,
          sender_id: currentUser.id,
          kind: "text",
          body: body.trim(),
          metadata: {},
          created_at: new Date().toISOString(),
          reply_to_id: replyToId ?? null,
          sender: currentUser.sender,
        };
        setMessages((prev) => [...prev, optimisticMsg]);
      }

      try {
        const payload: Record<string, unknown> = { room_id: roomId, body };
        if (replyToId) payload.reply_to_id = replyToId;

        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          console.error("Send failed:", err);
          // Remove optimistic message on failure
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        }
      } catch {
        // Remove optimistic message on network error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } finally {
        setSending(false);
      }
    },
    [roomId, sending],
  );

  // Set current user info for optimistic sends
  const setCurrentUser = useCallback(
    (userId: string) => {
      const cached = membersCache.current.get(userId);
      if (cached) {
        currentUserRef.current = { id: userId, sender: cached };
      }
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const res = await fetch(
        `/api/messages?room_id=${roomId}&before=${oldest.created_at}&limit=50`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const older: MessageRow[] = data.messages ?? [];
      setHasMore(data.hasMore ?? false);
      if (older.length > 0) {
        older.forEach((m: MessageRow) => membersCache.current.set(m.sender_id, m.sender));
        setMessages((prev) => [...older, ...prev]);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, messages, loadingMore, hasMore]);

  return { messages, sendMessage, sending, loadMore, loadingMore, hasMore, setCurrentUser };
}
