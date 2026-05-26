import { defaultFormatForRound } from "./scoring";
import type {
  HoleScore,
  NineSelection,
  Player,
  Round,
  RoundFormat,
  ScrambleTeam,
  SeasonData,
  TeamRoundScore,
} from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Course pars for the selected nine, in display order (UI holes 1-9). */
export function parsForNine(season: SeasonData, nine: NineSelection): number[] {
  const start = nine === "front" ? 0 : 9;
  return season.holes.slice(start, start + 9).map((h) => h.par);
}

function emptyHoleScores(scramble: boolean): HoleScore[] {
  return Array.from({ length: 9 }, (_, i) => ({
    hole: i + 1,
    strokes: null,
    pickedUp: false,
    ...(scramble ? { kidDriveUsed: false } : {}),
  }));
}

export interface CreateRoundInput {
  roundNumber: number;
  date: string;
  nine: NineSelection;
  format: RoundFormat;
  /** Required for scramble rounds. */
  teams?: ScrambleTeam[];
}

export function createRound(
  season: SeasonData,
  input: CreateRoundInput,
): Round {
  const pars = parsForNine(season, input.nine);
  const scramble = input.format === "scramble";

  const playerScores = scramble
    ? []
    : season.players.map((p) => ({
        playerId: p.id,
        handicap: p.handicap,
        holeScores: emptyHoleScores(false),
      }));

  let teamScores: TeamRoundScore[] | undefined;
  if (scramble && input.teams) {
    teamScores = input.teams.map((team) => {
      const handicaps: Record<string, number> = {};
      for (const pid of team.playerIds) {
        handicaps[pid] = season.players.find((p) => p.id === pid)?.handicap ?? 0;
      }
      return {
        teamId: team.id,
        handicaps,
        holeScores: emptyHoleScores(true),
      };
    });
  }

  return {
    id: newId(),
    roundNumber: input.roundNumber,
    date: input.date,
    format: input.format,
    nine: input.nine,
    completed: false,
    pars,
    playerScores,
    teams: scramble ? input.teams : undefined,
    teamScores,
  };
}

/** Randomly pair players into 2-person teams (round 4). */
export function randomTeams(players: Player[]): ScrambleTeam[] {
  const shuffled = [...players];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const teams: ScrambleTeam[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    const pair = shuffled.slice(i, i + 2);
    teams.push({ id: newId(), playerIds: pair.map((p) => p.id) });
  }
  return teams;
}

/** Holes (1-9) with no score entered and no pickup — used to block finishing. */
export function unscoredHoles(round: Round): number[] {
  const missing = new Set<number>();
  const check = (hs: HoleScore[]) => {
    for (const h of hs) {
      if (h.strokes === null && !h.pickedUp) missing.add(h.hole);
    }
  };
  if (round.format === "scramble") {
    round.teamScores?.forEach((t) => check(t.holeScores));
  } else {
    round.playerScores.forEach((p) => check(p.holeScores));
  }
  return [...missing].sort((a, b) => a - b);
}

export { defaultFormatForRound };
