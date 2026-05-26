"use client";

import Link from "next/link";
import { EmptyState, Loading, PageHeader, Pill } from "@/components/ui";
import { useSeason } from "@/lib/season-context";
import { playerRawRoundPoints } from "@/lib/scoring";
import { completedRounds } from "@/lib/stats";
import type { Round, SeasonData } from "@/lib/types";

function topFinisher(season: SeasonData, round: Round) {
  let best: { name: string; pts: number } | null = null;
  for (const player of season.players) {
    const inRound =
      round.format === "scramble"
        ? round.teams?.some((t) => t.playerIds.includes(player.id))
        : round.playerScores.some((p) => p.playerId === player.id);
    if (!inRound) continue;
    const pts = playerRawRoundPoints(round, player.id);
    if (!best || pts > best.pts) best = { name: player.name, pts };
  }
  return best;
}

export default function HistoryPage() {
  const { season, loading } = useSeason();
  if (loading || !season) return <Loading />;

  const rounds = completedRounds(season).reverse(); // newest first

  return (
    <div>
      <PageHeader title="Round History" />
      {rounds.length === 0 ? (
        <EmptyState
          title="No rounds yet"
          body="Completed rounds will appear here."
        />
      ) : (
        <div className="space-y-3">
          {rounds.map((r) => {
            const top = topFinisher(season, r);
            const fmt =
              r.format === "scramble"
                ? "Scramble"
                : r.format === "championship"
                  ? "Championship"
                  : "Individual";
            return (
              <Link key={r.id} href={`/history/view?id=${r.id}`} className="card block">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">Round {r.roundNumber}</p>
                    <p className="text-sm text-muted">
                      {r.date} · {r.nine === "front" ? "Front 9" : "Back 9"}
                    </p>
                  </div>
                  <div className="text-right">
                    <Pill
                      tone={
                        r.format === "championship"
                          ? "gold"
                          : r.format === "scramble"
                            ? "navy"
                            : "default"
                      }
                    >
                      {fmt}
                    </Pill>
                    {top && (
                      <p className="mt-1 text-xs text-muted">
                        Top: {top.name} ({top.pts})
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
