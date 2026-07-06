"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useTransferStore } from "@/lib/stores/transfer-store";

export function ActivityLog() {
  const activity = useTransferStore((s) => s.activity);

  return (
    <div className="max-h-48 overflow-y-auto rounded-xl border border-border/40 bg-card/40 p-3 text-xs">
      <AnimatePresence initial={false}>
        {activity.length === 0 ? (
          <p className="text-muted-foreground">&gt; —</p>
        ) : (
          activity.map((entry) => (
            <motion.p
              key={entry.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={
                entry.level === "error"
                  ? "text-destructive"
                  : entry.level === "warn"
                    ? "text-accent"
                    : "text-muted-foreground"
              }
            >
              &gt; {entry.message}
            </motion.p>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}
