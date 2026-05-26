"use client";

import { useState } from "react";
import { Loading, PageHeader } from "@/components/ui";
import { useSeason } from "@/lib/season-context";
import { mostImproved, playerStats } from "@/lib/stats";

export default function StatsPage() {
  const { season, loading } = useSeason();
  const [selected, setSelected] = useState<string | null>(null);

  if (loading || !season) return <Loading />;

  const playerId = selected ?? season.players[0]?.id;
  const stats = playerStats(season, playerId);
  const improved = mostImproved(season);

  return (
    <div>
      <PageHeader title="Player Stats" />

      {improved && (
        <div className="card mb-4" style={{ borderColor: "var(--gold)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--gold)" }}>
            Most Improved
          </p>
          <p className="text-lg font-bold">
            {improved.player.name}{" "}
            <span className="text-sm font-normal text-muted">
              (handicap −{improved.delta})
            </span>
          </p>
        </div>
      )}

      {/* Player chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {season.players.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className="btn px-4 py-2 text-sm"
            style={
              p.id === playerId
                ? { backgroundColor: "var(--forest)", color: "#fff" }
                : { backgroundColor: "var(--surface-2)", color: "var(--text)" }
            }
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Stat grid */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <StatCard label="Rounds played" value={`${stats.roundsPlayed}`} />
        <StatCard label="Total points" value={`${stats.totalPoints}`} />
        <StatCard
          label="Avg / round"
          value={stats.roundsPlayed ? stats.avgPerRound.toFixed(1) : "—"}
        />
        <StatCard
          label="Current handicap"
          value={
            stats.player.handicap === 0 ? "0" : `+${stats.player.handicap}`
          }
        />
        <StatCard label="Birdies" value={`${stats.birdies}`} />
        <StatCard label="Eagles" value={`${stats.eagles}`} />
      </div>

      {/* Best / worst */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="card">
          <p className="text-xs text-muted">Best round</p>
          {stats.bestRound ? (
            <p className="font-bold">
              {stats.bestRound.points} pts
              <span className="ml-1 text-xs font-normal text-muted">
                R{stats.bestRound.round.roundNumber}
              </span>
            </p>
          ) : (
            <p className="font-bold">—</p>
          )}
        </div>
        <div className="card">
          <p className="text-xs text-muted">Worst round</p>
          {stats.worstRound ? (
            <p className="font-bold">
              {stats.worstRound.points} pts
              <span className="ml-1 text-xs font-normal text-muted">
                R{stats.worstRound.round.roundNumber}
              </span>
            </p>
          ) : (
            <p className="font-bold">—</p>
          )}
        </div>
      </div>

      {/* Handicap history */}
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
          Handicap history
        </h2>
        <div className="card">
          <HandicapChart history={stats.handicapHistory} />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function HandicapChart({
  history,
}: {
  history: { roundNumber: number; handicap: number }[];
}) {
  if (history.length < 2) {
    return (
      <p className="text-sm text-muted">
        No handicap changes yet. Adjustments are reviewed after rounds 3, 6, and
        9.
      </p>
    );
  }

  const W = 280;
  const H = 90;
  const pad = 14;
  const maxH = Math.max(...history.map((h) => h.handicap), 1);
  const minH = Math.min(...history.map((h) => h.handicap), 0);
  const span = maxH - minH || 1;
  const stepX = (W - pad * 2) / (history.length - 1);
  const y = (v: number) =>
    H - pad - ((v - minH) / span) * (H - pad * 2);
  const pts = history.map((h, i) => ({
    x: pad + i * stepX,
    yv: y(h.handicap),
    label: h.handicap,
  }));
  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.yv}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Handicap over time">
      <path d={path} fill="none" stroke="var(--forest)" strokeWidth={2.5} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.yv} r={4} fill="var(--gold)" />
          <text
            x={p.x}
            y={p.yv - 8}
            textAnchor="middle"
            fontSize="10"
            fill="var(--text-muted)"
          >
            {p.label === 0 ? "0" : `+${p.label}`}
          </text>
        </g>
      ))}
    </svg>
  );
}
