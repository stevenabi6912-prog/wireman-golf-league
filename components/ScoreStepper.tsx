"use client";

import { ClassificationBadge } from "@/components/ui";
import type { ScoredHole } from "@/lib/scoring";

/**
 * Big one-handed stroke counter for a single player/team on a hole.
 * The +/- targets are 56px — comfortably above the 44px minimum.
 */
export default function ScoreStepper({
  title,
  subtitle,
  pp,
  maxStrokes,
  strokes,
  pickedUp,
  scored,
  onIncrement,
  onDecrement,
  onTogglePickup,
}: {
  title: string;
  subtitle?: string;
  pp: number;
  maxStrokes: number;
  strokes: number | null;
  pickedUp: boolean;
  scored: ScoredHole;
  onIncrement: () => void;
  onDecrement: () => void;
  onTogglePickup: () => void;
}) {
  const display = pickedUp ? maxStrokes : strokes;
  return (
    <div className="card">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-lg font-bold leading-tight">{title}</p>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">
            PP {pp} · max {maxStrokes}
          </p>
          <div className="mt-1">
            {scored.entered ? (
              <ClassificationBadge
                classification={scored.classification}
                points={scored.points}
              />
            ) : (
              <span className="text-xs text-muted">not scored</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          aria-label={`Decrease strokes for ${title}`}
          onClick={onDecrement}
          disabled={pickedUp}
          className="btn btn-outline h-14 w-16 text-3xl"
          style={pickedUp ? { opacity: 0.4 } : undefined}
        >
          −
        </button>

        <div className="flex min-w-[64px] flex-col items-center">
          <span className="text-4xl font-extrabold tabular-nums">
            {display ?? "–"}
          </span>
          <span className="text-xs text-muted">strokes</span>
        </div>

        <button
          aria-label={`Increase strokes for ${title}`}
          onClick={onIncrement}
          disabled={pickedUp}
          className="btn btn-primary h-14 w-16 text-3xl"
          style={pickedUp ? { opacity: 0.4 } : undefined}
        >
          +
        </button>
      </div>

      <button
        onClick={onTogglePickup}
        className="btn mt-3 w-full py-2.5 text-sm"
        style={
          pickedUp
            ? { backgroundColor: "var(--gold)", color: "#fff" }
            : { backgroundColor: "var(--surface-2)", color: "var(--text)" }
        }
      >
        {pickedUp ? "Picked up ✓ (0 pts)" : "Pick up"}
      </button>
    </div>
  );
}
