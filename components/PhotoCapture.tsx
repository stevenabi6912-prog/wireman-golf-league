"use client";

import { useRef, useState } from "react";
import { useSeason } from "@/lib/season-context";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/** Camera/picker button that compresses and uploads a hole or round photo. */
export default function PhotoCapture({
  roundId,
  hole,
  playerId = null,
  label = "Add photo",
}: {
  roundId: string;
  hole: number | null;
  playerId?: string | null;
  label?: string;
}) {
  const { addPhoto } = useSeason();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // Photos need Supabase storage; hide the control in local-only mode.
  if (!isSupabaseConfigured()) return null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (ref.current) ref.current.value = "";
    if (!file) return;
    setBusy(true);
    setError(false);
    try {
      await addPhoto({ roundId, hole, playerId, file });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="btn btn-outline w-full py-2.5 text-sm"
        style={busy ? { opacity: 0.6 } : undefined}
      >
        {busy ? "Uploading…" : error ? "Upload failed — retry" : `📷 ${label}`}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
    </>
  );
}
