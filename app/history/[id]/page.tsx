"use client";

import RoundScorecard from "@/components/RoundScorecard";
import { EmptyState, Loading, PageHeader } from "@/components/ui";
import { useSeason } from "@/lib/season-context";
import { formatRoundLabel } from "@/lib/stats";

export default function RoundDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { season, loading } = useSeason();
  if (loading || !season) return <Loading />;

  const round = season.rounds.find((r) => r.id === params.id);
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
    </div>
  );
}
