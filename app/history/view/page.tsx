"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import RoundScorecard from "@/components/RoundScorecard";
import { NotesCard } from "@/components/RoundNotes";
import { EmptyState, Loading, PageHeader } from "@/components/ui";
import { useSeason } from "@/lib/season-context";
import { formatRoundLabel } from "@/lib/stats";

function RoundDetail() {
  const params = useSearchParams();
  const id = params.get("id");
  const { season, loading } = useSeason();

  if (loading || !season) return <Loading />;

  const round = season.rounds.find((r) => r.id === id);
  if (!round) {
    return (
      <div>
        <PageHeader
          title="Scorecard"
          back={{ href: "/history", label: "History" }}
        />
        <EmptyState title="Round not found" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Round ${round.roundNumber}`}
        subtitle={`${formatRoundLabel(round)} · ${round.date} · ${
          round.nine === "front" ? "Front 9" : "Back 9"
        }`}
        back={{ href: "/history", label: "History" }}
      />
      <RoundScorecard season={season} round={round} />
      {round.notes && round.notes.trim() && (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
            Round Notes
          </h2>
          <NotesCard note={round.notes} />
        </div>
      )}
    </div>
  );
}

export default function RoundDetailPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RoundDetail />
    </Suspense>
  );
}
