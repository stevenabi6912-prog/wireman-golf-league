"use client";

import { useState } from "react";
import { useSeason } from "@/lib/season-context";

const META: Record<
  string,
  { color: string; label: (n: number) => string }
> = {
  synced: { color: "#16a34a", label: () => "Synced" },
  syncing: { color: "#ca8a04", label: (n) => `Syncing… (${n} pending)` },
  offline: { color: "#9ca3af", label: (n) => `Offline — ${n} pending` },
  local: { color: "#9ca3af", label: () => "Local only" },
};

export default function SyncStatus() {
  const { syncStatus, pendingOps } = useSeason();
  const [open, setOpen] = useState(false);

  // In local-only mode there's nothing to sync — keep the chrome clean.
  if (syncStatus.state === "local") return null;

  const meta = META[syncStatus.state];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 py-1.5 text-xs font-semibold"
        style={{ backgroundColor: "var(--surface-2)", color: "var(--text-muted)" }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: meta.color }}
        />
        {meta.label(syncStatus.pending)}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card max-h-[70vh] w-full max-w-md overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 text-lg font-bold">Sync queue</h2>
            <p className="text-sm text-muted">
              {syncStatus.pending} pending write
              {syncStatus.pending === 1 ? "" : "s"} · {meta.label(syncStatus.pending)}
            </p>
            <pre className="surface-2 mt-3 overflow-auto rounded-xl p-3 text-xs">
              {JSON.stringify(pendingOps(), null, 2) || "[]"}
            </pre>
            <button
              className="btn btn-outline mt-3 w-full py-2"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
