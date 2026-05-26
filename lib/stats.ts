import {
  countClassification,
  defaultFormatForRound,
  playerRawRoundPoints,
  playerScoredHoles,
  playerSeasonRoundPoints,
  suggestHandicapChange,
  type HandicapSuggestion,
} from "./scoring";
import type { Player, Round, SeasonData } from "./types";

export const TOTAL_ROUNDS = 12;

export function completedRounds(season: SeasonData): Round[] {
  return season.rounds
    .filter((r) => r.completed)
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

/** Did the player take part in this round? */
export function playerInRound(round: Round, playerId: string): boolean {
  return round.playerIds.includes(playerId);
}

export interface StandingsRow {
  player: Player;
  totalPoints: number;
  roundsPlayed: number;
  avgPerRound: number;
  handicap: number;
  birdies: number;
  eagles: number;
}

export function standings(season: SeasonData): StandingsRow[] {
  const done = completedRounds(season);
  const rows = season.players.map((player) => {
    let totalPoints = 0;
    let roundsPlayed = 0;
    let birdies = 0;
    let eagles = 0;
    for (const round of done) {
      if (!playerInRound(round, player.id)) continue;
      roundsPlayed += 1;
      totalPoints += playerSeasonRoundPoints(round, player.id);
      const scored = playerScoredHoles(round, player.id);
      birdies += countClassification(scored, "birdie");
      eagles += countClassification(scored, "eagle");
    }
    return {
      player,
      totalPoints,
      roundsPlayed,
      avgPerRound: roundsPlayed ? totalPoints / roundsPlayed : 0,
      handicap: player.handicap,
      birdies,
      eagles,
    };
  });
  return rows.sort((a, b) => b.totalPoints - a.totalPoints);
}

/** Smallest round number 1..12 not yet completed; null when season is done. */
export function nextRoundNumber(season: SeasonData): number | null {
  const completedNums = new Set(
    completedRounds(season).map((r) => r.roundNumber),
  );
  for (let n = 1; n <= TOTAL_ROUNDS; n += 1) {
    if (!completedNums.has(n)) return n;
  }
  return null;
}

export function leader(season: SeasonData): StandingsRow | null {
  const rows = standings(season);
  return rows.length && rows[0].totalPoints > 0 ? rows[0] : null;
}

export function mostBirdies(season: SeasonData): StandingsRow | null {
  const rows = [...standings(season)].sort((a, b) => b.birdies - a.birdies);
  return rows.length && rows[0].birdies > 0 ? rows[0] : null;
}

/** Top scorer of the most recently completed round (by round number). */
export function lastRoundMvp(
  season: SeasonData,
): { player: Player; points: number; round: Round } | null {
  const done = completedRounds(season);
  if (!done.length) return null;
  const round = done[done.length - 1];
  let best: { player: Player; points: number } | null = null;
  for (const player of season.players) {
    if (!playerInRound(round, player.id)) continue;
    const pts = playerRawRoundPoints(round, player.id);
    if (!best || pts > best.points) best = { player, points: pts };
  }
  return best ? { ...best, round } : null;
}

// ---------------------------------------------------------------------------
// Handicap review
// ---------------------------------------------------------------------------

export interface HandicapReviewRow {
  player: Player;
  roundsPlayed: number;
  avgPoints: number;
  suggestion: HandicapSuggestion;
  currentHandicap: number;
  proposedHandicap: number;
}

/**
 * Average raw Stableford points per round, used to drive handicap suggestions.
 * Considers all completed rounds (optionally only up to a given round number).
 */
export function handicapReview(
  season: SeasonData,
  uptoRoundNumber?: number,
): HandicapReviewRow[] {
  const done = completedRounds(season).filter(
    (r) => uptoRoundNumber === undefined || r.roundNumber <= uptoRoundNumber,
  );
  return season.players.map((player) => {
    let total = 0;
    let rounds = 0;
    for (const round of done) {
      if (!playerInRound(round, player.id)) continue;
      total += playerRawRoundPoints(round, player.id);
      rounds += 1;
    }
    const avg = rounds ? total / rounds : 0;
    const suggestion = rounds ? suggestHandicapChange(avg) : "none";
    let proposed = player.handicap;
    if (suggestion === "tighten") proposed = Math.max(0, player.handicap - 1);
    else if (suggestion === "loosen") proposed = player.handicap + 1;
    return {
      player,
      roundsPlayed: rounds,
      avgPoints: avg,
      suggestion,
      currentHandicap: player.handicap,
      proposedHandicap: proposed,
    };
  });
}

// ---------------------------------------------------------------------------
// Per-player stats
// ---------------------------------------------------------------------------

export interface PlayerStats {
  player: Player;
  roundsPlayed: number;
  totalPoints: number;
  avgPerRound: number;
  birdies: number;
  eagles: number;
  bestRound: { round: Round; points: number } | null;
  worstRound: { round: Round; points: number } | null;
  /** Handicap value after each completed round, for charting. */
  handicapHistory: { roundNumber: number; handicap: number }[];
}

export function playerStats(season: SeasonData, playerId: string): PlayerStats {
  const player = season.players.find((p) => p.id === playerId)!;
  const done = completedRounds(season);
  let totalPoints = 0;
  let roundsPlayed = 0;
  let birdies = 0;
  let eagles = 0;
  let bestRound: { round: Round; points: number } | null = null;
  let worstRound: { round: Round; points: number } | null = null;

  for (const round of done) {
    if (!playerInRound(round, player.id)) continue;
    roundsPlayed += 1;
    const seasonPts = playerSeasonRoundPoints(round, player.id);
    const rawPts = playerRawRoundPoints(round, player.id);
    totalPoints += seasonPts;
    const scored = playerScoredHoles(round, player.id);
    birdies += countClassification(scored, "birdie");
    eagles += countClassification(scored, "eagle");
    if (!bestRound || rawPts > bestRound.points)
      bestRound = { round, points: rawPts };
    if (!worstRound || rawPts < worstRound.points)
      worstRound = { round, points: rawPts };
  }

  return {
    player,
    roundsPlayed,
    totalPoints,
    avgPerRound: roundsPlayed ? totalPoints / roundsPlayed : 0,
    birdies,
    eagles,
    bestRound,
    worstRound,
    handicapHistory: handicapHistoryFor(season, playerId),
  };
}

/** Reconstruct a player's handicap after each round from the change log. */
export function handicapHistoryFor(
  season: SeasonData,
  playerId: string,
): { roundNumber: number; handicap: number }[] {
  const changes = season.handicapChanges
    .filter((c) => c.playerId === playerId)
    .sort((a, b) => a.afterRound - b.afterRound);
  // Starting handicap = current minus net of all changes.
  const net = changes.reduce((acc, c) => acc + (c.to - c.from), 0);
  let running = season.players.find((p) => p.id === playerId)!.handicap - net;
  const history = [{ roundNumber: 0, handicap: running }];
  for (const c of changes) {
    running = c.to;
    history.push({ roundNumber: c.afterRound, handicap: running });
  }
  return history;
}

/** Most improved: largest handicap tightening (decrease) over the season. */
export function mostImproved(
  season: SeasonData,
): { player: Player; delta: number } | null {
  let best: { player: Player; delta: number } | null = null;
  for (const player of season.players) {
    const history = handicapHistoryFor(season, player.id);
    if (history.length < 2) continue;
    const delta = history[0].handicap - history[history.length - 1].handicap;
    if (delta > 0 && (!best || delta > best.delta)) best = { player, delta };
  }
  return best;
}

export function formatRoundLabel(round: Round): string {
  const fmt =
    round.format === "scramble"
      ? "Scramble"
      : round.format === "championship"
        ? "Championship"
        : "Individual";
  return `Round ${round.roundNumber} · ${fmt}`;
}

export function defaultFormatLabel(roundNumber: number): string {
  const f = defaultFormatForRound(roundNumber);
  if (f === "scramble") return "2-Person Scramble";
  if (f === "championship") return "Championship (×2 points)";
  return "Individual";
}
