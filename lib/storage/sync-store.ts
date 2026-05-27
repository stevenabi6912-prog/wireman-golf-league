import { getSupabaseClient, isSupabaseConfigured } from "../supabase/client";
import type { SeasonData } from "../types";
import { LocalStorageStore } from "./localStorage";
import { SupabaseStore } from "./supabase-store";
import { diffSeasons } from "./supabase-mappers";
import {
  QUEUE_DEPTH_WARNING,
  SyncQueue,
  type QueuedOp,
} from "./sync-queue";
import type { ReactiveStore, SyncStatus } from "./types";

/**
 * Offline-first store. Reads/writes the local cache for instant, always-working
 * UI, and (when Supabase is configured) mirrors writes to the cloud through a
 * persisted sync queue plus realtime pull. When Supabase is NOT configured it
 * is a transparent pass-through to the local store, so the app keeps working in
 * single-device mode until the backend env vars are set.
 */
export class SyncStore implements ReactiveStore {
  private local = new LocalStorageStore();
  private cloud: SupabaseStore | null = null;
  private queue: SyncQueue | null = null;
  private familyId: string | null = null;
  private lastSaved: SeasonData | null = null;
  private status: SyncStatus = { state: "local", pending: 0 };
  private statusListeners = new Set<(s: SyncStatus) => void>();
  private draining = false;
  private retry = 0;

  constructor() {
    const client = getSupabaseClient();
    if (isSupabaseConfigured() && client && typeof window !== "undefined") {
      this.cloud = new SupabaseStore(client);
      this.queue = new SyncQueue(window.localStorage);
      this.status = { state: navigator.onLine ? "synced" : "offline", pending: this.queue.depth() };
      window.addEventListener("online", () => void this.drain());
      window.addEventListener("offline", () => this.setStatus("offline"));
    }
  }

  get enabled(): boolean {
    return this.cloud !== null && this.queue !== null;
  }

  async load(): Promise<SeasonData | null> {
    const localData = await this.local.load();
    if (!this.enabled) {
      this.lastSaved = localData;
      return localData;
    }
    // Instant: hand back the cache. Cloud reconcile happens via subscribe().
    if (localData) {
      this.lastSaved = localData;
      this.familyId = localData.familyId ?? null;
      return localData;
    }
    // No cache yet — try the cloud directly.
    try {
      const cloud = await this.cloud!.load();
      this.lastSaved = cloud;
      this.familyId = cloud?.familyId ?? null;
      return cloud;
    } catch {
      return null;
    }
  }

  async save(data: SeasonData): Promise<void> {
    await this.local.save(data);
    if (!this.enabled) {
      this.lastSaved = data;
      return;
    }
    try {
      const familyId = await this.resolveFamilyId(data);
      if (!familyId) {
        this.lastSaved = data;
        return; // offline before the family exists; nothing to enqueue yet
      }
      const ops = diffSeasons(this.lastSaved, data, familyId);
      this.lastSaved = data;
      if (ops.length) {
        this.queue!.enqueue(ops);
        void this.drain();
      }
    } catch {
      // Local write already succeeded; cloud will catch up on next drain.
      this.lastSaved = data;
    }
  }

  async clear(): Promise<void> {
    await this.local.clear();
    this.queue?.clear();
    this.lastSaved = null;
  }

  // --- reactive extras -----------------------------------------------------

  subscribe(onUpdate: (season: SeasonData) => void): () => void {
    if (!this.enabled) return () => {};
    void this.reconcile(onUpdate); // initial pull
    const unsub = this.cloud!.subscribeRealtime(() => {
      // Don't clobber unsynced local edits; reconcile only when the queue is
      // empty, otherwise drain first and reconcile afterwards.
      if (this.queue!.depth() > 0) {
        void this.drain().then(() => this.reconcile(onUpdate));
      } else {
        void this.reconcile(onUpdate);
      }
    });
    return unsub;
  }

  onStatus(cb: (s: SyncStatus) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  pendingOps(): QueuedOp[] {
    return this.queue?.list() ?? [];
  }

  async bootstrap(local: SeasonData): Promise<void> {
    if (!this.enabled) return;
    const familyId = await this.resolveFamilyId(local);
    if (!familyId) return;
    const withFamily = { ...local, familyId };
    await this.local.save(withFamily);
    const ops = diffSeasons(null, withFamily, familyId);
    this.lastSaved = withFamily;
    this.queue!.enqueue(ops);
    await this.drain();
  }

  // --- internals -----------------------------------------------------------

  private async resolveFamilyId(data: SeasonData): Promise<string | null> {
    if (this.familyId) return this.familyId;
    if (data.familyId) {
      this.familyId = data.familyId;
      return this.familyId;
    }
    try {
      this.familyId = await this.cloud!.ensureFamily("Wireman Family");
      return this.familyId;
    } catch {
      return null;
    }
  }

  private async reconcile(onUpdate: (season: SeasonData) => void): Promise<void> {
    if (!this.enabled) return;
    try {
      const cloud = await this.cloud!.load();
      if (!cloud) return;
      // Preserve this device's local-only UI state.
      const localActive = (await this.local.load())?.activeRoundId ?? null;
      const merged = { ...cloud, activeRoundId: localActive };
      this.lastSaved = merged;
      this.familyId = merged.familyId ?? this.familyId;
      await this.local.save(merged);
      onUpdate(merged);
      this.setStatus(navigator.onLine ? "synced" : "offline");
    } catch {
      // Leave the cache as-is on a failed pull.
    }
  }

  private async drain(): Promise<void> {
    if (!this.enabled || this.draining) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.setStatus("offline");
      return;
    }
    this.draining = true;
    this.setStatus("syncing");
    try {
      const result = await this.queue!.drain((op) => this.cloud!.executeOp(op));
      if (result.failed) {
        this.retry += 1;
        const delay = Math.min(16000, 2000 * 2 ** (this.retry - 1));
        this.setStatus(navigator.onLine ? "syncing" : "offline");
        setTimeout(() => void this.drain(), delay);
      } else {
        this.retry = 0;
        this.setStatus("synced");
      }
    } finally {
      this.draining = false;
    }
  }

  private setStatus(state: SyncStatus["state"]): void {
    const pending = this.queue?.depth() ?? 0;
    this.status = { state: this.enabled ? state : "local", pending };
    for (const cb of this.statusListeners) cb(this.status);
  }
}

export { QUEUE_DEPTH_WARNING };
