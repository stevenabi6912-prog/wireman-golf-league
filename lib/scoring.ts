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

/** Individual max strokes per hole = PP + 3. */
export function maxStrokesIndividual(pp: number): number {
  return pp + 3;
}

/** Scramble team personal par = ceil((pp1 + pp2) / 2). */
export function teamPersonalPar(pp1: number, pp2: number): number {
  return Math.ceil((pp1 + pp2) / 2);
}

/** Scramble max strokes per hole = team PP + 2. */
export function maxStrokesScramble(teamPP: number): number {
  return teamPP + 2;
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
  maxStrokes: number;
  /** Strokes capped at maxStrokes for display; null if not entered. */
  effectiveStrokes: number | null;
  points: number;
  classification: HoleClassification;
  /** Whether a score (or pickup) has been recorded for this hole. */
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
 * Core hole scorer. Given personal par and the max-strokes cap, returns the
 * Stableford outcome. Picking up = 0 points with strokes shown at the cap.
 * An un-entered hole returns `none`/0 and `entered: false`.
 */
export function scoreHole(
  pp: number,
  maxStrokes: number,
  strokes: number | null,
  pickedUp: boolean,
): ScoredHole {
  if (pickedUp) {
    return {
      pp,
      maxStrokes,
      effectiveStrokes: maxStrokes,
      points: 0,
      classification: "other",
      entered: true,
    };
  }
  if (strokes === null) {
    return {
      pp,
      maxStrokes,
      effectiveStrokes: null,
      points: 0,
      classification: "none",
      entered: false,
    };
  }
  const effectiveStrokes = Math.min(strokes, maxStrokes);
  const classification = classify(effectiveStrokes - pp);
  return {
    pp,
    maxStrokes,
    effectiveStrokes,
    points: pointsForClassification(classification),
    classification,
    entered: true,
  };
}

export function scoreIndividualHole(
  coursePar: number,
  handicap: number,
  strokes: number | null,
  pickedUp: boolean,
): ScoredHole {
  const pp = personalPar(coursePar, handicap);
  return scoreHole(pp, maxStrokesIndividual(pp), strokes, pickedUp);
}

export function scoreScrambleHole(
  coursePar: number,
  handicap1: number,
  handicap2: number,
  strokes: number | null,
  pickedUp: boolean,
): ScoredHole {
  const teamPP = teamPersonalPar(
    personalPar(coursePar, handicap1),
    personalPar(coursePar, handicap2),
  );
  return scoreHole(teamPP, maxStrokesScramble(teamPP), strokes, pickedUp);
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
    scoreIndividualHole(
      round.pars[hs.hole - 1],
      ps.handicap,
      hs.strokes,
      hs.pickedUp,
    ),
  );
}

export function scoreTeamHoles(
  round: Round,
  ts: TeamRoundScore,
): ScoredHole[] {
  const team = round.teams?.find((t) => t.id === ts.teamId);
  const [p1, p2] = team?.playerIds ?? [];
  return ts.holeScores.map((hs) =>
    scoreScrambleHole(
      round.pars[hs.hole - 1],
      ts.handicaps[p1] ?? 0,
      ts.handicaps[p2] ?? 0,
      hs.strokes,
      hs.pickedUp,
    ),
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

export const HANDICAP_REVIEW_ROUNDS = [3, 6, 9];

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
