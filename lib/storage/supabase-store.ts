import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "../supabase/client";
import { SEASON_VERSION } from "../seed";
import type {
  HoleScore,
  PlayerRoundScore,
  Round,
  ScrambleTeam,
  SeasonData,
  TeamRoundScore,
} from "../types";
import { playerScoreId } from "./ids";
import type { SyncOp } from "./supabase-mappers";

/** Public URL for a stored photo path. */
export function photoPublicUrl(
  supabase: SupabaseClient,
  storagePath: string,
): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath).data
    .publicUrl;
}

const TABLES = [
  "rounds",
  "player_scores",
  "hole_scores",
  "team_scores",
  "handicap_changes",
  "photos",
  "players",
  "holes",
] as const;

export class SupabaseStore {
  constructor(private supabase: SupabaseClient) {}

  /** The single shared family row, creating none. */
  async getFamilyId(): Promise<string | null> {
    const { data } = await this.supabase
      .from("families")
      .select("id")
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  }

  /** Return the existing family id, creating the row if needed. */
  async ensureFamily(name: string): Promise<string> {
    const existing = await this.getFamilyId();
    if (existing) return existing;
    const { data, error } = await this.supabase
      .from("families")
      .insert({ name })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  /** Assemble the full season from the relational tables, or null if empty. */
  async load(): Promise<SeasonData | null> {
    const familyId = await this.getFamilyId();
    if (!familyId) return null;

    const [
      players,
      holes,
      rounds,
      playerScores,
      holeScores,
      teamScores,
      handicapChanges,
      photos,
    ] = await Promise.all([
      this.rows("players", "family_id", familyId),
      this.rows("holes", "family_id", familyId),
      this.rows("rounds", "family_id", familyId),
      this.rows("player_scores"),
      this.rows("hole_scores"),
      this.rows("team_scores"),
      this.rows("handicap_changes"),
      this.rows("photos", "family_id", familyId),
    ]);

    const holeScoresByPs = new Map<string, Record<string, unknown>[]>();
    for (const hs of holeScores) {
      const k = hs.player_score_id as string;
      (holeScoresByPs.get(k) ?? holeScoresByPs.set(k, []).get(k)!).push(hs);
    }
    const psByRound = new Map<string, Record<string, unknown>[]>();
    for (const ps of playerScores) {
      const k = ps.round_id as string;
      (psByRound.get(k) ?? psByRound.set(k, []).get(k)!).push(ps);
    }
    const tsByRound = new Map<string, Record<string, unknown>[]>();
    for (const ts of teamScores) {
      const k = ts.round_id as string;
      (tsByRound.get(k) ?? tsByRound.set(k, []).get(k)!).push(ts);
    }

    const assembledRounds: Round[] = rounds.map((r) => {
      const roundId = r.id as string;
      const ps = psByRound.get(roundId) ?? [];
      const playerScoresOut: PlayerRoundScore[] = ps.map((row) => {
        const psId = playerScoreId(roundId, row.player_id as string);
        const strokesByHole = new Map<number, number>();
        for (const hs of holeScoresByPs.get(psId) ?? [])
          strokesByHole.set(hs.hole as number, hs.strokes as number);
        const holeScoresOut: HoleScore[] = Array.from({ length: 9 }, (_, i) => ({
          hole: i + 1,
          strokes: strokesByHole.has(i + 1) ? strokesByHole.get(i + 1)! : null,
        }));
        return {
          playerId: row.player_id as string,
          handicap: row.handicap_at_round as number,
          holeScores: holeScoresOut,
        };
      });

      const tsRows = tsByRound.get(roundId) ?? [];
      const teams: ScrambleTeam[] = tsRows.map((t) => ({
        id: t.team_id as string,
        playerIds: (t.player_ids as string[]) ?? [],
      }));
      const teamScoresOut: TeamRoundScore[] = tsRows.map((t) => ({
        teamId: t.team_id as string,
        handicaps: (t.handicaps as Record<string, number>) ?? {},
        holeScores: (t.hole_scores as HoleScore[]) ?? [],
      }));

      return {
        id: roundId,
        roundNumber: r.round_number as number,
        date: r.date as string,
        format: r.format as Round["format"],
        nine: r.nine as Round["nine"],
        completed: Boolean(r.completed),
        pars: (r.pars as number[]) ?? [],
        playerIds: (r.player_ids as string[]) ?? [],
        notes: (r.notes as string) ?? undefined,
        playerScores: playerScoresOut,
        teams: teams.length ? teams : undefined,
        teamScores: teamScoresOut.length ? teamScoresOut : undefined,
      };
    });

    return {
      version: SEASON_VERSION,
      familyId,
      players: players.map((p) => ({
        id: p.id as string,
        name: p.name as string,
        handicap: p.handicap as number,
        handicapEffectiveFromRound: p.handicap_effective_from_round as number,
        tees: p.tees as never,
      })),
      holes: holes
        .map((h) => ({ number: h.hole_number as number, par: h.par as number }))
        .sort((a, b) => a.number - b.number),
      rounds: assembledRounds.sort((a, b) => a.roundNumber - b.roundNumber),
      handicapChanges: handicapChanges.map((c) => ({
        id: c.id as string,
        playerId: c.player_id as string,
        from: c.from_value as number,
        to: c.to_value as number,
        afterRound: c.after_round as number,
        timestamp: (c.created_at as string) ?? new Date().toISOString(),
      })),
      photos: photos.map((p) => ({
        id: p.id as string,
        roundId: p.round_id as string,
        hole: (p.hole as number) ?? null,
        playerId: (p.player_id as string) ?? null,
        storagePath: p.storage_path as string,
        url: photoPublicUrl(this.supabase, p.storage_path as string),
        caption: (p.caption as string) ?? undefined,
        createdAt: (p.created_at as string) ?? new Date().toISOString(),
      })),
      activeRoundId: null, // device-local; filled from local cache by sync-store
    };
  }

  private async rows(
    table: string,
    col?: string,
    value?: string,
  ): Promise<Record<string, unknown>[]> {
    let query = this.supabase.from(table).select("*");
    if (col && value) query = query.eq(col, value);
    const { data, error } = await query;
    if (error) throw error;
    return (data as Record<string, unknown>[]) ?? [];
  }

  /** Apply one queued operation to Supabase. */
  async executeOp(op: SyncOp): Promise<void> {
    if (op.op === "delete") {
      const { error } = await this.supabase
        .from(op.table)
        .delete()
        .eq("id", op.row.id as string);
      if (error) throw error;
      return;
    }
    const { error } = await this.supabase
      .from(op.table)
      .upsert(op.row, { onConflict: op.onConflict });
    if (error) throw error;
  }

  /** Notify on any relevant remote change. Returns an unsubscribe fn. */
  subscribeRealtime(onChange: () => void): () => void {
    const channel = this.supabase.channel("season-sync");
    for (const table of TABLES) {
      (channel.on as (...args: unknown[]) => void)(
        "postgres_changes",
        { event: "*", schema: "public", table },
        onChange,
      );
    }
    channel.subscribe();
    return () => {
      void this.supabase.removeChannel(channel);
    };
  }
}
