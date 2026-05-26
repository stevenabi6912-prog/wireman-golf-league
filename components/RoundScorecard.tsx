"use client";

import type { HoleClassification, ScoredHole } from "@/lib/scoring";
import {
  countClassification,
  isDoublePointsFormat,
  scorePlayerHoles,
  scoreTeamHoles,
  sumPoints,
} from "@/lib/scoring";
import { Pill } from "@/components/ui";
import type { Round, SeasonData } from "@/lib/types";

const CELL_BG: Record<HoleClassification, string> = {
  eagle: "#B45309",
  birdie: "#14532D",
  par: "#1E3A5F",
  bogey: "var(--surface-2)",
  other: "var(--surface-2)",
  none: "transparent",
};
const CELL_FG: Record<HoleClassification, string> = {
  eagle: "#fff",
  birdie: "#fff",
  par: "#fff",
  bogey: "var(--text)",
  other: "var(--text-muted)",
  none: "var(--text-muted)",
};

function HoleStrip({ scored }: { scored: ScoredHole[] }) {
  return (
    <div className="mt-2 grid grid-cols-9 gap-1">
      {scored.map((h, i) => (
        <div key={i} className="text-center">
          <div className="text-[10px] text-muted">{i + 1}</div>
          <div
            className="flex h-8 items-center justify-center rounded text-sm font-bold tabular-nums"
            style={{
              backgroundColor: CELL_BG[h.classification],
              color: CELL_FG[h.classification],
              border:
                h.classification === "bogey" || h.classification === "other"
                  ? "1px solid var(--border)"
                  : "none",
            }}
          >
            {h.strokes ?? "–"}
          </div>
        </div>
      ))}
    </div>
  );
}

function Totals({
  scored,
  doubled,
}: {
  scored: ScoredHole[];
  doubled: boolean;
}) {
  const raw = sumPoints(scored);
  const eagles = countClassification(scored, "eagle");
  const birdies = countClassification(scored, "birdie");
  return (
    <div className="flex items-center gap-2">
      {eagles > 0 && <Pill tone="gold">{eagles} 🦅</Pill>}
      {birdies > 0 && <Pill tone="forest">{birdies} birdie{birdies > 1 ? "s" : ""}</Pill>}
      <span className="ml-auto text-right">
        <span className="text-2xl font-extrabold tabular-nums">
          {doubled ? raw * 2 : raw}
        </span>
        <span className="ml-1 text-sm text-muted">pts</span>
        {doubled && (
          <span className="ml-2 align-middle">
            <Pill tone="gold">×2 ({raw})</Pill>
          </span>
        )}
      </span>
    </div>
  );
}

export default function RoundScorecard({
  season,
  round,
  bestRoundPlayerIds = new Set(),
}: {
  season: SeasonData;
  round: Round;
  /** Players for whom this round is their best of the season. */
  bestRoundPlayerIds?: Set<string>;
}) {
  const doubled = isDoublePointsFormat(round.format);

  if (round.format === "scramble") {
    const rows = (round.teamScores ?? [])
      .map((ts) => {
        const team = round.teams?.find((t) => t.id === ts.teamId);
        const names = (team?.playerIds ?? [])
          .map((id) => season.players.find((p) => p.id === id)?.name)
          .filter(Boolean)
          .join(" & ");
        const scored = scoreTeamHoles(round, ts);
        return { ts, names, scored, total: sumPoints(scored) };
      })
      .sort((a, b) => b.total - a.total);

    return (
      <div className="space-y-3">
        {rows.map(({ ts, names, scored }, i) => (
          <div key={ts.teamId} className="card">
            <div className="flex items-center justify-between">
              <p className="font-bold">
                <span className="mr-2 text-muted">{i + 1}.</span>
                {names}
              </p>
            </div>
            <HoleStrip scored={scored} />
            <div className="mt-2">
              <Totals scored={scored} doubled={doubled} />
            </div>
          </div>
        ))}
        <p className="text-center text-xs text-muted">
          Both teammates earn the team total toward the season.
        </p>
      </div>
    );
  }

  const rows = round.playerScores
    .map((ps) => {
      const player = season.players.find((p) => p.id === ps.playerId)!;
      const scored = scorePlayerHoles(round, ps);
      return { ps, player, scored, total: sumPoints(scored) };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-3">
      {rows.map(({ ps, player, scored }, i) => (
        <div key={ps.playerId} className="card">
          <div className="flex items-center justify-between">
            <p className="font-bold">
              <span className="mr-2 text-muted">{i + 1}.</span>
              {player.name}
              <span className="ml-2 text-xs text-muted">
                HCP {ps.handicap === 0 ? "0" : `+${ps.handicap}`}
              </span>
            </p>
            {bestRoundPlayerIds.has(ps.playerId) && (
              <Pill tone="gold">Best round ⭐</Pill>
            )}
          </div>
          <HoleStrip scored={scored} />
          <div className="mt-2">
            <Totals scored={scored} doubled={doubled} />
          </div>
        </div>
      ))}
    </div>
  );
}
