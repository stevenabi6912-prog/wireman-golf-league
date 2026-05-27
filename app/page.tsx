"use client";

import Link from "next/link";
import { useState } from "react";
import { Loading } from "@/components/ui";
import CloudUploadPrompt from "@/components/CloudUploadPrompt";
import { useSeason } from "@/lib/season-context";
import { isHandicapReviewRound } from "@/lib/scoring";
import {
  TOTAL_ROUNDS,
  completedRounds,
  defaultFormatLabel,
  lastRoundMvp,
  leader,
  mostBirdies,
  nextRoundNumber,
  standings,
  type StandingsRow,
} from "@/lib/stats";

type SortKey = "totalPoints" | "avgPerRound" | "handicap" | "birdies" | "name";

export default function Dashboard() {
  const { season, loading } = useSeason();
  const [sortKey, setSortKey] = useState<SortKey>("totalPoints");

  if (loading || !season) return <Loading />;

  const rows = sortRows(standings(season), sortKey);
  const next = nextRoundNumber(season);
  const done = completedRounds(season);
  const activeRound = season.rounds.find(
    (r) => r.id === season.activeRoundId && !r.completed,
  );
  const ld = leader(season);
  const mb = mostBirdies(season);
  const mvp = lastRoundMvp(season);
  const justFinished = next ? next - 1 : TOTAL_ROUNDS;
  const reviewDue = justFinished >= 1 && isHandicapReviewRound(justFinished);

  return (
    <div>
      <header className="mb-4">
        <p className="text-sm font-semibold text-muted">Wireman Family</p>
        <h1 className="text-3xl font-extrabold" style={{ color: "var(--forest)" }}>
          Golf League
        </h1>
      </header>

      <CloudUploadPrompt />

      {activeRound && (
        <Link href="/round/active" className="card mb-4 block" style={{ borderColor: "var(--gold)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold" style={{ color: "var(--gold)" }}>
                Round in progress
              </p>
              <p className="text-sm text-muted">
                Round {activeRound.roundNumber} · tap to resume scoring
              </p>
            </div>
            <span className="text-2xl" aria-hidden>›</span>
          </div>
        </Link>
      )}

      {reviewDue && (
        <Link
          href="/handicap-review"
          className="card mb-4 block"
          style={{ borderColor: "var(--navy)" }}
        >
          <p className="font-bold" style={{ color: "var(--navy)" }}>
            Handicap review available
          </p>
          <p className="text-sm text-muted">
            Round {justFinished} is complete — review suggested adjustments ›
          </p>
        </Link>
      )}

      {/* Next round card */}
      <section className="mb-5">
        {next ? (
          <div
            className="card"
            style={{ backgroundColor: "var(--forest)", color: "#fff", borderColor: "var(--forest)" }}
          >
            <p className="text-sm opacity-80">Next up</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-extrabold">Round {next}</p>
                <p className="text-sm opacity-90">{defaultFormatLabel(next)}</p>
              </div>
              {!activeRound && (
                <Link
                  href="/round/start"
                  className="btn btn-gold px-6 text-base"
                >
                  Start Round
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="card text-center">
            <p className="font-bold" style={{ color: "var(--gold)" }}>
              Season complete! 🏆
            </p>
            <p className="text-sm text-muted">All 12 rounds played.</p>
          </div>
        )}
      </section>

      {/* Quick stats strip */}
      <section className="mb-5 grid grid-cols-2 gap-2">
        <Stat label="Rounds played" value={`${done.length}/${TOTAL_ROUNDS}`} />
        <Stat label="Leader" value={ld ? ld.player.name : "—"} sub={ld ? `${ld.totalPoints} pts` : undefined} />
        <Stat
          label="Most birdies"
          value={mb ? mb.player.name : "—"}
          sub={mb ? `${mb.birdies}` : undefined}
        />
        <Stat
          label="Last round MVP"
          value={mvp ? mvp.player.name : "—"}
          sub={mvp ? `${mvp.points} pts` : undefined}
        />
      </section>

      {/* Standings */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            Standings
          </h2>
          <Link
            href="/handicap-review"
            className="text-sm font-semibold"
            style={{ color: "var(--navy)" }}
          >
            Handicap Review ›
          </Link>
        </div>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <Th onClick={() => setSortKey("name")} active={sortKey === "name"}>
                  Player
                </Th>
                <Th onClick={() => setSortKey("totalPoints")} active={sortKey === "totalPoints"} right>
                  Pts
                </Th>
                <Th onClick={() => setSortKey("avgPerRound")} active={sortKey === "avgPerRound"} right>
                  Avg
                </Th>
                <Th onClick={() => setSortKey("handicap")} active={sortKey === "handicap"} right>
                  HCP
                </Th>
                <Th onClick={() => setSortKey("birdies")} active={sortKey === "birdies"} right>
                  Bird
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.player.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-3 font-semibold">
                    <span className="mr-2 text-muted tabular-nums">{i + 1}</span>
                    {r.player.name}
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums">
                    {r.totalPoints}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted">
                    {r.roundsPlayed ? r.avgPerRound.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {r.handicap === 0 ? "0" : `+${r.handicap}`}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.birdies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-center text-xs text-muted">
          Tap a column header to sort
        </p>
      </section>
    </div>
  );
}

function sortRows(rows: StandingsRow[], key: SortKey): StandingsRow[] {
  const copy = [...rows];
  if (key === "name") {
    return copy.sort((a, b) => a.player.name.localeCompare(b.player.name));
  }
  if (key === "handicap") {
    return copy.sort((a, b) => a.handicap - b.handicap);
  }
  return copy.sort((a, b) => (b[key] as number) - (a[key] as number));
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="truncate text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  right,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  right?: boolean;
}) {
  return (
    <th className={right ? "text-right" : "text-left"}>
      <button
        onClick={onClick}
        className={`w-full px-3 py-2 ${right ? "text-right" : "text-left"} font-bold`}
        style={{ color: active ? "var(--forest)" : "var(--text-muted)" }}
      >
        {children}
        {active && <span aria-hidden> ▾</span>}
      </button>
    </th>
  );
}
