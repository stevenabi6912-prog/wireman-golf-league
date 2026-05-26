"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loading, PageHeader } from "@/components/ui";
import { useSeason } from "@/lib/season-context";
import { defaultFormatForRound } from "@/lib/scoring";
import { randomTeams } from "@/lib/round";
import { TOTAL_ROUNDS, nextRoundNumber, standings } from "@/lib/stats";
import type { NineSelection, RoundFormat, ScrambleTeam } from "@/lib/types";

const NUM_TEAMS = 3;
const TEAM_COLORS = ["#14532D", "#B45309", "#1E3A5F"];

export default function StartRoundPage() {
  const router = useRouter();
  const { season, loading, startRound } = useSeason();

  const [roundNumber, setRoundNumber] = useState(1);
  const [format, setFormat] = useState<RoundFormat>("individual");
  const [formatTouched, setFormatTouched] = useState(false);
  const [nine, setNine] = useState<NineSelection>("front");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  // Absent key = selected. Only deselected players are stored as `false`.
  const [deselected, setDeselected] = useState<Record<string, boolean>>({});
  const [assignment, setAssignment] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!season) return;
    setRoundNumber(nextRoundNumber(season) ?? TOTAL_ROUNDS);
  }, [season]);

  useEffect(() => {
    if (!formatTouched) setFormat(defaultFormatForRound(roundNumber));
  }, [roundNumber, formatTouched]);

  // Players ordered by standings (matters for the round-8 draft).
  const orderedPlayers = useMemo(() => {
    if (!season) return [];
    return standings(season).map((r) => r.player);
  }, [season]);

  if (loading || !season) return <Loading />;

  const isSelected = (id: string) => deselected[id] !== true;
  const selectedPlayers = orderedPlayers.filter((p) => isSelected(p.id));
  const selectedIds = selectedPlayers.map((p) => p.id);
  const isScramble = format === "scramble";

  const teamCounts = Array.from({ length: NUM_TEAMS }, (_, t) =>
    selectedIds.filter((id) => assignment[id] === t).length,
  );
  const allAssigned = selectedIds.every((id) => assignment[id] !== undefined);
  const teamsValid =
    selectedIds.length >= 1 &&
    allAssigned &&
    teamCounts.every((c) => c <= 2);

  const scrambleUndersized = isScramble && selectedIds.length < 4;
  const canBegin =
    selectedIds.length >= 1 && (!isScramble || teamsValid);

  function toggleSelect(id: string) {
    setDeselected((prev) => ({ ...prev, [id]: !prev[id] ? true : false }));
    // Drop any team assignment for a player being removed.
    setAssignment((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

  function drawRandom() {
    const teams = randomTeams(selectedPlayers);
    const next: Record<string, number> = {};
    teams.forEach((team, idx) => {
      team.playerIds.forEach((pid) => {
        next[pid] = idx;
      });
    });
    setAssignment(next);
  }

  function cycleTeam(playerId: string) {
    setAssignment((prev) => {
      const current = prev[playerId];
      const nextTeam =
        current === undefined ? 0 : (current + 1) % (NUM_TEAMS + 1);
      const copy = { ...prev };
      if (nextTeam === NUM_TEAMS) delete copy[playerId];
      else copy[playerId] = nextTeam;
      return copy;
    });
  }

  function begin() {
    if (!canBegin) return;
    let teams: ScrambleTeam[] | undefined;
    if (isScramble) {
      teams = Array.from({ length: NUM_TEAMS }, (_, t) => ({
        id: `team-${t + 1}`,
        playerIds: selectedPlayers
          .filter((p) => assignment[p.id] === t)
          .map((p) => p.id),
      })).filter((t) => t.playerIds.length > 0);
    }
    startRound({ roundNumber, date, nine, format, playerIds: selectedIds, teams });
    router.push("/round/active");
  }

  return (
    <div>
      <PageHeader title="Start Round" back={{ href: "/", label: "Home" }} />

      {/* Round number */}
      <Field label="Round">
        <div className="flex items-center gap-3">
          <button
            className="btn btn-outline h-11 w-11 text-xl"
            onClick={() => setRoundNumber((n) => Math.max(1, n - 1))}
          >
            −
          </button>
          <span className="w-16 text-center text-xl font-bold tabular-nums">
            {roundNumber}
          </span>
          <button
            className="btn btn-outline h-11 w-11 text-xl"
            onClick={() => setRoundNumber((n) => Math.min(TOTAL_ROUNDS, n + 1))}
          >
            +
          </button>
          <span className="text-sm text-muted">of {TOTAL_ROUNDS}</span>
        </div>
      </Field>

      {/* Nine */}
      <Field label="Which nine?">
        <Segmented
          options={[
            { value: "front", label: "Front 9" },
            { value: "back", label: "Back 9" },
          ]}
          value={nine}
          onChange={(v) => setNine(v as NineSelection)}
        />
      </Field>

      {/* Date */}
      <Field label="Date">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="surface w-full rounded-xl border px-4 py-3 text-base"
          style={{ borderColor: "var(--border)" }}
        />
      </Field>

      {/* Format */}
      <Field
        label="Format"
        hint={formatTouched ? "Overridden" : `Auto from round ${roundNumber}`}
      >
        <Segmented
          options={[
            { value: "individual", label: "Individual" },
            { value: "scramble", label: "Scramble" },
            { value: "championship", label: "Champ ×2" },
          ]}
          value={format}
          onChange={(v) => {
            setFormat(v as RoundFormat);
            setFormatTouched(true);
          }}
        />
        {formatTouched && (
          <button
            className="mt-2 text-xs font-semibold"
            style={{ color: "var(--gold)" }}
            onClick={() => setFormatTouched(false)}
          >
            Reset to auto
          </button>
        )}
      </Field>

      {/* Players in this round */}
      <Field
        label="Players in this round"
        hint={`${selectedIds.length} selected`}
      >
        <div className="space-y-2">
          {orderedPlayers.map((p) => {
            const on = isSelected(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleSelect(p.id)}
                className="card flex w-full items-center justify-between py-3 text-left"
                aria-pressed={on}
              >
                <span className="font-semibold">{p.name}</span>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold"
                  style={
                    on
                      ? { backgroundColor: "var(--forest)", color: "#fff" }
                      : {
                          border: "2px solid var(--border)",
                          color: "transparent",
                        }
                  }
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>
        {selectedIds.length === 0 && (
          <p className="mt-2 text-xs" style={{ color: "var(--gold)" }}>
            Select at least one player to begin.
          </p>
        )}
      </Field>

      {/* Scramble teams */}
      {isScramble && (
        <Field label="Teams" hint="Tap a player to cycle their team">
          <button className="btn btn-navy mb-3 w-full" onClick={drawRandom}>
            {roundNumber === 8 ? "Auto-fill teams" : "Random team draw"}
          </button>
          {scrambleUndersized && (
            <p className="mb-2 text-xs" style={{ color: "var(--gold)" }}>
              Scrambles work best with at least 2 teams of 2. You can still
              proceed.
            </p>
          )}
          <div className="space-y-2">
            {selectedPlayers.map((p, idx) => {
              const team = assignment[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => cycleTeam(p.id)}
                  className="card flex w-full items-center justify-between py-3 text-left"
                >
                  <span className="font-semibold">
                    <span className="mr-2 text-xs text-muted">#{idx + 1}</span>
                    {p.name}
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-sm font-bold"
                    style={
                      team === undefined
                        ? {
                            backgroundColor: "var(--surface-2)",
                            color: "var(--text-muted)",
                          }
                        : { backgroundColor: TEAM_COLORS[team], color: "#fff" }
                    }
                  >
                    {team === undefined ? "Unassigned" : `Team ${team + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
          {!teamsValid && selectedIds.length > 0 && (
            <p className="mt-2 text-xs" style={{ color: "var(--gold)" }}>
              Assign every selected player to a team (max 2 per team).
            </p>
          )}
        </Field>
      )}

      <button
        className="btn btn-primary mt-4 w-full py-4 text-lg"
        disabled={!canBegin}
        style={!canBegin ? { opacity: 0.5 } : undefined}
        onClick={begin}
      >
        Begin
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-bold uppercase tracking-wide text-muted">
          {label}
        </span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="surface-2 flex gap-1 rounded-xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="btn flex-1 px-2 py-2.5 text-sm"
          style={
            value === o.value
              ? { backgroundColor: "var(--forest)", color: "#fff" }
              : { color: "var(--text)" }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
