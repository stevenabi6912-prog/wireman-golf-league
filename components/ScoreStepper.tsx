"use client";

import { ClassificationBadge } from "@/components/ui";
import type { ScoredHole } from "@/lib/scoring";

/**
 * Big one-handed stroke counter for a single player/team on a hole.
 * The +/- targets are 56px — comfortably above the 44px minimum.
 * Strokes are unbounded upward (no max-strokes cap).
 */
export default function ScoreStepper({
  title,
  subtitle,
  pp,
  strokes,
  scored,
  onIncrement,
  onDecrement,
}: {
  title: string;
  subtitle?: string;
  pp: number;
  strokes: number | null;
  scored: ScoredHole;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className="card">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-lg font-bold leading-tight">{title}</p>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">PP {pp}</p>
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
          className="btn btn-outline h-14 w-16 text-3xl"
        >
          −
        </button>

        <div className="flex min-w-[64px] flex-col items-center">
          <span className="text-4xl font-extrabold tabular-nums">
            {strokes ?? "–"}
          </span>
          <span className="text-xs text-muted">strokes</span>
        </div>

        <button
          aria-label={`Increase strokes for ${title}`}
          onClick={onIncrement}
          className="btn btn-primary h-14 w-16 text-3xl"
        >
          +
        </button>
      </div>
    </div>
  );
}
