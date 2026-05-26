import { describe, expect, it } from "vitest";
import { createRound } from "./round";
import { seedSeason } from "./seed";
import { handicapReview } from "./stats";
import type { Round, SeasonData } from "./types";

function par4Season(): SeasonData {
  const s = seedSeason();
  s.holes = s.holes.map((h) => ({ ...h, par: 4 }));
  return s;
}

/** A completed individual round; `scores` maps playerId -> strokes per hole. */
function playedRound(
  season: SeasonData,
  roundNumber: number,
  scores: Record<string, number>,
): Round {
  const playerIds = Object.keys(scores);
  const r = createRound(season, {
    roundNumber,
    date: `2026-01-${String(roundNumber).padStart(2, "0")}`,
    nine: "front",
    format: "individual",
    playerIds,
  });
  r.playerScores = r.playerScores.map((ps) => ({
    ...ps,
    holeScores: ps.holeScores.map((hs) => ({
      ...hs,
      strokes: scores[ps.playerId],
    })),
  }));
  return { ...r, completed: true };
}

function lazRow(season: SeasonData) {
  return handicapReview(season).find((r) => r.player.id === "lazarus")!;
}

describe("sliding-window handicap review", () => {
  it("uses only round 1 after the first round", () => {
    const season = par4Season();
    // Lazarus PP 8 (par4 + hc4); 6 strokes = eagle = 4 pts x9 = 36.
    season.rounds = [playedRound(season, 1, { lazarus: 6 })];
    const row = lazRow(season);
    expect(row.windowRounds).toEqual([1]);
    expect(row.avgPoints).toBe(36);
    expect(row.suggestion).toBe("tighten");
    expect(row.proposedHandicap).toBe(3);
  });

  it("after applying at R1, the R2 window is only round 2", () => {
    const season = par4Season();
    season.rounds = [playedRound(season, 1, { lazarus: 6 })];
    // Simulate applying the R1 suggestion (handicap 4 -> 3, effective from R2).
    const laz = season.players.find((p) => p.id === "lazarus")!;
    laz.handicap = 3;
    laz.handicapEffectiveFromRound = 2;
    // R2: PP now 7; 5 strokes = eagle.
    season.rounds.push(playedRound(season, 2, { lazarus: 5 }));

    const row = lazRow(season);
    expect(row.windowRounds).toEqual([2]); // not [1, 2]
    expect(row.roundsPlayed).toBe(1);
  });

  it("dismissing R1 leaves the R2 window spanning rounds 1 and 2", () => {
    const season = par4Season();
    // No apply between rounds -> handicapEffectiveFromRound stays 1.
    season.rounds = [
      playedRound(season, 1, { lazarus: 6 }),
      playedRound(season, 2, { lazarus: 6 }),
    ];
    const row = lazRow(season);
    expect(row.windowRounds).toEqual([1, 2]);
    expect(row.roundsPlayed).toBe(2);
    expect(row.avgPoints).toBe(36);
  });

  it("after R3 with a fresh window, considers only round 3", () => {
    const season = par4Season();
    const laz = season.players.find((p) => p.id === "lazarus")!;
    laz.handicapEffectiveFromRound = 3; // last change applied after R2
    season.rounds = [
      playedRound(season, 1, { lazarus: 6 }),
      playedRound(season, 2, { lazarus: 6 }),
      playedRound(season, 3, { lazarus: 8 }), // PP8, par = 18 pts -> steady
    ];
    const row = lazRow(season);
    expect(row.windowRounds).toEqual([3]);
    expect(row.avgPoints).toBe(18);
    expect(row.suggestion).toBe("none");
  });

  it("R6 review with effective-from 4 spans rounds 4-6", () => {
    const season = par4Season();
    const laz = season.players.find((p) => p.id === "lazarus")!;
    laz.handicapEffectiveFromRound = 4; // last change after round 3
    season.rounds = [1, 2, 3, 4, 5, 6].map((n) =>
      playedRound(season, n, { lazarus: 8 }),
    );
    const row = lazRow(season);
    expect(row.windowRounds).toEqual([4, 5, 6]);
    expect(row.roundsPlayed).toBe(3);
  });

  it("skips rounds the player did not participate in", () => {
    const season = par4Season();
    season.rounds = [
      playedRound(season, 1, { lazarus: 6, dad: 4 }),
      playedRound(season, 2, { dad: 4 }), // lazarus sat out
      playedRound(season, 3, { lazarus: 6, dad: 4 }),
    ];
    const row = lazRow(season);
    expect(row.windowRounds).toEqual([1, 3]);
    expect(row.roundsPlayed).toBe(2);
  });
});
