import type { SeasonData } from "../types";

/**
 * Storage backend contract. The UI only ever talks to this interface, so a
 * different backend (e.g. Supabase) can be dropped in without touching any
 * component. Methods are async to allow for network-backed implementations.
 */
export interface SeasonStore {
  load(): Promise<SeasonData | null>;
  save(data: SeasonData): Promise<void>;
  clear(): Promise<void>;
}

export type SyncState = "local" | "offline" | "syncing" | "synced";

export interface SyncStatus {
  state: SyncState;
  pending: number;
}

/**
 * Optional reactive capabilities a store may add on top of SeasonStore. The
 * context feature-detects these, so a plain SeasonStore still works.
 */
export interface ReactiveStore extends SeasonStore {
  /** Push remote updates into the app. Returns an unsubscribe function. */
  subscribe?(onUpdate: (season: SeasonData) => void): () => void;
  /** Observe sync status changes. Returns an unsubscribe function. */
  onStatus?(cb: (status: SyncStatus) => void): () => void;
  getStatus?(): SyncStatus;
  /** Upload a local season to the cloud (first-time migration). */
  bootstrap?(local: SeasonData): Promise<void>;
  /** Pending sync queue contents, for the debug view. */
  pendingOps?(): unknown[];
}
