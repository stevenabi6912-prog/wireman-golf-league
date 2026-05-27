"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loading, PageHeader, Pill } from "@/components/ui";
import { NotesEditor } from "@/components/RoundNotes";
import { useSeason } from "@/lib/season-context";
import { clampNote } from "@/lib/notes";
import {
  countClassification,
  isHandicapReviewRound,
  playerRawRoundPoints,
  playerScoredHoles,
} from "@/lib/scoring";
import { completedRounds, formatRoundLabel, standings } from "@/lib/stats";
import {
  averageRawPoints,
  getAchievements,
  getBiggestMover,
  getBirdiesAndEagles,
  getHoleOfRound,
  getPatternFlags,
  getRoundMvp,
  getStandingsMovement,
  type Achievement,
} from "@/lib/insights";

function signed(n: number): string {
  const rounded = Number.isInteger(n) ? n : Number(n.toFixed(1));
  return rounded > 0 ? `+${rounded}` : rounded < 0 ? `${rounded}` : "even";
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

const ACHIEVEMENT_TONE: Record<Achievement["type"], "gold" | "forest" | "navy"> =
  {
    "first-eagle": "gold",
    "first-birdie": "forest",
    "personal-best": "navy",
    "par-the-round": "gold",
    "hole-in-one": "gold",
    "first-par": "forest",
    "three-in-a-row": "navy",
    sweep: "gold",
    comeback: "navy",
  };

function SummaryContent() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const { season, loading, updateRound } = useSeason();

  if (loading || !season) return <Loading />;

  const round =
    season.rounds.find((r) => r.id === id) ??
    [...season.rounds].filter((r) => r.completed).slice(-1)[0];

  if (!round) {
    return (
      <div>
        <PageHeader title="Round Recap" back={{ href: "/", label: "Home" }} />
        <p className="text-muted">No round found.</p>
      </div>
    );
  }

  // Everything is computed as-of this round (ignore any later rounds).
  const allRounds = completedRounds(season).filter(
    (r) => r.roundNumber <= round.roundNumber,
  );
  const players = season.players;

  const mvps = getRoundMvp(round, players, allRounds);
  const holeOfRound = getHoleOfRound(round, players);
  const birdiesEagles = getBirdiesAndEagles(round, players);
  const achievements = getAchievements(round, players, allRounds);
  const movement = getStandingsMovement(round, players, allRounds);
  const biggestMover = getBiggestMover(movement);
  const flags = getPatternFlags(players, allRounds, round.roundNumber);

  const recap = standings(season)
    .filter((r) => round.playerIds.includes(r.player.id))
    .map((r) => {
      const scored = playerScoredHoles(round, r.player.id);
      const points = playerRawRoundPoints(round, r.player.id);
      return {
        player: r.player,
        points,
        vsAvg: points - averageRawPoints(r.player.id, allRounds),
        birdies: countClassification(scored, "birdie"),
        eagles: countClassification(scored, "eagle"),
      };
    });

  return (
    <div>
      <PageHeader
        title="Round Recap"
        subtitle={formatRoundLabel(round)}
        back={{ href: "/", label: "Home" }}
      />

      {/* 1. MVP hero */}
      {mvps.length > 0 && (
        <div
          className="card"
          style={{
            backgroundColor: "var(--gold)",
            borderColor: "var(--gold)",
            color: "#fff",
          }}
        >
          <p className="text-xs font-bold uppercase tracking-wide opacity-90">
            Round MVP
          </p>
          <p className="text-3xl font-extrabold leading-tight">
            {mvps.map((m) => m.player.name).join(" & ")}
          </p>
          <p className="mt-1 text-lg font-bold">
            {mvps[0].points} pts
            <span className="ml-2 text-sm font-medium opacity-90">
              {signed(mvps[0].vsAverage)} pts vs their average
            </span>
          </p>
        </div>
      )}

      {/* 2. Hole of the Round */}
      {holeOfRound && (
        <Section title="Hole of the Round">
          <div
            className="card"
            style={{
              backgroundColor: "var(--forest)",
              borderColor: "var(--forest)",
              color: "#fff",
            }}
          >
            <p className="text-xl font-extrabold">
              {holeOfRound.player.name} — {holeOfRound.label}
            </p>
            <p className="mt-1 text-sm opacity-90">
              Par {holeOfRound.par} · personal par {holeOfRound.personalPar} ·
              scored {holeOfRound.strokes}
            </p>
          </div>
        </Section>
      )}

      {/* 3. Birdies & Eagles */}
      {birdiesEagles.length > 0 && (
        <Section title="Birdies & Eagles">
          <div className="card space-y-1.5">
            {birdiesEagles.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Pill tone={b.type === "eagle" ? "gold" : "forest"}>
                  {b.type === "eagle" ? "Eagle" : "Birdie"}
                </Pill>
                <span className="font-semibold">{b.player.name}</span>
                <span className="text-muted">
                  Hole {b.hole} (par {b.par}, PP {b.personalPar}, scored{" "}
                  {b.strokes})
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 4. Achievements */}
      {achievements.length > 0 && (
        <Section title="Achievements & Firsts">
          <div className="flex flex-wrap gap-2">
            {achievements.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold"
                style={{
                  backgroundColor:
                    ACHIEVEMENT_TONE[a.type] === "gold"
                      ? "var(--gold)"
                      : ACHIEVEMENT_TONE[a.type] === "forest"
                        ? "var(--forest)"
                        : "var(--navy)",
                  color: "#fff",
                }}
              >
                {a.player.name}: {a.detail}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* 5. Standings movement */}
      {movement.length > 0 && (
        <Section title="Standings Movement">
          {biggestMover && (
            <p className="mb-2 text-sm font-semibold" style={{ color: "var(--gold)" }}>
              Biggest mover: {biggestMover.player.name} climbed{" "}
              {biggestMover.spotsClimbed} spot
              {biggestMover.spotsClimbed === 1 ? "" : "s"}
            </p>
          )}
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2 text-center">Before</th>
                  <th className="px-3 py-2 text-center">After</th>
                  <th className="px-3 py-2 text-center">Δ</th>
                </tr>
              </thead>
              <tbody>
                {movement.map((m) => (
                  <tr
                    key={m.player.id}
                    className="border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-3 py-2 font-semibold">{m.player.name}</td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {m.before}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums">
                      {m.after}
                    </td>
                    <td className="px-3 py-2 text-center font-bold tabular-nums">
                      <MovementDelta delta={m.delta} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* 6. Pattern flags */}
      {flags.length > 0 && (
        <Section title="Worth Watching">
          <div className="space-y-2">
            {flags.map((f, i) => (
              <div key={i} className="surface-2 rounded-xl px-4 py-3 text-sm">
                {f.message}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 7. Per-player recap */}
      <Section title="Player Recaps">
        <div className="space-y-2">
          {recap.map((r) => (
            <Link
              key={r.player.id}
              href={`/stats?player=${r.player.id}`}
              className="card flex items-center justify-between"
            >
              <div>
                <p className="font-bold">{r.player.name}</p>
                <p className="text-sm text-muted">
                  {r.points} pts ({signed(r.vsAvg)} vs avg)
                  {(r.birdies > 0 || r.eagles > 0) && (
                    <>
                      {" · "}
                      {r.eagles > 0 && `${r.eagles} eagle${r.eagles > 1 ? "s" : ""} `}
                      {r.birdies > 0 &&
                        `${r.birdies} birdie${r.birdies > 1 ? "s" : ""}`}
                    </>
                  )}
                </p>
              </div>
              <span className="text-sm font-semibold text-muted">
                HCP {r.player.handicap === 0 ? "0" : `+${r.player.handicap}`} ›
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* Round notes */}
      <Section title="Round Notes">
        <NotesEditor
          initial={round.notes ?? ""}
          onSave={(note) =>
            updateRound(round.id, (r) => ({ ...r, notes: clampNote(note) }))
          }
        />
      </Section>

      <Link
        href={`/history/view?id=${round.id}`}
        className="btn btn-outline mt-6 w-full py-3"
      >
        View full scorecard
      </Link>

      {isHandicapReviewRound(round.roundNumber) && (
        <Link href="/handicap-review" className="btn btn-navy mt-3 w-full py-3">
          Review handicaps →
        </Link>
      )}

      <button
        className="btn btn-primary mt-3 w-full py-4 text-lg"
        onClick={() => router.push("/")}
      >
        Save &amp; Return Home
      </button>
    </div>
  );
}

function MovementDelta({ delta }: { delta: number }) {
  if (delta > 0)
    return <span style={{ color: "var(--forest)" }}>▲ {delta}</span>;
  if (delta < 0)
    return <span style={{ color: "#b91c1c" }}>▼ {Math.abs(delta)}</span>;
  return <span className="text-muted">—</span>;
}

export default function RoundSummaryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SummaryContent />
    </Suspense>
  );
}
