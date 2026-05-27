import type { Photo, Round, SeasonData } from "../types";
import { holeScoreId, playerScoreId, teamScoreId } from "./ids";

export type SyncTable =
  | "families"
  | "players"
  | "holes"
  | "rounds"
  | "player_scores"
  | "hole_scores"
  | "team_scores"
  | "handicap_changes"
  | "photos";

export interface SyncOp {
  table: SyncTable;
  op: "upsert" | "delete";
  /** Stable key for dedup within the queue (latest write wins per key). */
  key: string;
  /** Column used as the conflict target for upserts. */
  onConflict: string;
  row: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Row builders — produce the "content" of a row WITHOUT updated_at, so the
// diff can compare by content. updated_at is stamped when an op is emitted.
// ---------------------------------------------------------------------------

function playerRow(p: SeasonData["players"][number], familyId: string) {
  return {
    id: p.id,
    family_id: familyId,
    name: p.name,
    handicap: p.handicap,
    handicap_effective_from_round: p.handicapEffectiveFromRound,
    tees: p.tees,
  };
}

function holeRow(h: SeasonData["holes"][number], familyId: string) {
  return {
    id: holeScoreId(familyId, h.number), // stable per (family, hole)
    family_id: familyId,
    hole_number: h.number,
    par: h.par,
  };
}

function roundRow(r: Round, familyId: string) {
  return {
    id: r.id,
    family_id: familyId,
    round_number: r.roundNumber,
    date: r.date,
    format: r.format,
    nine: r.nine,
    completed: r.completed,
    player_ids: r.playerIds,
    pars: r.pars,
    notes: r.notes ?? null,
  };
}

function photoRow(p: Photo, familyId: string) {
  return {
    id: p.id,
    family_id: familyId,
    round_id: p.roundId,
    hole: p.hole,
    player_id: p.playerId,
    storage_path: p.storagePath,
    caption: p.caption ?? null,
  };
}

/** All content rows for a season, keyed for diffing. */
function seasonRows(
  season: SeasonData,
  familyId: string,
): Map<string, { table: SyncTable; onConflict: string; row: Record<string, unknown> }> {
  const rows = new Map<
    string,
    { table: SyncTable; onConflict: string; row: Record<string, unknown> }
  >();
  const put = (
    table: SyncTable,
    key: string,
    onConflict: string,
    row: Record<string, unknown>,
  ) => rows.set(`${table}:${key}`, { table, onConflict, row });

  for (const p of season.players)
    put("players", p.id, "id", playerRow(p, familyId));
  for (const h of season.holes)
    put("holes", String(h.number), "family_id,hole_number", holeRow(h, familyId));

  for (const r of season.rounds) {
    put("rounds", r.id, "id", roundRow(r, familyId));
    for (const ps of r.playerScores) {
      const psId = playerScoreId(r.id, ps.playerId);
      put("player_scores", psId, "id", {
        id: psId,
        round_id: r.id,
        player_id: ps.playerId,
        handicap_at_round: ps.handicap,
      });
      for (const hs of ps.holeScores) {
        if (hs.strokes == null) continue;
        const hsId = holeScoreId(psId, hs.hole);
        put("hole_scores", hsId, "id", {
          id: hsId,
          player_score_id: psId,
          hole: hs.hole,
          strokes: hs.strokes,
        });
      }
    }
    for (const ts of r.teamScores ?? []) {
      const tsId = teamScoreId(r.id, ts.teamId);
      put("team_scores", tsId, "id", {
        id: tsId,
        round_id: r.id,
        team_id: ts.teamId,
        player_ids: round_teamPlayerIds(r, ts.teamId),
        handicaps: ts.handicaps,
        hole_scores: ts.holeScores,
      });
    }
  }

  for (const c of season.handicapChanges)
    put("handicap_changes", c.id, "id", {
      id: c.id,
      player_id: c.playerId,
      from_value: c.from,
      to_value: c.to,
      after_round: c.afterRound,
    });

  for (const p of season.photos)
    put("photos", p.id, "id", photoRow(p, familyId));

  return rows;
}

function round_teamPlayerIds(r: Round, teamId: string): string[] {
  return r.teams?.find((t) => t.id === teamId)?.playerIds ?? [];
}

const MUTABLE_TABLES: ReadonlySet<SyncTable> = new Set([
  "players",
  "rounds",
  "hole_scores",
  "team_scores",
]);

/**
 * Diff two season snapshots into the minimal set of upsert/delete operations.
 * Only changed rows are emitted. Deletes are produced for rounds and photos
 * that disappeared (round deletes cascade to their scores in the DB).
 */
export function diffSeasons(
  prev: SeasonData | null,
  next: SeasonData,
  familyId: string,
): SyncOp[] {
  const prevRows = prev ? seasonRows(prev, familyId) : new Map();
  const nextRows = seasonRows(next, familyId);
  const ops: SyncOp[] = [];
  const now = new Date().toISOString();

  for (const [key, entry] of nextRows) {
    const before = prevRows.get(key);
    if (before && JSON.stringify(before.row) === JSON.stringify(entry.row)) {
      continue; // unchanged
    }
    const row = MUTABLE_TABLES.has(entry.table)
      ? { ...entry.row, updated_at: now }
      : entry.row;
    ops.push({
      table: entry.table,
      op: "upsert",
      key,
      onConflict: entry.onConflict,
      row,
    });
  }

  // Deletes for rounds / photos that were removed.
  for (const [key, entry] of prevRows) {
    if (nextRows.has(key)) continue;
    if (entry.table === "rounds" || entry.table === "photos") {
      ops.push({
        table: entry.table,
        op: "delete",
        key,
        onConflict: entry.onConflict,
        row: { id: entry.row.id },
      });
    }
  }

  return ops;
}
