"use client";

import { useState } from "react";
import { EmptyState, Loading, PageHeader } from "@/components/ui";
import { useSeason } from "@/lib/season-context";
import { getAllAchievements, type EarnedAchievement } from "@/lib/insights";
import type { AchievementType } from "@/lib/insights";
import { completedRounds, standings } from "@/lib/stats";

const BADGE: Record<AchievementType, { icon: string; label: string; tone: string }> =
  {
    "first-eagle": { icon: "🦅", label: "First Eagle", tone: "var(--gold)" },
    "first-birdie": { icon: "🐦", label: "First Birdie", tone: "var(--forest)" },
    "personal-best": { icon: "⭐", label: "Personal Best", tone: "var(--navy)" },
    "par-the-round": { icon: "🎯", label: "18+ Points", tone: "var(--gold)" },
    "hole-in-one": { icon: "🕳️", label: "Hole-in-One", tone: "var(--gold)" },
    "first-par": { icon: "✅", label: "First Par", tone: "var(--forest)" },
    "three-in-a-row": { icon: "🔥", label: "Three in a Row", tone: "var(--navy)" },
    sweep: { icon: "🏆", label: "Round Win", tone: "var(--gold)" },
    comeback: { icon: "📈", label: "Comeback", tone: "var(--navy)" },
  };

function contextLine(a: EarnedAchievement): string {
  const base = `${a.player.name}'s ${BADGE[a.type].label.toLowerCase()} — Round ${a.roundNumber}`;
  if (a.hole) {
    const par = a.par ? ` (par ${a.par})` : "";
    const scored = a.strokes != null ? `, scored ${a.strokes}` : "";
    return `${base}, Hole ${a.hole}${par}${scored}`;
  }
  return `${base}: ${a.detail}`;
}

export default function TrophyRoomPage() {
  const { season, loading } = useSeason();
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const [openBadge, setOpenBadge] = useState<string | null>(null);

  if (loading || !season) return <Loading />;

  const all = getAllAchievements(season);
  const roundsCount = completedRounds(season).length;
  const orderedPlayers = standings(season).map((r) => r.player);
  const leaderId = orderedPlayers[0]?.id;

  // Default-expand the season leader.
  const isExpanded = (id: string) =>
    expanded === null ? id === leaderId : expanded.has(id);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const base = prev ?? new Set(leaderId ? [leaderId] : []);
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <PageHeader title="Trophy Room" />

      <div
        className="card"
        style={{ backgroundColor: "var(--gold)", borderColor: "var(--gold)", color: "#fff" }}
      >
        <p className="text-sm font-semibold opacity-90">Wireman Family</p>
        <p className="text-2xl font-extrabold">
          {all.length} badge{all.length === 1 ? "" : "s"} earned
        </p>
        <p className="text-sm opacity-90">
          across {roundsCount} round{roundsCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {orderedPlayers.map((p) => {
          const badges = all.filter((a) => a.player.id === p.id);
          const open = isExpanded(p.id);
          return (
            <div key={p.id} className="card p-0">
              <button
                onClick={() => toggle(p.id)}
                className="flex w-full items-center justify-between px-4 py-3"
              >
                <span className="font-bold">{p.name}</span>
                <span className="flex items-center gap-2 text-sm text-muted">
                  {badges.length} badge{badges.length === 1 ? "" : "s"}
                  <span aria-hidden>{open ? "▾" : "▸"}</span>
                </span>
              </button>

              {open && (
                <div className="px-4 pb-4">
                  {badges.length === 0 ? (
                    <EmptyState title="No badges yet — go get one." />
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {badges.map((a, i) => {
                          const key = `${p.id}-${i}`;
                          return (
                            <button
                              key={key}
                              onClick={() =>
                                setOpenBadge((cur) => (cur === key ? null : key))
                              }
                              className="flex flex-col items-center rounded-xl px-3 py-2 text-center"
                              style={{
                                backgroundColor:
                                  openBadge === key
                                    ? BADGE[a.type].tone
                                    : "var(--surface-2)",
                                color: openBadge === key ? "#fff" : "var(--text)",
                                minWidth: "84px",
                              }}
                            >
                              <span className="text-2xl" aria-hidden>
                                {BADGE[a.type].icon}
                              </span>
                              <span className="text-xs font-semibold">
                                {BADGE[a.type].label}
                              </span>
                              <span className="text-[10px] opacity-80">
                                R{a.roundNumber}
                                {a.hole ? `, H${a.hole}` : ""}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {badges.map((a, i) => {
                        const key = `${p.id}-${i}`;
                        if (openBadge !== key) return null;
                        return (
                          <div
                            key={`ctx-${key}`}
                            className="surface-2 mt-3 rounded-xl px-4 py-3 text-sm"
                          >
                            {contextLine(a)}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
