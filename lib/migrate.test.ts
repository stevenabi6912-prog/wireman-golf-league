import { describe, expect, it } from "vitest";
import { derivePlayerIds, migrateSeason, needsParMigration } from "./migrate";
import { ELLA_SHARP_PARS, seedHoles, seedSeason } from "./seed";
import type { Round, SeasonData } from "./types";

const EXPECTED_PARS = [
  4, 4, 5, 3, 3, 4, 4, 4, 5, // front
  4, 3, 4, 3, 5, 5, 3, 4, 4, // back
];

function allParFourSeason(): SeasonData {
  const s = seedSeason();
  s.holes = s.holes.map((h) => ({ ...h, par: 4 }));
  return s;
}

describe("Ella Sharp Park seed pars", () => {
  it("matches the official scorecard", () => {
    expect(seedHoles().map((h) => h.par)).toEqual(EXPECTED_PARS);
    expect([...ELLA_SHARP_PARS]).toEqual(EXPECTED_PARS);
  });

  it("totals front 36 / back 35 / 71 overall", () => {
    const pars = seedHoles().map((h) => h.par);
    const front = pars.slice(0, 9).reduce((a, b) => a + b, 0);
    const back = pars.slice(9).reduce((a, b) => a + b, 0);
    expect(front).toBe(36);
    expect(back).toBe(35);
    expect(front + back).toBe(71);
  });

  it("seeds hole 8 as par 4", () => {
    expect(seedHoles()[7].par).toBe(4);
  });
});

describe("par migration", () => {
  it("detects the legacy all-par-4 default", () => {
    expect(needsParMigration(allParFourSeason())).toBe(true);
    expect(needsParMigration(seedSeason())).toBe(false);
  });

  it("overwrites legacy all-4 pars with course defaults", () => {
    const migrated = migrateSeason(allParFourSeason());
    expect(migrated.holes.map((h) => h.par)).toEqual(EXPECTED_PARS);
  });

  it("preserves customized pars (does not overwrite user edits)", () => {
    const custom = seedSeason();
    custom.holes[0] = { ...custom.holes[0], par: 5 }; // edit hole 1
    const migrated = migrateSeason(custom);
    expect(migrated).toBe(custom); // same reference: no change
    expect(migrated.holes[0].par).toBe(5);
  });

  it("does not migrate a partially-edited legacy season", () => {
    // Old default (all 4) but the user changed hole 3 -> not all 4 anymore.
    const data = allParFourSeason();
    data.holes[2] = { ...data.holes[2], par: 5 };
    const migrated = migrateSeason(data);
    expect(migrated).toBe(data);
    expect(migrated.holes[2].par).toBe(5);
  });

  it("is idempotent (running twice equals running once)", () => {
    const once = migrateSeason(allParFourSeason());
    const twice = migrateSeason(once);
    expect(twice.holes.map((h) => h.par)).toEqual(EXPECTED_PARS);
    // Second pass is a no-op and returns the same reference.
    expect(migrateSeason(once)).toBe(once);
  });

  it("leaves other season data untouched", () => {
    const data = allParFourSeason();
    const migrated = migrateSeason(data);
    expect(migrated.players).toBe(data.players);
    expect(migrated.rounds).toBe(data.rounds);
    expect(migrated.handicapChanges).toBe(data.handicapChanges);
  });
});

// Legacy rounds saved before per-round player selection existed (no playerIds).
function legacyIndividualRound(): Omit<Round, "playerIds"> {
  return {
    id: "legacy-1",
    roundNumber: 1,
    date: "2026-05-01",
    format: "individual",
    nine: "front",
    completed: true,
    pars: Array(9).fill(4),
    playerScores: [
      { playerId: "dad", handicap: 0, holeScores: [] },
      { playerId: "mom", handicap: 0, holeScores: [] },
    ],
  };
}

function legacyScrambleRound(): Omit<Round, "playerIds"> {
  return {
    id: "legacy-s",
    roundNumber: 4,
    date: "2026-06-01",
    format: "scramble",
    nine: "front",
    completed: true,
    pars: Array(9).fill(4),
    playerScores: [],
    teams: [{ id: "t1", playerIds: ["dad", "logan"] }],
    teamScores: [{ teamId: "t1", handicaps: { dad: 0, logan: 3 }, holeScores: [] }],
  };
}

function seasonWith(round: Omit<Round, "playerIds">): SeasonData {
  const s = seedSeason();
  s.rounds = [round as unknown as Round];
  return s;
}

describe("playerIds migration", () => {
  it("derives participants from an individual round's scores", () => {
    expect(derivePlayerIds(legacyIndividualRound() as Round).sort()).toEqual([
      "dad",
      "mom",
    ]);
  });

  it("derives participants from a scramble round's teams", () => {
    expect(derivePlayerIds(legacyScrambleRound() as Round).sort()).toEqual([
      "dad",
      "logan",
    ]);
  });

  it("backfills playerIds on a legacy individual round", () => {
    const migrated = migrateSeason(seasonWith(legacyIndividualRound()));
    expect(migrated.rounds[0].playerIds.sort()).toEqual(["dad", "mom"]);
  });

  it("backfills playerIds on a legacy scramble round", () => {
    const migrated = migrateSeason(seasonWith(legacyScrambleRound()));
    expect(migrated.rounds[0].playerIds.sort()).toEqual(["dad", "logan"]);
  });

  it("does not touch rounds that already have playerIds", () => {
    const data = seedSeason();
    const round = {
      ...legacyIndividualRound(),
      playerIds: ["dad"],
    } as Round;
    data.rounds = [round];
    const migrated = migrateSeason(data);
    expect(migrated).toBe(data); // nothing changed
    expect(migrated.rounds[0]).toBe(round);
  });

  it("is idempotent (second run is a no-op)", () => {
    const once = migrateSeason(seasonWith(legacyIndividualRound()));
    expect(once.rounds[0].playerIds.sort()).toEqual(["dad", "mom"]);
    const twice = migrateSeason(once);
    expect(twice.rounds[0].playerIds).toEqual(once.rounds[0].playerIds);
    expect(migrateSeason(once)).toBe(once);
  });
});
