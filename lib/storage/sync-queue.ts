import type { SyncOp, SyncTable } from "./supabase-mappers";

export interface QueuedOp extends SyncOp {
  enqueuedAt: number;
}

export type OpExecutor = (op: SyncOp) => Promise<void>;

export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SYNC_QUEUE_KEY = "wireman-golf-league:sync_queue";
export const QUEUE_DEPTH_WARNING = 10;

// FK-safe processing order for upserts. Deletes run after upserts.
const TABLE_ORDER: SyncTable[] = [
  "families",
  "players",
  "holes",
  "rounds",
  "player_scores",
  "hole_scores",
  "team_scores",
  "handicap_changes",
  "photos",
];

export class SyncQueue {
  constructor(private storage: KVStore) {}

  list(): QueuedOp[] {
    try {
      const raw = this.storage.getItem(SYNC_QUEUE_KEY);
      return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
    } catch {
      return [];
    }
  }

  private persist(ops: QueuedOp[]): void {
    this.storage.setItem(SYNC_QUEUE_KEY, JSON.stringify(ops));
  }

  depth(): number {
    return this.list().length;
  }

  /** Add ops, collapsing any earlier pending op for the same row (latest wins). */
  enqueue(ops: SyncOp[]): void {
    if (ops.length === 0) return;
    const byKey = new Map<string, QueuedOp>();
    for (const op of this.list()) byKey.set(op.key, op);
    const now = Date.now();
    for (const op of ops) byKey.set(op.key, { ...op, enqueuedAt: now });
    this.persist([...byKey.values()]);
  }

  /** Pending ops sorted FK-safely: upserts by table order, then deletes. */
  ordered(): QueuedOp[] {
    const rank = (op: QueuedOp) =>
      (op.op === "delete" ? 100 : 0) + TABLE_ORDER.indexOf(op.table);
    return [...this.list()].sort(
      (a, b) => rank(a) - rank(b) || a.enqueuedAt - b.enqueuedAt,
    );
  }

  private remove(key: string): void {
    this.persist(this.list().filter((op) => op.key !== key));
  }

  /**
   * Process the queue in order. Stops at the first failure (the remaining ops
   * stay queued for the next attempt). Returns how many succeeded.
   */
  async drain(
    exec: OpExecutor,
  ): Promise<{ processed: number; failed: boolean; remaining: number }> {
    let processed = 0;
    for (const op of this.ordered()) {
      try {
        await exec(op);
        this.remove(op.key);
        processed += 1;
      } catch {
        return { processed, failed: true, remaining: this.depth() };
      }
    }
    return { processed, failed: false, remaining: 0 };
  }

  clear(): void {
    this.storage.removeItem(SYNC_QUEUE_KEY);
  }
}

/** In-memory KVStore for tests / SSR. */
export class MemoryKV implements KVStore {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}
