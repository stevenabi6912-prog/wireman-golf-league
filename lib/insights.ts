import {
  CLASSIFICATION_LABELS,
  countClassification,
  isHandicapReviewRound,
  playerRawRoundPoints,
  playerScoredHoles,
  playerSeasonRoundPoints,
  type HoleClassification,
} from "./scoring";
import type { Player, Round, SeasonData } from "./types";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function participatingPlayers(round: Round, players: Player[]): Player[] {
  return players.filter((p) => round.playerIds.includes(p.id));
}

function playedRounds(playerId: string, rounds: Round[]): Round[] {
  return rounds
    .filter((r) => r.playerIds.includes(playerId))
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

/** Mean raw Stableford points across the player's played rounds. */
export function averageRawPoints(playerId: string, rounds: Round[]): number {
  const played = playedRounds(playerId, rounds);
  if (!played.length) return 0;
  const total = played.reduce(
    (s, r) => s + playerRawRoundPoints(r, playerId),
    0,
  );
  return total / played.length;
}

// ---------------------------------------------------------------------------
// 1. Round MVP
// ---------------------------------------------------------------------------

export interface MvpEntry {
  player: Player;
  points: number;
  /** This round's points minus the player's average (can be negative). */
  vsAverage: number;
}

export function getRoundMvp(
  round: Round,
  players: Player[],
  allRounds: Round[],
): MvpEntry[] {
  const parts = participatingPlayers(round, players);
  if (!parts.length) return [];
  const scored = parts.map((p) => ({
    player: p,
    points: playerRawRoundPoints(round, p.id),
  }));
  const max = Math.max(...scored.map((s) => s.points));
  return scored
    .filter((s) => s.points === max)
    .map((s) => ({
      player: s.player,
      points: s.points,
      vsAverage: s.points - averageRawPoints(s.player.id, allRounds),
    }));
}

// ---------------------------------------------------------------------------
// 2. Hole of the Round
// ---------------------------------------------------------------------------

export interface HoleOfRound {
  player: Player;
  hole: number;
  par: number;
  personalPar: number;
  strokes: number;
  label: string;
}

export function getHoleOfRound(
  round: Round,
  players: Player[],
): HoleOfRound | null {
  let best: HoleOfRound | null = null;
  let bestUnder = 0;
  for (const p of participatingPlayers(round, players)) {
    playerScoredHoles(round, p.id).forEach((h, i) => {
      if (h.strokes == null) return;
      const under = h.pp - h.strokes;
      if (under < 1) return; // must beat personal par
      const better =
        best === null ||
        under > bestUnder ||
        (under === bestUnder && h.strokes < best.strokes);
      if (better) {
        bestUnder = under;
        best = {
          player: p,
          hole: i + 1,
          par: round.pars[i],
          personalPar: h.pp,
          strokes: h.strokes,
          label: `${CLASSIFICATION_LABELS[h.classification]} on Hole ${i + 1}`,
        };
      }
    });
  }
  return best;
}

// ---------------------------------------------------------------------------
// 3. Birdies & Eagles
// ---------------------------------------------------------------------------

export interface BirdieEagle {
  player: Player;
  hole: number;
  par: number;
  personalPar: number;
  strokes: number;
  type: "birdie" | "eagle";
}

export function getBirdiesAndEagles(
  round: Round,
  players: Player[],
): BirdieEagle[] {
  const out: BirdieEagle[] = [];
  for (const p of participatingPlayers(round, players)) {
    playerScoredHoles(round, p.id).forEach((h, i) => {
      if (h.classification === "eagle" || h.classification === "birdie") {
        out.push({
          player: p,
          hole: i + 1,
          par: round.pars[i],
          personalPar: h.pp,
          strokes: h.strokes ?? 0,
          type: h.classification,
        });
      }
    });
  }
  // Eagles above birdies, then by hole order.
  return out.sort((a, b) =>
    a.type === b.type ? a.hole - b.hole : a.type === "eagle" ? -1 : 1,
  );
}

// ---------------------------------------------------------------------------
// 4. Achievements & Firsts
// ---------------------------------------------------------------------------

export type AchievementType =
  | "first-eagle"
  | "first-birdie"
  | "personal-best"
  | "par-the-round"
  | "hole-in-one"
  | "first-par"
  | "three-in-a-row"
  | "sweep"
  | "comeback";

export interface Achievement {
  player: Player;
  type: AchievementType;
  detail: string;
  /** Hole-specific context, when the achievement happened on a hole. */
  hole?: number;
  par?: number;
  strokes?: number;
}

const PAR_OR_BETTER: HoleClassification[] = ["par", "birdie", "eagle"];

export function getAchievements(
  round: Round,
  players: Player[],
  allRounds: Round[],
): Achievement[] {
  const out: Achievement[] = [];
  const mvpIds = new Set(
    getRoundMvp(round, players, allRounds).map((m) => m.player.id),
  );
  const movement = new Map(
    getStandingsMovement(round, players, allRounds).map((m) => [m.player.id, m]),
  );

  for (const p of participatingPlayers(round, players)) {
    const prior = allRounds.filter(
      (r) => r.roundNumber < round.roundNumber && r.playerIds.includes(p.id),
    );
    const scored = playerScoredHoles(round, p.id);
    const thisPoints = playerRawRoundPoints(round, p.id);
    const priorPoints = prior.map((r) => playerRawRoundPoints(r, p.id));
    const priorScored = prior.map((r) => playerScoredHoles(r, p.id));

    const has = (c: HoleClassification) => scored.some((h) => h.classification === c);
    const priorHas = (c: HoleClassification) =>
      priorScored.some((rs) => rs.some((h) => h.classification === c));
    const ctx = (i: number) => ({
      hole: i + 1,
      par: round.pars[i],
      strokes: scored[i].strokes ?? undefined,
    });

    // First eagle / first birdie of the season.
    if (has("eagle") && !priorHas("eagle")) {
      const i = scored.findIndex((h) => h.classification === "eagle");
      out.push({ player: p, type: "first-eagle", detail: "First eagle of the season", ...ctx(i) });
    }
    if (has("birdie") && !priorHas("birdie")) {
      const i = scored.findIndex((h) => h.classification === "birdie");
      out.push({ player: p, type: "first-birdie", detail: "First birdie of the season", ...ctx(i) });
    }

    // New personal best (needs at least one prior round).
    if (prior.length >= 1 && thisPoints > Math.max(...priorPoints))
      out.push({ player: p, type: "personal-best", detail: `New personal best: ${thisPoints} pts` });

    // First 18+ point round.
    if (thisPoints >= 18 && priorPoints.every((pt) => pt < 18))
      out.push({ player: p, type: "par-the-round", detail: "First 18+ point round" });

    // Hole-in-one (every ace).
    scored.forEach((h, i) => {
      if (h.strokes === 1)
        out.push({ player: p, type: "hole-in-one", detail: `Hole-in-one on Hole ${i + 1}`, ...ctx(i) });
    });

    // First par of the season.
    if (has("par") && !priorHas("par")) {
      const i = scored.findIndex((h) => h.classification === "par");
      out.push({ player: p, type: "first-par", detail: "First par of the season", ...ctx(i) });
    }

    // Three consecutive holes at par or better.
    const streak = scored.findIndex(
      (_, i) =>
        i + 2 < scored.length &&
        PAR_OR_BETTER.includes(scored[i].classification) &&
        PAR_OR_BETTER.includes(scored[i + 1].classification) &&
        PAR_OR_BETTER.includes(scored[i + 2].classification),
    );
    if (streak >= 0)
      out.push({
        player: p,
        type: "three-in-a-row",
        detail: `Par or better on holes ${streak + 1}–${streak + 3}`,
        hole: streak + 1,
      });

    // Sweep — won the round.
    if (mvpIds.has(p.id))
      out.push({ player: p, type: "sweep", detail: `Won the round (${thisPoints} pts)` });

    // Comeback — climbed 3+ spots, round 3 onward.
    const mv = movement.get(p.id);
    if (round.roundNumber >= 3 && mv && mv.delta >= 3)
      out.push({ player: p, type: "comeback", detail: `Climbed ${mv.delta} spots` });
  }
  return out;
}

export interface EarnedAchievement extends Achievement {
  roundNumber: number;
  date: string;
}

/** Every achievement earned across the season, in chronological round order. */
export function getAllAchievements(season: SeasonData): EarnedAchievement[] {
  const done = season.rounds
    .filter((r) => r.completed)
    .sort((a, b) => a.roundNumber - b.roundNumber);
  const out: EarnedAchievement[] = [];
  for (const round of done) {
    const upTo = done.filter((r) => r.roundNumber <= round.roundNumber);
    for (const a of getAchievements(round, season.players, upTo)) {
      out.push({ ...a, roundNumber: round.roundNumber, date: round.date });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. Standings movement
// ---------------------------------------------------------------------------

export interface MovementRow {
  player: Player;
  before: number;
  after: number;
  delta: number; // positive = climbed
}

function rankByRounds(
  players: Player[],
  rounds: Round[],
): Map<string, number> {
  const totals = players.map((p, idx) => ({
    id: p.id,
    idx,
    total: rounds
      .filter((r) => r.playerIds.includes(p.id))
      .reduce((s, r) => s + playerSeasonRoundPoints(r, p.id), 0),
  }));
  totals.sort((a, b) => b.total - a.total || a.idx - b.idx);
  const pos = new Map<string, number>();
  totals.forEach((t, i) => pos.set(t.id, i + 1));
  return pos;
}

export function getStandingsMovement(
  round: Round,
  players: Player[],
  allRounds: Round[],
): MovementRow[] {
  const priorRounds = allRounds.filter(
    (r) => r.roundNumber < round.roundNumber,
  );
  if (priorRounds.length === 0) return []; // Round 1: nothing to compare
  const afterRounds = allRounds.filter(
    (r) => r.roundNumber <= round.roundNumber,
  );
  const before = rankByRounds(players, priorRounds);
  const after = rankByRounds(players, afterRounds);
  return players
    .map((p) => ({
      player: p,
      before: before.get(p.id) ?? players.length,
      after: after.get(p.id) ?? players.length,
    }))
    .sort((a, b) => a.after - b.after)
    .map((m) => ({ ...m, delta: m.before - m.after }));
}

export function getBiggestMover(
  movement: MovementRow[],
): { player: Player; spotsClimbed: number } | null {
  let best: { player: Player; spotsClimbed: number } | null = null;
  for (const m of movement) {
    if (m.delta > 0 && (!best || m.delta > best.spotsClimbed)) {
      best = { player: m.player, spotsClimbed: m.delta };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 6. Pattern flags
// ---------------------------------------------------------------------------

export type FlagType =
  | "cold-streak"
  | "loosen"
  | "tighten"
  | "hot-streak"
  | "high-variance";

export interface PatternFlag {
  player: Player;
  type: FlagType;
  message: string;
}

const FLAG_PRIORITY: Record<FlagType, number> = {
  "cold-streak": 0,
  loosen: 1,
  tighten: 1,
  "hot-streak": 2,
  "high-variance": 3,
};

function trailingStreak(pts: number[], pred: (x: number) => boolean): number {
  let n = 0;
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    if (pred(pts[i])) n += 1;
    else break;
  }
  return n;
}

export function getPatternFlags(
  players: Player[],
  allRounds: Round[],
  currentRoundNumber: number,
): PatternFlag[] {
  const reviewRound = isHandicapReviewRound(currentRoundNumber);
  const collected: PatternFlag[] = [];

  for (const p of players) {
    const played = playedRounds(p.id, allRounds);
    if (played.length === 0) continue;
    const pts = played.map((r) => playerRawRoundPoints(r, p.id));
    const avg = pts.reduce((a, b) => a + b, 0) / pts.length;
    const last2 = pts.slice(-2);
    const last3 = pts.slice(-3);

    const cold = trailingStreak(pts, (x) => x < avg);
    const hot = trailingStreak(pts, (x) => x > avg);

    if (cold >= 3)
      collected.push({
        player: p,
        type: "cold-streak",
        message: `${p.name} is cooling off — ${cold} straight rounds below their average`,
      });
    if (last2.length === 2 && last2.every((x) => x < 12))
      collected.push({
        player: p,
        type: "loosen",
        message: `${p.name} has scored under 12 in their last 2 rounds — consider loosening`,
      });
    if (!reviewRound && last2.length === 2 && last2.every((x) => x >= 25))
      collected.push({
        player: p,
        type: "tighten",
        message: `${p.name} is outscoring the field (25+ in their last 2) — consider tightening`,
      });
    if (hot >= 3)
      collected.push({
        player: p,
        type: "hot-streak",
        message: `${p.name} is on a hot streak — ${hot} straight rounds above their average`,
      });
    if (last3.length === 3 && Math.max(...last3) - Math.min(...last3) >= 15)
      collected.push({
        player: p,
        type: "high-variance",
        message: `${p.name} is streaky — a ${Math.max(...last3) - Math.min(...last3)}-point swing across their last 3`,
      });
  }

  return collected
    .sort((a, b) => FLAG_PRIORITY[a.type] - FLAG_PRIORITY[b.type])
    .slice(0, 4);
}
