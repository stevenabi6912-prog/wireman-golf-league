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

/**
 * Official Ella Sharp Park hole pars (holes 1-18, display order).
 * Front 9 = 36, Back 9 = 35, total = 71. Hole 8 always plays as par 4
 * (par 3 from Red on the card) — the personal-par system absorbs the gap.
 */
export const ELLA_SHARP_PARS: readonly number[] = [
  4, 4, 5, 3, 3, 4, 4, 4, 5, // front (36)
  4, 3, 4, 3, 5, 5, 3, 4, 4, // back (35)
];

export function ellaSharpHoles(): Hole[] {
  return ELLA_SHARP_PARS.map((par, i) => ({ number: i + 1, par }));
}

/** All 18 holes seeded to the Ella Sharp Park pars. Editable in Settings. */
export function seedHoles(): Hole[] {
  return ellaSharpHoles();
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
