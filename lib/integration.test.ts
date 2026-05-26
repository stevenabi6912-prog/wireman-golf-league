import { describe, expect, it } from "vitest";
import { createRound, randomTeams, unscoredHoles } from "./round";
import { seedSeason } from "./seed";
import {
  handicapReview,
  lastRoundMvp,
  playerStats,
  standings,
} from "./stats";
import type { HoleScore, Round, SeasonData } from "./types";

const ALL_IDS = ["dad", "mom", "luke", "layla", "logan", "lazarus"];

/** A seeded season with every hole flattened to par 4, so these tests
 *  exercise scoring logic independent of the real Ella Sharp Park pars. */
function seasonAllPar4(): SeasonData {
  const s = seedSeason();
  s.holes = s.holes.map((h) => ({ ...h, par: 4 }));
  return s;
}

/** Set every hole for an individual player to a fixed stroke count. */
function fillPlayer(round: Round, playerId: string, strokes: number) {
  round.playerScores = round.playerScores.map((ps) =>
    ps.playerId === playerId
      ? {
          ...ps,
          holeScores: ps.holeScores.map((hs) => ({ ...hs, strokes })),
        }
      : ps,
  );
}

function complete(round: Round): Round {
  return { ...round, completed: true };
}

describe("full individual round loop", () => {
  it("records strokes and produces correct standings", () => {
    const season = seasonAllPar4();
    const round = createRound(season, {
      roundNumber: 1,
      date: "2026-05-01",
      nine: "front",
      format: "individual",
      playerIds: ALL_IDS,
    });

    // Dad (hcp 0, PP 4): par every hole -> 18 pts.
    fillPlayer(round, "dad", 4);
    // Mom (hcp 0, PP 4): birdie every hole (3 strokes) -> 27 pts.
    fillPlayer(round, "mom", 3);
    // Logan (hcp 3, PP 7): 7 strokes = par -> 18 pts.
    fillPlayer(round, "logan", 7);
    // Everyone else fixed at their personal par for completeness.
    fillPlayer(round, "luke", 5); // PP 5 -> par
    fillPlayer(round, "layla", 6); // PP 6 -> par
    fillPlayer(round, "lazarus", 8); // PP 8 -> par

    expect(unscoredHoles(round)).toEqual([]);

    season.rounds = [complete(round)];

    const table = standings(season);
    const mom = table.find((r) => r.player.id === "mom")!;
    const dad = table.find((r) => r.player.id === "dad")!;
    expect(mom.totalPoints).toBe(27);
    expect(mom.birdies).toBe(9);
    expect(dad.totalPoints).toBe(18);
    // Mom should lead.
    expect(table[0].player.id).toBe("mom");

    const mvp = lastRoundMvp(season);
    expect(mvp?.player.id).toBe("mom");
    expect(mvp?.points).toBe(27);
  });
});

describe("flagging skipped holes", () => {
  it("lists holes with no score and no pickup", () => {
    const season = seasonAllPar4();
    const round = createRound(season, {
      roundNumber: 2,
      date: "2026-05-08",
      nine: "back",
      format: "individual",
      playerIds: ALL_IDS,
    });
    fillPlayer(round, "dad", 4);
    // Leave dad's hole 5 unscored.
    round.playerScores = round.playerScores.map((ps) =>
      ps.playerId === "dad"
        ? {
            ...ps,
            holeScores: ps.holeScores.map(
              (hs): HoleScore =>
                hs.hole === 5 ? { ...hs, strokes: null } : hs,
            ),
          }
        : ps,
    );
    expect(unscoredHoles(round)).toContain(5);
  });
});

describe("scramble round loop", () => {
  it("gives both teammates the team total and tracks kid drives", () => {
    const season = seasonAllPar4();
    const teams = [
      { id: "team-1", playerIds: ["dad", "logan"] },
      { id: "team-2", playerIds: ["mom", "luke"] },
      { id: "team-3", playerIds: ["layla", "lazarus"] },
    ];
    const round = createRound(season, {
      roundNumber: 4,
      date: "2026-06-01",
      nine: "front",
      format: "scramble",
      playerIds: ALL_IDS,
      teams,
    });

    // Team 1: dad PP4 + logan PP7 -> teamPP ceil(5.5)=6. Strokes 6 = par = 2 pts/hole = 18.
    round.teamScores = round.teamScores!.map((ts) =>
      ts.teamId === "team-1"
        ? {
            ...ts,
            holeScores: ts.holeScores.map((hs, i) => ({
              ...hs,
              strokes: 6,
              kidDriveUsed: i < 2, // exactly meets the 2-drive minimum
            })),
          }
        : {
            ...ts,
            holeScores: ts.holeScores.map((hs) => ({ ...hs, strokes: 8 })),
          },
    );

    season.rounds = [complete(round)];
    const table = standings(season);
    const dad = table.find((r) => r.player.id === "dad")!;
    const logan = table.find((r) => r.player.id === "logan")!;
    expect(dad.totalPoints).toBe(18);
    expect(logan.totalPoints).toBe(18);
    expect(dad.totalPoints).toBe(logan.totalPoints);
  });
});

describe("championship doubling in season totals", () => {
  it("doubles the round's points toward the season", () => {
    const season = seasonAllPar4();
    const round = createRound(season, {
      roundNumber: 12,
      date: "2026-08-01",
      nine: "front",
      format: "championship",
      playerIds: ["dad"],
    });
    fillPlayer(round, "dad", 4); // par every hole, raw 18
    season.rounds = [complete(round)];

    const stats = playerStats(season, "dad");
    expect(stats.bestRound?.points).toBe(18); // raw
    expect(stats.totalPoints).toBe(36); // doubled in season total
  });
});

describe("handicap review across three rounds", () => {
  it("suggests loosening for a struggling player", () => {
    const season: SeasonData = seasonAllPar4();
    // Three individual rounds where Lazarus blows up (0 pts) -> avg 0 < 14.
    for (let n = 1; n <= 3; n += 1) {
      const round = createRound(season, {
        roundNumber: n,
        date: `2026-05-0${n}`,
        nine: "front",
        format: "individual",
        playerIds: ALL_IDS,
      });
      season.players.forEach((p) =>
        fillPlayer(round, p.id, p.id === "lazarus" ? 20 : 4 + p.handicap),
      );
      season.rounds.push(complete(round));
    }
    const review = handicapReview(season);
    const laz = review.find((r) => r.player.id === "lazarus")!;
    expect(laz.suggestion).toBe("loosen");
    expect(laz.proposedHandicap).toBe(laz.currentHandicap + 1);

    // A player parring every hole (18 pts) sits in the steady band.
    const dad = review.find((r) => r.player.id === "dad")!;
    expect(dad.avgPoints).toBe(18);
    expect(dad.suggestion).toBe("none");
  });
});

describe("random team draw", () => {
  it("produces 3 teams of 2 from 6 players", () => {
    const season = seasonAllPar4();
    const teams = randomTeams(season.players);
    expect(teams).toHaveLength(3);
    teams.forEach((t) => expect(t.playerIds).toHaveLength(2));
    const all = teams.flatMap((t) => t.playerIds).sort();
    expect(all).toEqual(
      season.players.map((p) => p.id).sort(),
    );
  });
});

describe("per-round player selection", () => {
  it("only creates score rows for selected players and only credits them", () => {
    const season = seasonAllPar4();
    const round = createRound(season, {
      roundNumber: 1,
      date: "2026-05-01",
      nine: "front",
      format: "individual",
      playerIds: ["dad", "logan", "lazarus"],
    });

    expect(round.playerIds.sort()).toEqual(["dad", "lazarus", "logan"]);
    expect(round.playerScores.map((ps) => ps.playerId).sort()).toEqual([
      "dad",
      "lazarus",
      "logan",
    ]);

    fillPlayer(round, "dad", 4); // par -> 18
    fillPlayer(round, "logan", 7); // PP7 par -> 18
    fillPlayer(round, "lazarus", 8); // PP8 par -> 18
    season.rounds = [complete(round)];

    const table = standings(season);
    const mom = table.find((r) => r.player.id === "mom")!;
    expect(mom.roundsPlayed).toBe(0);
    expect(mom.totalPoints).toBe(0);

    const dad = table.find((r) => r.player.id === "dad")!;
    expect(dad.roundsPlayed).toBe(1);
    expect(dad.totalPoints).toBe(18);
  });

  it("averages over rounds played, not total season rounds", () => {
    const season = seasonAllPar4();
    const mk = (n: number, ids: string[]) => {
      const r = createRound(season, {
        roundNumber: n,
        date: `2026-05-0${n}`,
        nine: "front",
        format: "individual",
        playerIds: ids,
      });
      ids.forEach((id) => fillPlayer(r, id, 4)); // everyone pars -> 18
      return complete(r);
    };
    // Dad plays rounds 1 and 2 but sits out round 3.
    season.rounds = [
      mk(1, ["dad", "mom"]),
      mk(2, ["dad", "mom"]),
      mk(3, ["mom"]),
    ];

    const dad = standings(season).find((r) => r.player.id === "dad")!;
    expect(dad.roundsPlayed).toBe(2);
    expect(dad.totalPoints).toBe(36);
    expect(dad.avgPerRound).toBe(18); // 36 / 2, not 36 / 3
  });

  it("rejects starting a round with no players", () => {
    const season = seasonAllPar4();
    expect(() =>
      createRound(season, {
        roundNumber: 1,
        date: "2026-05-01",
        nine: "front",
        format: "individual",
        playerIds: [],
      }),
    ).toThrow();
  });
});
