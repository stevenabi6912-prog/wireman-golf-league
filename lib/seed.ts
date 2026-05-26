import type { Hole, Player, SeasonData } from "./types";

export const SEASON_VERSION = 1;

export function seedPlayers(): Player[] {
  return [
    {
      id: "dad",
      name: "Dad",
      handicap: 0,
      tees: { par3: "Blue tee", par4: "Blue tee", par5: "Blue tee" },
    },
    {
      id: "mom",
      name: "Mom",
      handicap: 0,
      tees: { par3: "Red tee", par4: "Red tee", par5: "Red tee" },
    },
    {
      id: "luke",
      name: "Luke",
      handicap: 1,
      tees: { par3: "Red tee", par4: "Red tee", par5: "Red tee" },
    },
    {
      id: "layla",
      name: "Layla",
      handicap: 2,
      tees: {
        par3: "Red tee",
        par4: "150-yd marker",
        par5: "200-yd marker",
      },
    },
    {
      id: "logan",
      name: "Logan",
      handicap: 3,
      tees: {
        par3: "100-yd marker",
        par4: "125-yd marker",
        par5: "150-yd marker",
      },
    },
    {
      id: "lazarus",
      name: "Lazarus",
      handicap: 4,
      tees: {
        par3: "75-yd marker",
        par4: "100-yd marker",
        par5: "125-yd marker",
      },
    },
  ];
}

/** All 18 holes default to par 4. Editable in Settings. */
export function seedHoles(): Hole[] {
  return Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4 }));
}

export function seedSeason(): SeasonData {
  return {
    version: SEASON_VERSION,
    players: seedPlayers(),
    holes: seedHoles(),
    rounds: [],
    handicapChanges: [],
    activeRoundId: null,
  };
}

/** Kids whose drive must be used at least twice in a scramble. */
export const KID_PLAYER_IDS = ["luke", "layla", "logan", "lazarus"];
