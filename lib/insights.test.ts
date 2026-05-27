import { describe, expect, it } from "vitest";
import {
  getAchievements,
  getAllAchievements,
  getBiggestMover,
  getBirdiesAndEagles,
  getHoleOfRound,
  getPatternFlags,
  getRoundMvp,
  getStandingsMovement,
} from "./insights";
import { seedPlayers, seedSeason } from "./seed";
import type { Player, Round, SeasonData } from "./types";

const PLAYERS: Player[] = seedPlayers();
const only = (...ids: string[]) => PLAYERS.filter((p) => ids.includes(p.id));

/** Stroke array (hc0, par4) that yields exactly `total` Stableford points. */
function strokesForPoints(total: number): number[] {
  const out: number[] = [];
  let remaining = total;
  for (let i = 0; i < 9; i += 1) {
    const give = Math.max(0, Math.min(4, remaining));
    remaining -= give;
    out.push(give === 4 ? 2 : give === 3 ? 3 : give === 2 ? 4 : give === 1 ? 5 : 6);
  }
  return out;
}

function mkRound(
  roundNumber: number,
  entries: { id: string; points: number }[],
): Round {
  return mkRoundStrokes(
    roundNumber,
    entries.map((e) => ({ id: e.id, strokes: strokesForPoints(e.points) })),
  );
}

function mkRoundStrokes(
  roundNumber: number,
  entries: { id: string; strokes: number[] }[],
  pars: number[] = Array(9).fill(4),
): Round {
  return {
    id: `r${roundNumber}`,
    roundNumber,
    date: `2026-01-${String(roundNumber).padStart(2, "0")}`,
    format: "individual",
    nine: "front",
    completed: true,
    pars,
    playerIds: entries.map((e) => e.id),
    playerScores: entries.map((e) => ({
      playerId: e.id,
      handicap: 0,
      holeScores: e.strokes.map((s, i) => ({ hole: i + 1, strokes: s })),
    })),
  };
}

describe("getRoundMvp", () => {
  it("returns the highest scorer", () => {
    const r = mkRound(1, [
      { id: "dad", points: 36 },
      { id: "mom", points: 18 },
    ]);
    const mvp = getRoundMvp(r, PLAYERS, [r]);
    expect(mvp).toHaveLength(1);
    expect(mvp[0].player.id).toBe("dad");
    expect(mvp[0].points).toBe(36);
  });

  it("returns both players on a tie", () => {
    const r = mkRound(1, [
      { id: "dad", points: 30 },
      { id: "mom", points: 30 },
    ]);
    const mvp = getRoundMvp(r, PLAYERS, [r]);
    expect(mvp.map((m) => m.player.id).sort()).toEqual(["dad", "mom"]);
  });

  it("computes vsAverage across the player's rounds", () => {
    const r1 = mkRound(1, [{ id: "dad", points: 18 }]);
    const r2 = mkRound(2, [{ id: "dad", points: 26 }]);
    const mvp = getRoundMvp(r2, PLAYERS, [r1, r2]);
    expect(mvp[0].points).toBe(26);
    expect(mvp[0].vsAverage).toBe(4); // 26 - (18+26)/2
  });
});

describe("getHoleOfRound", () => {
  it("ranks an eagle above a birdie on a tougher hole", () => {
    const pars = [5, 3, 4, 4, 4, 4, 4, 4, 4];
    const r = mkRoundStrokes(
      1,
      [
        // Dad: birdie on the par 5 (hole 1)
        { id: "dad", strokes: [4, 3, 4, 4, 4, 4, 4, 4, 4] },
        // Mom: eagle on the par 3 (hole 2)
        { id: "mom", strokes: [5, 1, 4, 4, 4, 4, 4, 4, 4] },
      ],
      pars,
    );
    const hole = getHoleOfRound(r, PLAYERS);
    expect(hole?.player.id).toBe("mom");
    expect(hole?.hole).toBe(2);
    expect(hole?.label).toBe("Eagle on Hole 2");
  });

  it("returns null when nobody beats personal par", () => {
    const r = mkRoundStrokes(1, [{ id: "dad", strokes: Array(9).fill(4) }]);
    expect(getHoleOfRound(r, PLAYERS)).toBeNull();
  });
});

describe("getBirdiesAndEagles", () => {
  it("collects every birdie and eagle, eagles first", () => {
    const r = mkRoundStrokes(1, [
      { id: "dad", strokes: [3, 2, 4, 4, 4, 4, 4, 4, 4] }, // birdie h1, eagle h2
      { id: "mom", strokes: [4, 4, 3, 4, 4, 4, 4, 4, 4] }, // birdie h3
    ]);
    const list = getBirdiesAndEagles(r, PLAYERS);
    expect(list).toHaveLength(3);
    expect(list[0].type).toBe("eagle");
    expect(list.filter((b) => b.type === "birdie")).toHaveLength(2);
  });
});

describe("getAchievements", () => {
  const birdieRound = (n: number) =>
    mkRoundStrokes(n, [{ id: "dad", strokes: [3, 4, 4, 4, 4, 4, 4, 4, 4] }]);

  it("fires first birdie of the season on the first birdie", () => {
    const r1 = birdieRound(1);
    const types = getAchievements(r1, PLAYERS, [r1]).map((a) => a.type);
    expect(types).toContain("first-birdie");
  });

  it("does not re-fire first birdie when one happened earlier", () => {
    const r1 = birdieRound(1);
    const r2 = birdieRound(2);
    const types = getAchievements(r2, PLAYERS, [r1, r2]).map((a) => a.type);
    expect(types).not.toContain("first-birdie");
  });

  it("fires a new personal best only after 2+ rounds", () => {
    const r1 = mkRound(1, [{ id: "dad", points: 18 }]);
    const r2 = mkRound(2, [{ id: "dad", points: 26 }]);
    expect(getAchievements(r1, PLAYERS, [r1]).map((a) => a.type)).not.toContain(
      "personal-best",
    );
    expect(
      getAchievements(r2, PLAYERS, [r1, r2]).map((a) => a.type),
    ).toContain("personal-best");
  });

  it("fires the 18+ point milestone the first time only", () => {
    const r1 = mkRound(1, [{ id: "dad", points: 18 }]);
    const r2 = mkRound(2, [{ id: "dad", points: 20 }]);
    expect(getAchievements(r1, PLAYERS, [r1]).map((a) => a.type)).toContain(
      "par-the-round",
    );
    expect(
      getAchievements(r2, PLAYERS, [r1, r2]).map((a) => a.type),
    ).not.toContain("par-the-round");
  });
});

describe("getStandingsMovement", () => {
  it("returns nothing for round 1", () => {
    const r1 = mkRound(1, [
      { id: "dad", points: 20 },
      { id: "mom", points: 18 },
    ]);
    expect(getStandingsMovement(r1, only("dad", "mom"), [r1])).toEqual([]);
  });

  it("computes movement from the prior round's standings", () => {
    const r1 = mkRound(1, [
      { id: "dad", points: 27 },
      { id: "mom", points: 18 },
    ]);
    const r2 = mkRound(2, [
      { id: "dad", points: 18 },
      { id: "mom", points: 36 },
    ]);
    const movement = getStandingsMovement(r2, only("dad", "mom"), [r1, r2]);
    const mom = movement.find((m) => m.player.id === "mom")!;
    const dad = movement.find((m) => m.player.id === "dad")!;
    expect(mom.before).toBe(2);
    expect(mom.after).toBe(1);
    expect(mom.delta).toBe(1); // climbed one spot
    expect(dad.delta).toBe(-1);
    expect(getBiggestMover(movement)?.player.id).toBe("mom");
  });

  it("keeps the position of a player who skipped the round", () => {
    const r1 = mkRound(1, [
      { id: "dad", points: 27 },
      { id: "mom", points: 18 },
    ]);
    const r2 = mkRound(2, [{ id: "dad", points: 10 }]); // mom sat out
    const movement = getStandingsMovement(r2, only("dad", "mom"), [r1, r2]);
    const mom = movement.find((m) => m.player.id === "mom")!;
    expect(mom.before).toBe(2);
    expect(mom.after).toBe(2);
    expect(mom.delta).toBe(0);
  });
});

describe("getPatternFlags", () => {
  it("flags tightening only off a review round", () => {
    const r4 = mkRound(4, [{ id: "dad", points: 27 }]);
    const r5 = mkRound(5, [{ id: "dad", points: 27 }]);
    const onR5 = getPatternFlags(only("dad"), [r4, r5], 5);
    expect(onR5.some((f) => f.type === "tighten")).toBe(true);

    const r6 = mkRound(6, [{ id: "dad", points: 27 }]);
    const onR6 = getPatternFlags(only("dad"), [r5, r6], 6); // 6 is a review round
    expect(onR6.some((f) => f.type === "tighten")).toBe(false);
  });

  it("requires 3+ consecutive above-average rounds for a hot streak", () => {
    const rounds = [5, 5, 20, 22, 25].map((pts, i) =>
      mkRound(i + 1, [{ id: "dad", points: pts }]),
    );
    expect(
      getPatternFlags(only("dad"), rounds, 5).some((f) => f.type === "hot-streak"),
    ).toBe(true);

    const onlyTwo = [5, 5, 5, 20, 25].map((pts, i) =>
      mkRound(i + 1, [{ id: "dad", points: pts }]),
    );
    expect(
      getPatternFlags(only("dad"), onlyTwo, 5).some(
        (f) => f.type === "hot-streak",
      ),
    ).toBe(false);
  });

  it("shows at most 4 flags", () => {
    // Five players each on a cold streak: 25, 25, 5, 5, 5.
    const ids = ["dad", "mom", "luke", "layla", "logan"];
    const seq = [25, 25, 5, 5, 5];
    const rounds = seq.map((pts, i) =>
      mkRound(
        i + 1,
        ids.map((id) => ({ id, points: pts })),
      ),
    );
    const flags = getPatternFlags(only(...ids), rounds, 5);
    expect(flags).toHaveLength(4);
    expect(flags.every((f) => f.type === "cold-streak")).toBe(true);
  });
});

describe("new achievement types", () => {
  it("fires a hole-in-one on an ace", () => {
    const r = mkRoundStrokes(1, [
      { id: "dad", strokes: [1, 4, 4, 4, 4, 4, 4, 4, 4] },
    ]);
    const types = getAchievements(r, PLAYERS, [r]).map((a) => a.type);
    expect(types).toContain("hole-in-one");
  });

  it("fires first par and three-in-a-row on a clean round", () => {
    const r = mkRoundStrokes(1, [{ id: "dad", strokes: Array(9).fill(4) }]);
    const types = getAchievements(r, PLAYERS, [r]).map((a) => a.type);
    expect(types).toContain("first-par");
    expect(types).toContain("three-in-a-row");
  });

  it("awards a sweep to the round winner", () => {
    const r = mkRound(1, [
      { id: "dad", points: 30 },
      { id: "mom", points: 18 },
    ]);
    const ach = getAchievements(r, PLAYERS, [r]);
    expect(ach.some((a) => a.player.id === "dad" && a.type === "sweep")).toBe(
      true,
    );
    expect(ach.some((a) => a.player.id === "mom" && a.type === "sweep")).toBe(
      false,
    );
  });

  it("awards a comeback for climbing 3+ spots from round 3", () => {
    const ids = ["dad", "mom", "luke", "layla"];
    const r1 = mkRound(
      1,
      ids.map((id) => ({ id, points: id === "dad" ? 5 : 8 })),
    );
    const r2 = mkRound(
      2,
      ids.map((id) => ({ id, points: id === "dad" ? 5 : 8 })),
    );
    const r3 = mkRound(
      3,
      ids.map((id) => ({ id, points: id === "dad" ? 36 : 0 })),
    );
    const ach = getAchievements(r3, only(...ids), [r1, r2, r3]);
    expect(
      ach.some((a) => a.player.id === "dad" && a.type === "comeback"),
    ).toBe(true);
  });
});

describe("getAllAchievements", () => {
  function seasonWith(rounds: Round[]): SeasonData {
    return { ...seedSeason(), players: PLAYERS, rounds };
  }

  it("returns achievements in chronological round order", () => {
    const r1 = mkRoundStrokes(1, [
      { id: "dad", strokes: [3, 4, 4, 4, 4, 4, 4, 4, 4] },
    ]);
    const r2 = mkRoundStrokes(2, [
      { id: "dad", strokes: [2, 4, 4, 4, 4, 4, 4, 4, 4] },
    ]);
    const all = getAllAchievements(seasonWith([r1, r2]));
    expect(all.length).toBeGreaterThan(0);
    const rounds = all.map((a) => a.roundNumber);
    expect(rounds).toEqual([...rounds].sort((a, b) => a - b));
    expect(rounds[0]).toBe(1);
  });

  it("returns nothing for a player with no achievements", () => {
    const r = mkRoundStrokes(1, [
      { id: "dad", strokes: Array(9).fill(5) }, // all bogeys: nothing earned
      { id: "mom", strokes: Array(9).fill(4) }, // all pars: several badges
    ]);
    const all = getAllAchievements(seasonWith([r]));
    expect(all.filter((a) => a.player.id === "dad")).toEqual([]);
    expect(all.filter((a) => a.player.id === "mom").length).toBeGreaterThan(0);
  });

  it("family total equals the sum of per-player counts", () => {
    const r1 = mkRound(1, [
      { id: "dad", points: 27 },
      { id: "mom", points: 18 },
    ]);
    const all = getAllAchievements(seasonWith([r1]));
    const perPlayer = PLAYERS.map(
      (p) => all.filter((a) => a.player.id === p.id).length,
    ).reduce((s, n) => s + n, 0);
    expect(perPlayer).toBe(all.length);
  });
});
