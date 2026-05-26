"use client";

import { useRef, useState } from "react";
import { PageHeader, Loading } from "@/components/ui";
import { useSeason } from "@/lib/season-context";
import { SEASON_VERSION } from "@/lib/seed";
import type { SeasonData } from "@/lib/types";

export default function SettingsPage() {
  const {
    season,
    loading,
    updatePlayerHandicap,
    updateHolePar,
    loadEllaSharpPars,
    resetSeason,
    replaceSeason,
  } = useSeason();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDefaults, setConfirmDefaults] = useState(false);

  if (loading || !season) return <Loading />;

  function handleExport() {
    if (!season) return;
    const blob = new Blob([JSON.stringify(season, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wireman-golf-season-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as SeasonData;
      if (
        !data ||
        !Array.isArray(data.players) ||
        !Array.isArray(data.holes) ||
        !Array.isArray(data.rounds)
      ) {
        throw new Error("File is missing required season fields.");
      }
      replaceSeason({
        version: data.version ?? SEASON_VERSION,
        players: data.players,
        holes: data.holes,
        rounds: data.rounds,
        handicapChanges: data.handicapChanges ?? [],
        activeRoundId: data.activeRoundId ?? null,
      });
      setImportMsg(`Imported ${data.rounds.length} round(s) successfully.`);
    } catch (err) {
      setImportMsg(
        `Import failed: ${err instanceof Error ? err.message : "bad file"}`,
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Ella Sharp Park · Jackson, MI" />

      {/* Handicaps */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
          Player handicaps
        </h2>
        <div className="card space-y-3">
          {season.players.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <span className="font-semibold">{p.name}</span>
              <div className="flex items-center gap-3">
                <button
                  aria-label={`Decrease ${p.name} handicap`}
                  className="btn btn-outline h-11 w-11 text-xl"
                  onClick={() =>
                    updatePlayerHandicap(p.id, p.handicap - 1)
                  }
                >
                  −
                </button>
                <span className="w-10 text-center text-lg font-bold tabular-nums">
                  {p.handicap === 0 ? "0" : `+${p.handicap}`}
                </span>
                <button
                  aria-label={`Increase ${p.name} handicap`}
                  className="btn btn-outline h-11 w-11 text-xl"
                  onClick={() =>
                    updatePlayerHandicap(p.id, p.handicap + 1)
                  }
                >
                  +
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted">
            Handicap is added to course par for personal par. Floor is 0.
          </p>
        </div>
      </section>

      {/* Hole pars */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
          Course pars (holes 1–18)
        </h2>
        <div className="card space-y-2">
          {season.holes.map((h) => (
            <div key={h.number} className="flex items-center justify-between">
              <span className="font-semibold tabular-nums">
                Hole {h.number}
                <span className="ml-2 text-xs font-normal text-muted">
                  {h.number <= 9 ? "front" : "back"}
                </span>
              </span>
              <div className="flex gap-1.5">
                {[3, 4, 5].map((par) => (
                  <button
                    key={par}
                    className="btn h-11 w-11 text-base"
                    onClick={() => updateHolePar(h.number, par)}
                    style={
                      h.par === par
                        ? { backgroundColor: "var(--forest)", color: "#fff" }
                        : {
                            backgroundColor: "var(--surface-2)",
                            color: "var(--text)",
                          }
                    }
                  >
                    {par}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            className="btn btn-outline w-full"
            onClick={() => setConfirmDefaults(true)}
          >
            Load Ella Sharp Park defaults
          </button>
        </div>
      </section>

      {/* Backup */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
          Backup &amp; restore
        </h2>
        <div className="card space-y-3">
          <button className="btn btn-navy w-full" onClick={handleExport}>
            Export season as JSON
          </button>
          <button
            className="btn btn-outline w-full"
            onClick={() => fileRef.current?.click()}
          >
            Import season from JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImport}
          />
          {importMsg && (
            <p className="text-sm" style={{ color: "var(--gold)" }}>
              {importMsg}
            </p>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section className="mb-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
          Danger zone
        </h2>
        <div className="card space-y-3">
          {!confirmReset ? (
            <button
              className="btn w-full"
              style={{ backgroundColor: "#b91c1c", color: "#fff" }}
              onClick={() => setConfirmReset(true)}
            >
              Reset season
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                This deletes all rounds and resets handicaps. Are you sure?
              </p>
              <div className="flex gap-2">
                <button
                  className="btn flex-1"
                  style={{ backgroundColor: "#b91c1c", color: "#fff" }}
                  onClick={() => {
                    resetSeason();
                    setConfirmReset(false);
                    setImportMsg(null);
                  }}
                >
                  Yes, reset
                </button>
                <button
                  className="btn btn-outline flex-1"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {confirmDefaults && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-sm">
            <h2 className="mb-1 text-lg font-bold">
              Load Ella Sharp Park defaults?
            </h2>
            <p className="text-sm text-muted">
              This replaces all 18 hole pars with the official course values
              (front 36 / back 35 / total 71). Any par edits you&apos;ve made
              will be overwritten. Completed rounds keep their own scorecards.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="btn btn-outline flex-1 py-3"
                onClick={() => setConfirmDefaults(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary flex-1 py-3"
                onClick={() => {
                  loadEllaSharpPars();
                  setConfirmDefaults(false);
                }}
              >
                Load defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
