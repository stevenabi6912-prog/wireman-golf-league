"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_NOTE_LENGTH, clampNote } from "@/lib/notes";

/** Editable round note: autosaves 2s after the last keystroke and on blur. */
export function NotesEditor({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (note: string) => void;
}) {
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function scheduleSave(value: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSave(value), 2000);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = clampNote(e.target.value);
    setText(value);
    scheduleSave(value);
  }

  function handleBlur() {
    if (timer.current) clearTimeout(timer.current);
    onSave(clampNote(text));
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={MAX_NOTE_LENGTH}
        rows={3}
        placeholder="Add a note about this round…"
        className="surface w-full rounded-xl border px-4 py-3 text-base"
        style={{ borderColor: "var(--border)" }}
      />
      <p className="mt-1 text-right text-xs text-muted">
        {text.length}/{MAX_NOTE_LENGTH} · saves automatically
      </p>
    </div>
  );
}

/** Read-only note card for screens like History. */
export function NotesCard({ note }: { note: string }) {
  if (!note.trim()) return null;
  return (
    <div className="card whitespace-pre-wrap text-sm" style={{ borderColor: "var(--gold)" }}>
      {note}
    </div>
  );
}
