import { describe, expect, it } from "vitest";
import type { Round } from "./types";
import {
  applyHandicapSuggestion,
  classify,
  defaultFormatForRound,
  kidDriveCount,
  kidDriveRuleMet,
  maxStrokesIndividual,
  maxStrokesScramble,
  personalPar,
  playerRawRoundPoints,
  playerSeasonRoundPoints,
  scoreIndividualHole,
  scoreScrambleHole,
  suggestHandicapChange,
  teamPersonalPar,
} from "./scoring";

describe("personal par & max strokes", () => {
  it("adds handicap to course par", () => {
    expect(personalPar(4, 0)).toBe(4);
    expect(personalPar(4, 3)).toBe(7);
  });

  it("caps individual strokes at PP + 3", () => {
    expect(maxStrokesIndividual(personalPar(4, 0))).toBe(7);
    expect(maxStrokesIndividual(personalPar(5, 2))).toBe(10);
  });
});

describe("individual Stableford scoring", () => {
  // Par 4, scratch player -> PP = 4
  it("scores an eagle (2+ under PP)", () => {
    const h = scoreIndividualHole(4, 0, 2, false);
    expect(h.classification).toBe("eagle");
    expect(h.points).toBe(4);
  });

  it("scores a birdie (1 under PP)", () => {
    const h = scoreIndividualHole(4, 0, 3, false);
    expect(h.classification).toBe("birdie");
    expect(h.points).toBe(3);
  });

  it("scores a par (equal to PP)", () => {
    const h = scoreIndividualHole(4, 0, 4, false);
    expect(h.classification).toBe("par");
    expect(h.points).toBe(2);
  });

  it("scores a bogey (1 over PP)", () => {
    const h = scoreIndividualHole(4, 0, 5, false);
    expect(h.classification).toBe("bogey");
    expect(h.points).toBe(1);
  });

  it("scores 2+ over PP as 0 points", () => {
    const h = scoreIndividualHole(4, 0, 6, false);
    expect(h.classification).toBe("other");
    expect(h.points).toBe(0);
  });

  it("awards 0 points and caps strokes on pickup", () => {
    const h = scoreIndividualHole(4, 0, null, true);
    expect(h.points).toBe(0);
    expect(h.effectiveStrokes).toBe(7); // PP + 3
    expect(h.entered).toBe(true);
  });

  it("caps strokes at max and awards 0 when blowing up", () => {
    const h = scoreIndividualHole(4, 0, 12, false);
    expect(h.effectiveStrokes).toBe(7);
    expect(h.points).toBe(0);
  });

  it("treats an un-entered hole as not entered, 0 points", () => {
    const h = scoreIndividualHole(4, 0, null, false);
    expect(h.entered).toBe(false);
    expect(h.points).toBe(0);
  });

  it("applies handicap to personal par (kid with +3)", () => {
    // Par 4, handicap 3 -> PP = 7. Net 7 strokes = par = 2 pts.
    const par = scoreIndividualHole(4, 3, 7, false);
    expect(par.classification).toBe("par");
    expect(par.points).toBe(2);
    // 5 strokes = 2 under PP = eagle
    const eagle = scoreIndividualHole(4, 3, 5, false);
    expect(eagle.classification).toBe("eagle");
  });

  it("parring every hole yields 18 points over 9 holes", () => {
    const total = Array.from({ length: 9 }).reduce<number>(
      (acc) => acc + scoreIndividualHole(4, 0, 4, false).points,
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
  });
});

describe("scramble scoring", () => {
  it("rounds team PP up (4.5 -> 5)", () => {
    // pp1 = 4 (par4, hc0), pp2 = 5 (par4, hc1) -> ceil(4.5) = 5
    expect(teamPersonalPar(4, 5)).toBe(5);
  });

  it("uses team PP + 2 as the scramble cap", () => {
    expect(maxStrokesScramble(5)).toBe(7);
  });

  it("scores against team PP", () => {
    // par 4, handicaps 0 and 1 -> ppA=4, ppB=5, teamPP = ceil(4.5)=5
    const par = scoreScrambleHole(4, 0, 1, 5, false);
    expect(par.pp).toBe(5);
    expect(par.classification).toBe("par");
    expect(par.points).toBe(2);
    const birdie = scoreScrambleHole(4, 0, 1, 4, false);
    expect(birdie.classification).toBe("birdie");
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
    playerScores: [],
    teams: [{ id: "t1", playerIds: ["dad", "logan"] }],
    teamScores: [
      {
        teamId: "t1",
        handicaps: { dad: 0, logan: 3 },
        holeScores: strokes.map((s, i) => ({
          hole: i + 1,
          strokes: s,
          pickedUp: false,
        })),
      },
    ],
  };
}

describe("scramble round totals", () => {
  it("gives both players the team total", () => {
    // par 4, hc 0 & 3 -> ppA=4 ppB=7 -> teamPP = ceil(5.5)=6. Strokes 6 = par = 2 pts each hole.
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
      playerScores: [
        {
          playerId: "dad",
          handicap: 0,
          holeScores: Array.from({ length: 9 }, (_, i) => ({
            hole: i + 1,
            strokes: 4, // par every hole = 18 raw
            pickedUp: false,
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
        pickedUp: false,
        kidDriveUsed: i < 1, // only 1 used
      })),
    };
    expect(kidDriveCount(ts)).toBe(1);
    expect(kidDriveRuleMet(ts)).toBe(false);
    ts.holeScores[1].kidDriveUsed = true; // now 2
    expect(kidDriveRuleMet(ts)).toBe(true);
  });
});
