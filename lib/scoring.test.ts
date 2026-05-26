import { describe, expect, it } from "vitest";
import type { Round } from "./types";
import {
  applyHandicapSuggestion,
  classify,
  defaultFormatForRound,
  kidDriveCount,
  kidDriveRuleMet,
  personalPar,
  playerRawRoundPoints,
  playerSeasonRoundPoints,
  scoreIndividualHole,
  scoreScrambleHole,
  suggestHandicapChange,
  teamPersonalPar,
} from "./scoring";

describe("personal par", () => {
  it("adds handicap to course par", () => {
    expect(personalPar(4, 0)).toBe(4);
    expect(personalPar(4, 3)).toBe(7);
  });
});

describe("individual Stableford scoring", () => {
  // Par 4, scratch player -> PP = 4
  it("scores an eagle (2+ under PP)", () => {
    const h = scoreIndividualHole(4, 0, 2);
    expect(h.classification).toBe("eagle");
    expect(h.points).toBe(4);
  });

  it("scores a birdie (1 under PP)", () => {
    const h = scoreIndividualHole(4, 0, 3);
    expect(h.classification).toBe("birdie");
    expect(h.points).toBe(3);
  });

  it("scores a par (equal to PP)", () => {
    const h = scoreIndividualHole(4, 0, 4);
    expect(h.classification).toBe("par");
    expect(h.points).toBe(2);
  });

  it("scores a bogey (1 over PP)", () => {
    const h = scoreIndividualHole(4, 0, 5);
    expect(h.classification).toBe("bogey");
    expect(h.points).toBe(1);
  });

  it("scores 2+ over PP as 0 points", () => {
    const h = scoreIndividualHole(4, 0, 6);
    expect(h.classification).toBe("other");
    expect(h.points).toBe(0);
  });

  it("records strokes exactly as entered with no upper cap", () => {
    // Previously capped at PP+3; now the real stroke count is stored.
    const h = scoreIndividualHole(4, 0, 12);
    expect(h.strokes).toBe(12);
    expect(h.points).toBe(0);
    expect(h.classification).toBe("other");
  });

  it("stores a blow-up hole as entered and floors points at 0", () => {
    // Lazarus on a par 4 with +4 handicap -> PP 8; 15 strokes recorded as-is.
    const h = scoreIndividualHole(4, 4, 15);
    expect(h.pp).toBe(8);
    expect(h.strokes).toBe(15);
    expect(h.points).toBe(0);
    expect(h.entered).toBe(true);
  });

  it("treats an un-entered hole as not entered, 0 points", () => {
    const h = scoreIndividualHole(4, 0, null);
    expect(h.entered).toBe(false);
    expect(h.strokes).toBeNull();
    expect(h.points).toBe(0);
  });

  it("applies handicap to personal par (kid with +3)", () => {
    const par = scoreIndividualHole(4, 3, 7); // PP 7 -> par
    expect(par.classification).toBe("par");
    expect(par.points).toBe(2);
    const eagle = scoreIndividualHole(4, 3, 5); // 2 under PP
    expect(eagle.classification).toBe("eagle");
  });

  it("parring every hole yields 18 points over 9 holes", () => {
    const total = Array.from({ length: 9 }).reduce<number>(
      (acc) => acc + scoreIndividualHole(4, 0, 4).points,
      0,
    );
    expect(total).toBe(18);
  });
});

describe("classify boundaries", () => {
  it("maps diffs to outcomes", () => {
    expect(classify(-3)).toBe("eagle");
    expect(classify(-2)).toBe("eagle");
    expect(classify(-1)).toBe("birdie");
    expect(classify(0)).toBe("par");
    expect(classify(1)).toBe("bogey");
    expect(classify(2)).toBe("other");
    expect(classify(20)).toBe("other");
  });
});

describe("scramble scoring", () => {
  it("rounds team PP up (avg 4.5 -> 5)", () => {
    expect(teamPersonalPar([4, 5])).toBe(5);
  });

  it("handles a single-player team (PP = that player's PP)", () => {
    expect(teamPersonalPar([7])).toBe(7);
  });

  it("scores against team PP", () => {
    // par 4, handicaps 0 and 1 -> ppA=4, ppB=5, teamPP = ceil(4.5)=5
    const par = scoreScrambleHole(4, [0, 1], 5);
    expect(par.pp).toBe(5);
    expect(par.classification).toBe("par");
    expect(par.points).toBe(2);
    const birdie = scoreScrambleHole(4, [0, 1], 4);
    expect(birdie.classification).toBe("birdie");
  });

  it("records scramble strokes uncapped, floors points at 0", () => {
    const h = scoreScrambleHole(4, [0, 1], 14);
    expect(h.strokes).toBe(14);
    expect(h.points).toBe(0);
  });
});

// ---------------------------------------------------------------------------

function scrambleRound(strokes: number[]): Round {
  return {
    id: "r4",
    roundNumber: 4,
    date: "2026-05-01",
    format: "scramble",
    nine: "front",
    completed: true,
    pars: Array(9).fill(4),
    playerIds: ["dad", "logan"],
    playerScores: [],
    teams: [{ id: "t1", playerIds: ["dad", "logan"] }],
    teamScores: [
      {
        teamId: "t1",
        handicaps: { dad: 0, logan: 3 },
        holeScores: strokes.map((s, i) => ({ hole: i + 1, strokes: s })),
      },
    ],
  };
}

describe("scramble round totals", () => {
  it("gives both players the team total", () => {
    // par 4, hc 0 & 3 -> ppA=4 ppB=7 -> teamPP ceil(5.5)=6. Strokes 6 = par.
    const round = scrambleRound(Array(9).fill(6));
    expect(playerRawRoundPoints(round, "dad")).toBe(18);
    expect(playerRawRoundPoints(round, "logan")).toBe(18);
  });
});

describe("championship double points", () => {
  function champRound(): Round {
    return {
      id: "r12",
      roundNumber: 12,
      date: "2026-08-01",
      format: "championship",
      nine: "front",
      completed: true,
      pars: Array(9).fill(4),
      playerIds: ["dad"],
      playerScores: [
        {
          playerId: "dad",
          handicap: 0,
          holeScores: Array.from({ length: 9 }, (_, i) => ({
            hole: i + 1,
            strokes: 4, // par every hole = 18 raw
          })),
        },
      ],
    };
  }

  it("raw round total is undoubled", () => {
    expect(playerRawRoundPoints(champRound(), "dad")).toBe(18);
  });

  it("season total doubles championship points", () => {
    expect(playerSeasonRoundPoints(champRound(), "dad")).toBe(36);
  });

  it("normal rounds are not doubled", () => {
    const round = champRound();
    round.format = "individual";
    round.roundNumber = 2;
    expect(playerSeasonRoundPoints(round, "dad")).toBe(18);
  });
});

describe("round format defaults", () => {
  it("derives format from round number", () => {
    expect(defaultFormatForRound(1)).toBe("individual");
    expect(defaultFormatForRound(4)).toBe("scramble");
    expect(defaultFormatForRound(8)).toBe("scramble");
    expect(defaultFormatForRound(12)).toBe("championship");
  });
});

describe("handicap adjustment thresholds", () => {
  it("suggests tighten only above 22", () => {
    expect(suggestHandicapChange(22.1)).toBe("tighten");
    expect(suggestHandicapChange(22)).toBe("none"); // boundary: not > 22
    expect(suggestHandicapChange(30)).toBe("tighten");
  });

  it("suggests loosen only below 14", () => {
    expect(suggestHandicapChange(13.9)).toBe("loosen");
    expect(suggestHandicapChange(14)).toBe("none"); // boundary: not < 14
    expect(suggestHandicapChange(10)).toBe("loosen");
  });

  it("suggests no change in the middle band", () => {
    expect(suggestHandicapChange(18)).toBe("none");
    expect(suggestHandicapChange(14)).toBe("none");
    expect(suggestHandicapChange(22)).toBe("none");
  });

  it("applies suggestions with a floor at 0", () => {
    expect(applyHandicapSuggestion(3, "tighten")).toBe(2);
    expect(applyHandicapSuggestion(0, "tighten")).toBe(0); // floor
    expect(applyHandicapSuggestion(2, "loosen")).toBe(3);
    expect(applyHandicapSuggestion(2, "none")).toBe(2);
  });
});

describe("kid drive rule", () => {
  it("counts used kid drives and flags < 2", () => {
    const ts = {
      teamId: "t1",
      handicaps: { dad: 0, logan: 3 },
      holeScores: Array.from({ length: 9 }, (_, i) => ({
        hole: i + 1,
        strokes: 6,
        kidDriveUsed: i < 1, // only 1 used
      })),
    };
    expect(kidDriveCount(ts)).toBe(1);
    expect(kidDriveRuleMet(ts)).toBe(false);
    ts.holeScores[1].kidDriveUsed = true; // now 2
    expect(kidDriveRuleMet(ts)).toBe(true);
  });
});
