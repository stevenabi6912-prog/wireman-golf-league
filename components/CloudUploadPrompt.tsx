"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSeason } from "@/lib/season-context";

/**
 * First-launch migration: when signed into a configured backend but the season
 * hasn't been pushed to the cloud yet (no familyId) and local rounds exist,
 * offer a one-tap upload.
 */
export default function CloudUploadPrompt() {
  const { configured, session } = useAuth();
  const { season, uploadLocalToCloud } = useSeason();
  const [busy, setBusy] = useState(false);

  if (!configured || !session || !season) return null;
  if (season.familyId || season.rounds.length === 0) return null;

  return (
    <div className="card mb-4" style={{ borderColor: "var(--gold)" }}>
      <p className="font-bold" style={{ color: "var(--gold)" }}>
        Move this season to the cloud
      </p>
      <p className="mt-1 text-sm text-muted">
        {season.rounds.length} round
        {season.rounds.length === 1 ? "" : "s"} are stored only on this phone.
        Upload them so both phones stay in sync.
      </p>
      <button
        className="btn btn-gold mt-3 w-full py-2.5"
        disabled={busy}
        style={busy ? { opacity: 0.6 } : undefined}
        onClick={async () => {
          setBusy(true);
          try {
            await uploadLocalToCloud();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Uploading…" : "Upload existing season"}
      </button>
    </div>
  );
}
