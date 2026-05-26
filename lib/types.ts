export type TeeLocation =
  | "Blue tee"
  | "Red tee"
  | "200-yd marker"
  | "150-yd marker"
  | "125-yd marker"
  | "100-yd marker"
  | "75-yd marker";

export type HoleType = "par3" | "par4" | "par5";

export interface Player {
  id: string;
  name: string;
  /** Strokes added to course par to get personal par. Floor 0. */
  handicap: number;
  /**
   * The round number from which the current handicap takes effect. The
   * handicap-review window only considers rounds at or after this number, so
   * the window resets each time the handicap is changed. Default 1.
   */
  handicapEffectiveFromRound: number;
  /** Tee assignment keyed by hole type. */
  tees: Record<HoleType, TeeLocation>;
}

export interface Hole {
  /** 1-18 */
  number: number;
  par: number;
}

export type RoundFormat = "individual" | "scramble" | "championship";

export type NineSelection = "front" | "back";

/** A single hole's score for an individual player or a scramble team. */
export interface HoleScore {
  /** 1-9 as displayed in the UI. */
  hole: number;
  /** Raw strokes taken, recorded as entered (uncapped). null = not entered. */
  strokes: number | null;
  /** Scramble only: was the kid's drive used on this hole? */
  kidDriveUsed?: boolean;
}

/** Per-player scoring record within a round (individual rounds). */
export interface PlayerRoundScore {
  playerId: string;
  /** Handicap snapshot at the time the round was played. */
  handicap: number;
  holeScores: HoleScore[];
}

export interface ScrambleTeam {
  id: string;
  playerIds: string[];
}

/** Per-team scoring record within a scramble round. */
export interface TeamRoundScore {
  teamId: string;
  /** Handicap snapshot for each player on the team. */
  handicaps: Record<string, number>;
  holeScores: HoleScore[];
}

export interface Round {
  id: string;
  /** 1-12 */
  roundNumber: number;
  date: string; // ISO date (yyyy-mm-dd)
  format: RoundFormat;
  nine: NineSelection;
  completed: boolean;
  /** Course pars for the 9 holes actually played, in display order 1-9. */
  pars: number[];
  /** Players who actually participated in this round. */
  playerIds: string[];
  /** Individual / championship scoring (only participating players). */
  playerScores: PlayerRoundScore[];
  /** Scramble only. */
  teams?: ScrambleTeam[];
  teamScores?: TeamRoundScore[];
}

export interface HandicapChange {
  id: string;
  playerId: string;
  from: number;
  to: number;
  /** The round number after which the change was applied. */
  afterRound: number;
  timestamp: string; // ISO
}

export interface SeasonData {
  version: number;
  players: Player[];
  holes: Hole[]; // all 18
  rounds: Round[];
  handicapChanges: HandicapChange[];
  activeRoundId: string | null;
}
