"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const EMOJI_LIST = ["👍", "❤️", "✅", "👀", "🎉", "🤔"];

type ReactionCounts = Record<string, { count: number; reacted: boolean }>;

export function ReactionBar({ messageId }: { messageId: string }) {
  const [reactions, setReactions] = useState<ReactionCounts>({});
  const [showPicker, setShowPicker] = useState(false);

  const loadReactions = useCallback(async () => {
    const res = await fetch(`/api/messages/${messageId}/reactions`);
    if (res.ok) {
      const data = await res.json();
      setReactions(data.reactions ?? {});
    }
  }, [messageId]);

  useEffect(() => {
    loadReactions();
  }, [loadReactions]);

  const toggleReaction = async (emoji: string) => {
    // Optimistic update
    setReactions((prev) => {
      const current = prev[emoji] ?? { count: 0, reacted: false };
      return {
        ...prev,
        [emoji]: {
          count: current.reacted
            ? Math.max(0, current.count - 1)
            : current.count + 1,
          reacted: !current.reacted,
        },
      };
    });
    setShowPicker(false);

    await fetch(`/api/messages/${messageId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });

    // Refresh to get accurate count
    loadReactions();
  };

  const activeReactions = Object.entries(reactions).filter(
    ([, v]) => v.count > 0,
  );

  return (
    <div className="mt-1 flex items-center gap-1">
      {activeReactions.map(([emoji, { count, reacted }]) => (
        <button
          key={emoji}
          onClick={() => toggleReaction(emoji)}
          className={cn(
            "flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
            reacted
              ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
              : "border-transparent hover:bg-accent",
          )}
        >
          <span>{emoji}</span>
          {count > 1 && (
            <span className="text-[10px] text-muted-foreground">{count}</span>
          )}
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover/bubble:opacity-100 hover:bg-accent"
        >
          +
        </button>
        {showPicker && (
          <div className="absolute bottom-full start-0 z-10 mb-1 flex gap-0.5 rounded-lg border bg-card p-1 shadow-lg">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className="rounded p-1 text-sm hover:bg-accent"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
