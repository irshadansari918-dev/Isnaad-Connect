"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Receipt = {
  user_id: string;
  full_name: string;
  role: string;
  last_read_message_id: string | null;
};

/**
 * Shows read receipt avatars under a message.
 * Displays small initials of users who have read up to this message.
 */
export function ReadReceipts({
  roomId,
  messageId,
}: {
  roomId: string;
  messageId: string;
}) {
  const [readers, setReaders] = useState<Receipt[]>([]);

  const loadReceipts = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/receipts`);
      if (res.ok) {
        const data = await res.json();
        // Filter to users who have read at least up to this message
        setReaders(
          (data.receipts ?? []).filter(
            (r: Receipt) => r.last_read_message_id === messageId,
          ),
        );
      }
    } catch {
      // Silently ignore
    }
  }, [roomId, messageId]);

  useEffect(() => {
    loadReceipts();
    // Refresh periodically
    const interval = setInterval(loadReceipts, 15000);
    return () => clearInterval(interval);
  }, [loadReceipts]);

  if (readers.length === 0) return null;

  return (
    <div className="mt-0.5 flex items-center gap-0.5 justify-end">
      {readers.slice(0, 5).map((r) => (
        <div
          key={r.user_id}
          title={`Read by ${r.full_name}`}
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-medium text-white",
            r.role === "am" ? "bg-blue-400" : r.role === "admin" ? "bg-purple-400" : "bg-slate-400",
          )}
        >
          {r.full_name.charAt(0)}
        </div>
      ))}
      {readers.length > 5 && (
        <span className="text-[9px] text-muted-foreground">
          +{readers.length - 5}
        </span>
      )}
    </div>
  );
}
