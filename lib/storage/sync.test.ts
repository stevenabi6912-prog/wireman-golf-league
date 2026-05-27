import { describe, expect, it, vi } from "vitest";
import { createRound } from "../round";
import { seedSeason } from "../seed";
import { deterministicUuid } from "./ids";
import { diffSeasons, type SyncOp } from "./supabase-mappers";
import { MemoryKV, SyncQueue } from "./sync-queue";

function op(table: SyncOp["table"], key: string): SyncOp {
  return { table, op: "upsert", key: `${table}:${key}`, onConflict: "id", row: { id: key } };
}

describe("deterministicUuid", () => {
  it("is stable and uuid-shaped", () => {
    const a = deterministicUuid("ps:r1:dad");
    const b = deterministicUuid("ps:r1:dad");
    expect(a).toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("differs for different keys", () => {
    expect(deterministicUuid("a")).not.toBe(deterministicUuid("b"));
  });
});

describe("SyncQueue", () => {
  it("enqueues and reports depth", () => {
    const q = new SyncQueue(new MemoryKV());
    q.enqueue([op("rounds", "r1"), op("hole_scores", "h1")]);
    expect(q.depth()).toBe(2);
  });

  it("collapses repeated writes to the same row (last write wins)", () => {
    const q = new SyncQueue(new MemoryKV());
    const first = { ...op("hole_scores", "h1"), row: { id: "h1", strokes: 4 } };
    const second = { ...op("hole_scores", "h1"), row: { id: "h1", strokes: 7 } };
    q.enqueue([first]);
    q.enqueue([second]);
    expect(q.depth()).toBe(1);
    expect(q.list()[0].row).toEqual({ id: "h1", strokes: 7 });
  });

  it("orders upserts FK-safely (rounds before hole_scores), deletes last", () => {
    const q = new SyncQueue(new MemoryKV());
    q.enqueue([
      op("hole_scores", "h1"),
      { ...op("photos", "p1"), op: "delete" },
      op("rounds", "r1"),
      op("players", "dad"),
    ]);
    const tables = q.ordered().map((o) => `${o.op}:${o.table}`);
    expect(tables).toEqual([
      "upsert:players",
      "upsert:rounds",
      "upsert:hole_scores",
      "delete:photos",
    ]);
  });

  it("drains successfully and empties", async () => {
    const q = new SyncQueue(new MemoryKV());
    q.enqueue([op("rounds", "r1"), op("hole_scores", "h1")]);
    const exec = vi.fn().mockResolvedValue(undefined);
    const result = await q.drain(exec);
    expect(result.failed).toBe(false);
    expect(result.processed).toBe(2);
    expect(q.depth()).toBe(0);
  });

  it("keeps ops queued when the backend is unreachable, then drains on retry", async () => {
    const q = new SyncQueue(new MemoryKV());
    q.enqueue([op("rounds", "r1"), op("hole_scores", "h1")]);

    // Offline: every write fails — nothing drains.
    const failing = vi.fn().mockRejectedValue(new Error("offline"));
    const r1 = await q.drain(failing);
    expect(r1.failed).toBe(true);
    expect(q.depth()).toBe(2);

    // Reconnect: writes succeed — queue empties.
    const ok = vi.fn().mockResolvedValue(undefined);
    const r2 = await q.drain(ok);
    expect(r2.failed).toBe(false);
    expect(q.depth()).toBe(0);
  });
});

describe("diffSeasons", () => {
  function seasonWithScore(strokes: number) {
    const s = seedSeason();
    s.familyId = "fam-1";
    const round = createRound(s, {
      roundNumber: 1,
      date: "2026-05-01",
      nine: "front",
      format: "individual",
      playerIds: ["dad"],
    });
    round.playerScores[0].holeScores[0].strokes = strokes;
    s.rounds = [round];
    return s;
  }

  it("emits creates for a brand-new season", () => {
    const ops = diffSeasons(null, seasonWithScore(4), "fam-1");
    const tables = new Set(ops.map((o) => o.table));
    expect(tables.has("players")).toBe(true);
    expect(tables.has("holes")).toBe(true);
    expect(tables.has("rounds")).toBe(true);
    expect(tables.has("player_scores")).toBe(true);
    expect(tables.has("hole_scores")).toBe(true);
  });

  it("emits only the changed hole when a single score changes", () => {
    const prev = seasonWithScore(4);
    const next = JSON.parse(JSON.stringify(prev)) as typeof prev;
    next.rounds[0].playerScores[0].holeScores[0].strokes = 5;
    const ops = diffSeasons(prev, next, "fam-1");
    expect(ops.map((o) => o.table)).toEqual(["hole_scores"]);
    expect(ops[0].row.strokes).toBe(5);
    expect(ops[0].row.updated_at).toBeTypeOf("string");
  });

  it("emits a delete when a round is removed", () => {
    const prev = seasonWithScore(4);
    const next = JSON.parse(JSON.stringify(prev)) as typeof prev;
    next.rounds = [];
    const ops = diffSeasons(prev, next, "fam-1");
    expect(ops.some((o) => o.table === "rounds" && o.op === "delete")).toBe(true);
  });
});
