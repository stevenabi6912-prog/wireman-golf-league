"use client";

import Link from "next/link";
import { EmptyState, Loading, PageHeader, Pill } from "@/components/ui";
import { useSeason } from "@/lib/season-context";
import {
  HANDICAP_LOOSEN_THRESHOLD,
  HANDICAP_TIGHTEN_THRESHOLD,
  isHandicapReviewRound,
} from "@/lib/scoring";
import { completedRounds, handicapReview } from "@/lib/stats";

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
          body="Handicaps are reviewed after rounds 3, 6, and 9."
        />
      </div>
    );
  }

  const lastNum = Math.max(...done.map((r) => r.roundNumber));
  // The review round being addressed (latest 3/6/9 played, else latest round).
  const reviewRoundNum =
    [9, 6, 3].find((n) => n <= lastNum) ?? lastNum;
  const rows = handicapReview(season);

  const appliedFor = (playerId: string) =>
    season.handicapChanges.find(
      (c) => c.playerId === playerId && c.afterRound === reviewRoundNum,
    );

  return (
    <div>
      <PageHeader
        title="Handicap Review"
        subtitle={`After Round ${reviewRoundNum}`}
        back={{ href: "/", label: "Home" }}
      />

      <div className="card mb-4 text-sm text-muted">
        Average over {HANDICAP_TIGHTEN_THRESHOLD} pts/round → tighten by 1.
        Below {HANDICAP_LOOSEN_THRESHOLD} → loosen by 1. New handicaps apply to
        the next round; past rounds keep their scores.
      </div>

      {!isHandicapReviewRound(reviewRoundNum) && (
        <p className="mb-3 text-xs" style={{ color: "var(--gold)" }}>
          Note: Round {reviewRoundNum} isn&apos;t a scheduled review round —
          suggestions shown for reference.
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const applied = appliedFor(row.player.id);
          return (
            <div key={row.player.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">{row.player.name}</p>
                  <p className="text-sm text-muted">
                    Avg{" "}
                    <span className="font-semibold tabular-nums">
                      {row.roundsPlayed ? row.avgPoints.toFixed(1) : "—"}
                    </span>{" "}
                    pts · {row.roundsPlayed} round
                    {row.roundsPlayed === 1 ? "" : "s"}
                  </p>
                </div>
                <SuggestionPill suggestion={row.suggestion} />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-lg font-bold tabular-nums">
                  <span>
                    {row.currentHandicap === 0
                      ? "0"
                      : `+${row.currentHandicap}`}
                  </span>
                  {row.suggestion !== "none" && (
                    <>
                      <span className="text-muted">→</span>
                      <span style={{ color: "var(--gold)" }}>
                        {row.proposedHandicap === 0
                          ? "0"
                          : `+${row.proposedHandicap}`}
                      </span>
                    </>
                  )}
                </div>

                {applied ? (
                  <Pill tone="forest">Applied ✓</Pill>
                ) : row.suggestion === "none" ? (
                  <span className="text-sm text-muted">No change</span>
                ) : (
                  <button
                    className="btn btn-primary px-5 py-2"
                    onClick={() =>
                      applyHandicapChange(
                        row.player.id,
                        row.proposedHandicap,
                        reviewRoundNum,
                      )
                    }
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Link href="/" className="btn btn-outline mt-5 w-full py-3">
        Done
      </Link>
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
