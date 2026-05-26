import type {
  HoleType,
  PlayerRoundScore,
  Round,
  RoundFormat,
  TeamRoundScore,
} from "./types";

// ---------------------------------------------------------------------------
// Basic golf math
// ---------------------------------------------------------------------------

export function holeTypeForPar(par: number): HoleType {
  if (par <= 3) return "par3";
  if (par >= 5) return "par5";
  return "par4";
}

/** Personal par = course par + player handicap. */
export function personalPar(coursePar: number, handicap: number): number {
  return coursePar + handicap;
}

/**
 * Scramble team personal par = ceil(average of members' personal pars).
 * For the standard 2-player team this is ceil((pp1 + pp2) / 2).
 */
export function teamPersonalPar(pps: number[]): number {
  if (pps.length === 0) return 0;
  return Math.ceil(pps.reduce((a, b) => a + b, 0) / pps.length);
}

// ---------------------------------------------------------------------------
// Stableford classification & points
// ---------------------------------------------------------------------------

export type HoleClassification =
  | "eagle"
  | "birdie"
  | "par"
  | "bogey"
  | "other"
  | "none";

export const CLASSIFICATION_LABELS: Record<HoleClassification, string> = {
  eagle: "Eagle",
  birdie: "Birdie",
  par: "Par",
  bogey: "Bogey",
  other: "Other",
  none: "—",
};

/** Classify strokes-vs-personal-par difference into a Stableford outcome. */
export function classify(diff: number): HoleClassification {
  if (diff <= -2) return "eagle";
  if (diff === -1) return "birdie";
  if (diff === 0) return "par";
  if (diff === 1) return "bogey";
  return "other";
}

export interface ScoredHole {
  /** Personal par (individual) or team personal par (scramble). */
  pp: number;
  /** Strokes as entered (no upper cap); null if not entered. */
  strokes: number | null;
  points: number;
  classification: HoleClassification;
  /** Whether a score has been recorded for this hole. */
  entered: boolean;
}

export function pointsForClassification(c: HoleClassification): number {
  switch (c) {
    case "eagle":
      return 4;
    case "birdie":
      return 3;
    case "par":
      return 2;
    case "bogey":
      return 1;
    default:
      return 0;
  }
}

/**
 * Core hole scorer. Strokes are recorded exactly as entered — there is no
 * upper cap. The Stableford floor still applies: 2+ over personal par scores 0.
 * An un-entered hole returns `none`/0 and `entered: false`.
 */
export function scoreHole(pp: number, strokes: number | null): ScoredHole {
  if (strokes === null) {
    return {
      pp,
      strokes: null,
      points: 0,
      classification: "none",
      entered: false,
    };
  }
  const classification = classify(strokes - pp);
  return {
    pp,
    strokes,
    points: pointsForClassification(classification),
    classification,
    entered: true,
  };
}

export function scoreIndividualHole(
  coursePar: number,
  handicap: number,
  strokes: number | null,
): ScoredHole {
  return scoreHole(personalPar(coursePar, handicap), strokes);
}

export function scoreScrambleHole(
  coursePar: number,
  handicaps: number[],
  strokes: number | null,
): ScoredHole {
  const teamPP = teamPersonalPar(
    handicaps.map((h) => personalPar(coursePar, h)),
  );
  return scoreHole(teamPP, strokes);
}

// ---------------------------------------------------------------------------
// Round format
// ---------------------------------------------------------------------------

export function defaultFormatForRound(roundNumber: number): RoundFormat {
  if (roundNumber === 4 || roundNumber === 8) return "scramble";
  if (roundNumber === 12) return "championship";
  return "individual";
}

export function isDoublePointsFormat(format: RoundFormat): boolean {
  return format === "championship";
}

// ---------------------------------------------------------------------------
// Round-level scoring (operates purely on a stored Round)
// ---------------------------------------------------------------------------

export function scorePlayerHoles(
  round: Round,
  ps: PlayerRoundScore,
): ScoredHole[] {
  return ps.holeScores.map((hs) =>
    scoreIndividualHole(round.pars[hs.hole - 1], ps.handicap, hs.strokes),
  );
}

export function scoreTeamHoles(round: Round, ts: TeamRoundScore): ScoredHole[] {
  const team = round.teams?.find((t) => t.id === ts.teamId);
  const playerIds = team?.playerIds ?? [];
  const handicaps = playerIds.map((pid) => ts.handicaps[pid] ?? 0);
  return ts.holeScores.map((hs) =>
    scoreScrambleHole(round.pars[hs.hole - 1], handicaps, hs.strokes),
  );
}

export function sumPoints(scored: ScoredHole[]): number {
  return scored.reduce((acc, h) => acc + h.points, 0);
}

export function countClassification(
  scored: ScoredHole[],
  c: HoleClassification,
): number {
  return scored.filter((h) => h.classification === c).length;
}

/** Team id that a player belongs to in a scramble round, or undefined. */
export function teamForPlayer(
  round: Round,
  playerId: string,
): string | undefined {
  return round.teams?.find((t) => t.playerIds.includes(playerId))?.id;
}

/** Raw (un-doubled) Stableford total a player earned in a round. */
export function playerRawRoundPoints(round: Round, playerId: string): number {
  if (round.format === "scramble") {
    const teamId = teamForPlayer(round, playerId);
    const ts = round.teamScores?.find((t) => t.teamId === teamId);
    if (!ts) return 0;
    return sumPoints(scoreTeamHoles(round, ts));
  }
  const ps = round.playerScores.find((p) => p.playerId === playerId);
  if (!ps) return 0;
  return sumPoints(scorePlayerHoles(round, ps));
}

/** Points that count toward the season total (championship doubles). */
export function playerSeasonRoundPoints(
  round: Round,
  playerId: string,
): number {
  const raw = playerRawRoundPoints(round, playerId);
  return isDoublePointsFormat(round.format) ? raw * 2 : raw;
}

/** Scored holes for a player whether individual or scramble. */
export function playerScoredHoles(
  round: Round,
  playerId: string,
): ScoredHole[] {
  if (round.format === "scramble") {
    const teamId = teamForPlayer(round, playerId);
    const ts = round.teamScores?.find((t) => t.teamId === teamId);
    return ts ? scoreTeamHoles(round, ts) : [];
  }
  const ps = round.playerScores.find((p) => p.playerId === playerId);
  return ps ? scorePlayerHoles(round, ps) : [];
}

// ---------------------------------------------------------------------------
// Handicap adjustment
// ---------------------------------------------------------------------------

export type HandicapSuggestion = "tighten" | "loosen" | "none";

export const HANDICAP_TIGHTEN_THRESHOLD = 22;
export const HANDICAP_LOOSEN_THRESHOLD = 14;

/**
 * avg > 22  -> tighten (handicap - 1, floored at 0)
 * avg < 14  -> loosen  (handicap + 1)
 * otherwise -> none
 */
export function suggestHandicapChange(avgPoints: number): HandicapSuggestion {
  if (avgPoints > HANDICAP_TIGHTEN_THRESHOLD) return "tighten";
  if (avgPoints < HANDICAP_LOOSEN_THRESHOLD) return "loosen";
  return "none";
}

export function applyHandicapSuggestion(
  current: number,
  suggestion: HandicapSuggestion,
): number {
  if (suggestion === "tighten") return Math.max(0, current - 1);
  if (suggestion === "loosen") return current + 1;
  return current;
}

export const HANDICAP_REVIEW_ROUNDS = [1, 2, 3, 6, 9];

export function isHandicapReviewRound(roundNumber: number): boolean {
  return HANDICAP_REVIEW_ROUNDS.includes(roundNumber);
}

// ---------------------------------------------------------------------------
// Scramble kid-drive rule
// ---------------------------------------------------------------------------

export const MIN_KID_DRIVES = 2;

export function kidDriveCount(ts: TeamRoundScore): number {
  return ts.holeScores.filter((h) => h.kidDriveUsed).length;
}

export function kidDriveRuleMet(ts: TeamRoundScore): boolean {
  return kidDriveCount(ts) >= MIN_KID_DRIVES;
}
