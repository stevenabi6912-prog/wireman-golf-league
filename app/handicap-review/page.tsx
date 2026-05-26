"use client";

import Link from "next/link";
import { EmptyState, Loading, PageHeader, Pill } from "@/components/ui";
import { useSeason } from "@/lib/season-context";
import {
  HANDICAP_LOOSEN_THRESHOLD,
  HANDICAP_TIGHTEN_THRESHOLD,
} from "@/lib/scoring";
import {
  completedRounds,
  handicapReview,
  latestCompletedRound,
  type HandicapReviewRow,
} from "@/lib/stats";

function formatHandicap(h: number): string {
  return h === 0 ? "0" : `+${h}`;
}

/** "Round 1" or "Rounds 1, 2" describing the window. */
function windowLabel(rounds: number[]): string {
  if (rounds.length === 0) return "no rounds yet";
  if (rounds.length === 1) return `Round ${rounds[0]}`;
  return `Rounds ${rounds.join(", ")}`;
}

export default function HandicapReviewPage() {
  const { season, loading, applyHandicapChange } = useSeason();
  if (loading || !season) return <Loading />;

  const done = completedRounds(season);
  if (done.length === 0) {
    return (
      <div>
        <PageHeader title="Handicap Review" back={{ href: "/", label: "Home" }} />
        <EmptyState
          title="No rounds played yet"
          body="Reviews run after rounds 1, 2, 3, 6, and 9."
        />
      </div>
    );
  }

  const currentRoundNumber = latestCompletedRound(season);
  const rows = handicapReview(season);

  const appliedFor = (playerId: string) =>
    season.handicapChanges.find(
      (c) => c.playerId === playerId && c.afterRound === currentRoundNumber,
    );

  return (
    <div>
      <PageHeader
        title="Handicap Review"
        subtitle={`After Round ${currentRoundNumber}`}
        back={{ href: "/", label: "Home" }}
      />

      <div className="card mb-4 text-sm text-muted">
        Window average over {HANDICAP_TIGHTEN_THRESHOLD} pts → tighten by 1.
        Below {HANDICAP_LOOSEN_THRESHOLD} → loosen by 1. Applying a change starts
        a fresh window from the next round; past rounds keep their scores.
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <ReviewCard
            key={row.player.id}
            row={row}
            applied={Boolean(appliedFor(row.player.id))}
            onApply={() =>
              applyHandicapChange(
                row.player.id,
                row.proposedHandicap,
                currentRoundNumber,
              )
            }
          />
        ))}
      </div>

      <Link href="/" className="btn btn-outline mt-5 w-full py-3">
        Done
      </Link>
    </div>
  );
}

function ReviewCard({
  row,
  applied,
  onApply,
}: {
  row: HandicapReviewRow;
  applied: boolean;
  onApply: () => void;
}) {
  const { player, windowRounds, windowPoints, roundsPlayed, avgPoints } = row;

  // "Based on Round 1 score: 30 pts → tighten to +3"
  const basis =
    roundsPlayed === 0
      ? "No rounds in the current window yet."
      : roundsPlayed === 1
        ? `Based on ${windowLabel(windowRounds)} score: ${windowPoints} pts`
        : `Based on ${windowLabel(windowRounds)}: ${avgPoints.toFixed(1)} avg (${windowPoints} pts)`;

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <p className="font-bold">{player.name}</p>
        <SuggestionPill suggestion={row.suggestion} />
      </div>
      <p className="mt-0.5 text-sm text-muted">{basis}</p>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-bold tabular-nums">
          <span>{formatHandicap(row.currentHandicap)}</span>
          {row.suggestion !== "none" && (
            <>
              <span className="text-muted">→</span>
              <span style={{ color: "var(--gold)" }}>
                {formatHandicap(row.proposedHandicap)}
              </span>
            </>
          )}
        </div>

        {applied ? (
          <Pill tone="forest">Applied ✓</Pill>
        ) : row.suggestion === "none" ? (
          <span className="text-sm text-muted">No change needed</span>
        ) : (
          <button className="btn btn-primary px-5 py-2" onClick={onApply}>
            Apply
          </button>
        )}
      </div>
    </div>
  );
}

function SuggestionPill({
  suggestion,
}: {
  suggestion: "tighten" | "loosen" | "none";
}) {
  if (suggestion === "tighten") return <Pill tone="gold">Tighten −1</Pill>;
  if (suggestion === "loosen") return <Pill tone="navy">Loosen +1</Pill>;
  return <Pill>Steady</Pill>;
}
