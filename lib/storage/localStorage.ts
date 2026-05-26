import type { SeasonData } from "../types";
import type { SeasonStore } from "./types";

const STORAGE_KEY = "wireman-golf-league:v1";

/**
 * localStorage-backed season store. Single-device persistence for v1.
 * Writes are synchronous under the hood but the interface stays async so the
 * backend can later be swapped for a network store with no UI changes.
 */
export class LocalStorageStore implements SeasonStore {
  private key: string;

  constructor(key: string = STORAGE_KEY) {
    this.key = key;
  }

  async load(): Promise<SeasonData | null> {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw) as SeasonData;
    } catch {
      return null;
    }
  }

  async save(data: SeasonData): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(this.key, JSON.stringify(data));
  }

  async clear(): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(this.key);
  }
}

export const STORAGE_KEY_V1 = STORAGE_KEY;
