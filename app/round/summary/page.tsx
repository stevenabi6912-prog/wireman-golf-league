"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import RoundScorecard from "@/components/RoundScorecard";
import { EmptyState, Loading, PageHeader } from "@/components/ui";
import { useSeason } from "@/lib/season-context";
import { isHandicapReviewRound } from "@/lib/scoring";
import { formatRoundLabel, playerStats } from "@/lib/stats";

function SummaryContent() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const { season, loading } = useSeason();

  if (loading || !season) return <Loading />;

  const round =
    season.rounds.find((r) => r.id === id) ??
    [...season.rounds].filter((r) => r.completed).slice(-1)[0];

  if (!round) {
    return (
      <div>
        <PageHeader title="Round Summary" back={{ href: "/", label: "Home" }} />
        <EmptyState title="No round found" />
      </div>
    );
  }

  // Which players had their season-best round here?
  const bestIds = new Set(
    season.players
      .filter((p) => playerStats(season, p.id).bestRound?.round.id === round.id)
      .map((p) => p.id),
  );

  const reviewDue = isHandicapReviewRound(round.roundNumber);

  return (
    <div>
      <PageHeader
        title="Round Summary"
        subtitle={formatRoundLabel(round)}
        back={{ href: "/", label: "Home" }}
      />

      <RoundScorecard
        season={season}
        round={round}
        bestRoundPlayerIds={bestIds}
      />

      {reviewDue && (
        <Link
          href="/handicap-review"
          className="btn btn-navy mt-5 w-full py-3"
        >
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

export default function RoundSummaryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SummaryContent />
    </Suspense>
  );
}
