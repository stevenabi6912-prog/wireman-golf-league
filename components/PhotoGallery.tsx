"use client";

import { useState } from "react";
import { useSeason } from "@/lib/season-context";
import type { Photo } from "@/lib/types";

/** Thumbnails grouped by hole, with a tap-to-zoom + caption editor. */
export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [active, setActive] = useState<Photo | null>(null);
  if (photos.length === 0) return null;

  const byHole = new Map<number, Photo[]>();
  for (const p of photos) {
    const k = p.hole ?? 0;
    (byHole.get(k) ?? byHole.set(k, []).get(k)!).push(p);
  }
  const holes = [...byHole.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-3">
      {holes.map((h) => (
        <div key={h}>
          <p className="mb-1 text-xs font-semibold text-muted">
            {h === 0 ? "Round" : `Hole ${h}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {byHole.get(h)!.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.url}
                alt={p.caption ?? `Hole ${h} photo`}
                onClick={() => setActive(p)}
                className="h-20 w-20 cursor-pointer rounded-lg object-cover"
              />
            ))}
          </div>
        </div>
      ))}

      {active && (
        <PhotoViewer photo={active} onClose={() => setActive(null)} />
      )}
    </div>
  );
}

function PhotoViewer({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const { updatePhotoCaption, deletePhoto } = useSeason();
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(photo.caption ?? "");

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption ?? "Round photo"}
          className="max-h-[60vh] w-full rounded-xl object-contain"
        />
        {editing ? (
          <div className="mt-2 flex gap-2">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption"
              className="surface flex-1 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
            <button
              className="btn btn-primary px-4"
              onClick={() => {
                updatePhotoCaption(photo.id, caption);
                setEditing(false);
              }}
            >
              Save
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between text-white">
            <p className="text-sm">{photo.caption || "No caption"}</p>
            <button
              className="text-sm font-semibold underline"
              onClick={() => setEditing(true)}
            >
              Edit caption
            </button>
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button className="btn btn-outline flex-1 py-2" onClick={onClose}>
            Close
          </button>
          <button
            className="btn flex-1 py-2"
            style={{ backgroundColor: "#b91c1c", color: "#fff" }}
            onClick={() => {
              deletePhoto(photo.id);
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
