"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ScoreStepper from "@/components/ScoreStepper";
import { Loading } from "@/components/ui";
import { useSeason } from "@/lib/season-context";
import {
  MIN_KID_DRIVES,
  holeTypeForPar,
  kidDriveCount,
  scoreIndividualHole,
  scoreScrambleHole,
} from "@/lib/scoring";
import { unscoredHoles } from "@/lib/round";
import { KID_PLAYER_IDS } from "@/lib/seed";
import type { HoleScore, Round } from "@/lib/types";

export default function ActiveRoundPage() {
  const router = useRouter();
  const { season, loading, updateRound, finishRound } = useSeason();
  const [hole, setHole] = useState(1); // UI hole 1-9
  const [confirming, setConfirming] = useState(false);

  const round = season?.rounds.find(
    (r) => r.id === season.activeRoundId && !r.completed,
  );

  // No active round (e.g. after finishing or fresh device) — go home.
  useEffect(() => {
    if (!loading && !round) router.replace("/");
  }, [loading, round, router]);

  if (loading || !season) return <Loading />;
  if (!round) return <Loading />;

  const par = round.pars[hole - 1];
  const holeType = holeTypeForPar(par);
  const isScramble = round.format === "scramble";
  const courseHole = round.nine === "front" ? hole : hole + 9;

  // ---- hole-score mutators ------------------------------------------------
  function editPlayerHole(playerId: string, mut: (hs: HoleScore) => HoleScore) {
    updateRound(round!.id, (r) => ({
      ...r,
      playerScores: r.playerScores.map((ps) =>
        ps.playerId === playerId
          ? {
              ...ps,
              holeScores: ps.holeScores.map((hs) =>
                hs.hole === hole ? mut(hs) : hs,
              ),
            }
          : ps,
      ),
    }));
  }

  function editTeamHole(teamId: string, mut: (hs: HoleScore) => HoleScore) {
    updateRound(round!.id, (r) => ({
      ...r,
      teamScores: r.teamScores?.map((ts) =>
        ts.teamId === teamId
          ? {
              ...ts,
              holeScores: ts.holeScores.map((hs) =>
                hs.hole === hole ? mut(hs) : hs,
              ),
            }
          : ts,
      ),
    }));
  }

  const inc = (hs: HoleScore): HoleScore => ({
    ...hs,
    strokes: (hs.strokes ?? 0) + 1,
    pickedUp: false,
  });
  const dec = (hs: HoleScore): HoleScore => {
    const next = (hs.strokes ?? 0) - 1;
    return { ...hs, strokes: next < 1 ? null : next, pickedUp: false };
  };
  const togglePickup = (hs: HoleScore): HoleScore => ({
    ...hs,
    pickedUp: !hs.pickedUp,
  });

  // ---- finish flow --------------------------------------------------------
  const missing = unscoredHoles(round);
  const kidWarnings = isScramble
    ? (round.teamScores ?? []).filter(
        (ts) => kidDriveCount(ts) < MIN_KID_DRIVES,
      )
    : [];
  const hasIssues = missing.length > 0 || kidWarnings.length > 0;

  function attemptFinish() {
    if (hasIssues) setConfirming(true);
    else doFinish();
  }
  function doFinish() {
    finishRound(round!.id);
    router.push(`/round/summary?id=${round!.id}`);
  }

  const teamName = (ts: { teamId: string }) => {
    const idx = round.teams?.findIndex((t) => t.id === ts.teamId) ?? 0;
    return `Team ${idx + 1}`;
  };

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between pb-2">
        <Link href="/" className="text-sm font-semibold text-muted">
          Exit
        </Link>
        <span className="text-sm font-semibold text-muted">
          Round {round.roundNumber}
          {round.format === "championship" && " · ×2"}
          {isScramble && " · Scramble"}
        </span>
        <span className="w-10" />
      </div>

      {/* Hole header */}
      <div
        className="card mb-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--forest)", color: "#fff", borderColor: "var(--forest)" }}
      >
        <button
          aria-label="Previous hole"
          onClick={() => setHole((h) => Math.max(1, h - 1))}
          disabled={hole === 1}
          className="text-4xl disabled:opacity-30"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-xs uppercase tracking-wide opacity-80">
            Hole {hole} / 9{" "}
            {round.nine === "back" && (
              <span className="opacity-70">(course {courseHole})</span>
            )}
          </p>
          <p className="text-3xl font-extrabold">Par {par}</p>
        </div>
        <button
          aria-label="Next hole"
          onClick={() => setHole((h) => Math.min(9, h + 1))}
          disabled={hole === 9}
          className="text-4xl disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {/* Score cards */}
      <div className="space-y-3">
        {isScramble
          ? (round.teamScores ?? []).map((ts) => {
              const team = round.teams?.find((t) => t.id === ts.teamId);
              const [p1, p2] = team?.playerIds ?? [];
              const names = (team?.playerIds ?? [])
                .map((id) => season.players.find((p) => p.id === id)?.name)
                .filter(Boolean)
                .join(" & ");
              const hs = ts.holeScores[hole - 1];
              const scored = scoreScrambleHole(
                par,
                ts.handicaps[p1] ?? 0,
                ts.handicaps[p2] ?? 0,
                hs.strokes,
                hs.pickedUp,
              );
              const kidCount = kidDriveCount(ts);
              const kidOnTeam = (team?.playerIds ?? []).some((id) =>
                KID_PLAYER_IDS.includes(id),
              );
              return (
                <div key={ts.teamId}>
                  <ScoreStepper
                    title={`${teamName(ts)}`}
                    subtitle={names}
                    pp={scored.pp}
                    maxStrokes={scored.maxStrokes}
                    strokes={hs.strokes}
                    pickedUp={hs.pickedUp}
                    scored={scored}
                    onIncrement={() => editTeamHole(ts.teamId, inc)}
                    onDecrement={() => editTeamHole(ts.teamId, dec)}
                    onTogglePickup={() => editTeamHole(ts.teamId, togglePickup)}
                  />
                  {kidOnTeam && (
                    <label className="surface-2 mt-1 flex items-center justify-between rounded-xl px-4 py-3">
                      <span className="text-sm font-semibold">
                        Kid&apos;s drive used?
                        <span
                          className="ml-2 text-xs"
                          style={{
                            color:
                              kidCount < MIN_KID_DRIVES
                                ? "var(--gold)"
                                : "var(--text-muted)",
                          }}
                        >
                          {kidCount}/{MIN_KID_DRIVES} min
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        className="h-7 w-7 accent-current"
                        style={{ accentColor: "var(--forest)" }}
                        checked={Boolean(hs.kidDriveUsed)}
                        onChange={(e) =>
                          editTeamHole(ts.teamId, (h) => ({
                            ...h,
                            kidDriveUsed: e.target.checked,
                          }))
                        }
                      />
                    </label>
                  )}
                </div>
              );
            })
          : round.playerScores.map((ps) => {
              const player = season.players.find((p) => p.id === ps.playerId)!;
              const hs = ps.holeScores[hole - 1];
              const scored = scoreIndividualHole(
                par,
                ps.handicap,
                hs.strokes,
                hs.pickedUp,
              );
              return (
                <ScoreStepper
                  key={ps.playerId}
                  title={player.name}
                  subtitle={player.tees[holeType]}
                  pp={scored.pp}
                  maxStrokes={scored.maxStrokes}
                  strokes={hs.strokes}
                  pickedUp={hs.pickedUp}
                  scored={scored}
                  onIncrement={() => editPlayerHole(ps.playerId, inc)}
                  onDecrement={() => editPlayerHole(ps.playerId, dec)}
                  onTogglePickup={() =>
                    editPlayerHole(ps.playerId, togglePickup)
                  }
                />
              );
            })}
      </div>

      {/* Hole dots */}
      <div className="my-5 flex justify-center gap-1.5">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((h) => (
          <button
            key={h}
            aria-label={`Go to hole ${h}`}
            onClick={() => setHole(h)}
            className="h-3 w-3 rounded-full"
            style={{
              backgroundColor:
                h === hole ? "var(--gold)" : "var(--surface-2)",
              outline:
                h === hole ? "2px solid var(--gold)" : "none",
            }}
          />
        ))}
      </div>

      {/* Footer nav */}
      <div className="flex gap-3">
        {hole > 1 && (
          <button
            className="btn btn-outline flex-1 py-3"
            onClick={() => setHole((h) => h - 1)}
          >
            ‹ Prev
          </button>
        )}
        {hole < 9 ? (
          <button
            className="btn btn-primary flex-1 py-3"
            onClick={() => setHole((h) => h + 1)}
          >
            Next ›
          </button>
        ) : (
          <button className="btn btn-gold flex-1 py-3" onClick={attemptFinish}>
            Finish Round
          </button>
        )}
      </div>

      {/* Finish confirmation */}
      {confirming && (
        <FinishConfirm
          round={round}
          missing={missing}
          kidWarnings={kidWarnings.map(teamName)}
          onCancel={() => setConfirming(false)}
          onConfirm={doFinish}
          goToHole={(h) => {
            setHole(h);
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}

function FinishConfirm({
  round,
  missing,
  kidWarnings,
  onCancel,
  onConfirm,
  goToHole,
}: {
  round: Round;
  missing: number[];
  kidWarnings: string[];
  onCancel: () => void;
  onConfirm: () => void;
  goToHole: (h: number) => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-4">
      <div className="card w-full max-w-md">
        <h2 className="mb-2 text-lg font-bold">Before you finish…</h2>
        {missing.length > 0 && (
          <div className="mb-3">
            <p className="text-sm font-semibold" style={{ color: "var(--gold)" }}>
              Unscored holes
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {missing.map((h) => (
                <button
                  key={h}
                  onClick={() => goToHole(h)}
                  className="btn btn-outline px-3 py-1 text-sm"
                >
                  Hole {h}
                </button>
              ))}
            </div>
          </div>
        )}
        {kidWarnings.length > 0 && (
          <div className="mb-3">
            <p className="text-sm font-semibold" style={{ color: "var(--gold)" }}>
              Kid-drive rule not met
            </p>
            <p className="text-sm text-muted">
              {kidWarnings.join(", ")} used the kid&apos;s drive fewer than{" "}
              {MIN_KID_DRIVES} times.
            </p>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button className="btn btn-outline flex-1 py-3" onClick={onCancel}>
            Keep scoring
          </button>
          <button className="btn btn-gold flex-1 py-3" onClick={onConfirm}>
            Finish anyway
          </button>
        </div>
      </div>
    </div>
  );
}
