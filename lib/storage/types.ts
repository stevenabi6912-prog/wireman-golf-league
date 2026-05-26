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
