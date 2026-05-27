"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { migrateSeason } from "./migrate";
import { createRound, newId, type CreateRoundInput } from "./round";
import { ellaSharpHoles, seedSeason } from "./seed";
import { SyncStore } from "./storage/sync-store";
import type { ReactiveStore, SyncStatus } from "./storage/types";
import { getSupabaseClient } from "./supabase/client";
import { uploadPhoto } from "./photos";
import type {
  HandicapChange,
  Photo,
  Player,
  Round,
  SeasonData,
} from "./types";

export interface AddPhotoInput {
  roundId: string;
  hole: number | null;
  playerId: string | null;
  file: File;
}

interface SeasonContextValue {
  season: SeasonData | null;
  loading: boolean;
  // settings
  updatePlayerHandicap: (playerId: string, handicap: number) => void;
  updateHolePar: (holeNumber: number, par: number) => void;
  loadEllaSharpPars: () => void;
  resetSeason: () => void;
  replaceSeason: (data: SeasonData) => void;
  // rounds
  startRound: (input: CreateRoundInput) => string;
  updateRound: (roundId: string, updater: (round: Round) => Round) => void;
  finishRound: (roundId: string) => void;
  discardRound: (roundId: string) => void;
  // handicaps
  applyHandicapChange: (
    playerId: string,
    to: number,
    afterRound: number,
  ) => void;
  // photos
  addPhoto: (input: AddPhotoInput) => Promise<void>;
  updatePhotoCaption: (photoId: string, caption: string) => void;
  deletePhoto: (photoId: string) => void;
  // sync
  syncStatus: SyncStatus;
  pendingOps: () => unknown[];
  uploadLocalToCloud: () => Promise<void>;
}

const SeasonContext = createContext<SeasonContextValue | null>(null);

// Single place to choose the backend. SyncStore is offline-first and falls back
// to local-only when Supabase isn't configured.
const store: ReactiveStore = new SyncStore();

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    store.getStatus?.() ?? { state: "local", pending: 0 },
  );
  const loaded = useRef(false);

  useEffect(() => {
    let active = true;
    const unsubs: Array<() => void> = [];
    store.load().then((data) => {
      if (!active) return;
      const base = data ?? seedSeason();
      const migrated = migrateSeason(base);
      setSeason(migrated);
      setLoading(false);
      loaded.current = true;
      // Persist immediately so a one-time migration survives the next reload.
      if (migrated !== base) void store.save(migrated);
      // Realtime updates from other devices flow straight into state.
      if (store.subscribe) {
        unsubs.push(
          store.subscribe((remote) => {
            if (active) setSeason(migrateSeason(remote));
          }),
        );
      }
    });
    if (store.onStatus) unsubs.push(store.onStatus(setSyncStatus));
    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, []);

  // Aggressive auto-save: persist on every state change once loaded.
  useEffect(() => {
    if (!loaded.current || !season) return;
    void store.save(season);
  }, [season]);

  const mutate = useCallback(
    (updater: (prev: SeasonData) => SeasonData) => {
      setSeason((prev) => (prev ? updater(prev) : prev));
    },
    [],
  );

  const updatePlayerHandicap = useCallback(
    (playerId: string, handicap: number) => {
      const safe = Math.max(0, Math.round(handicap));
      mutate((prev) => ({
        ...prev,
        players: prev.players.map((p) =>
          p.id === playerId ? { ...p, handicap: safe } : p,
        ),
      }));
    },
    [mutate],
  );

  const updateHolePar = useCallback(
    (holeNumber: number, par: number) => {
      const safe = Math.max(3, Math.min(5, Math.round(par)));
      mutate((prev) => ({
        ...prev,
        holes: prev.holes.map((h) =>
          h.number === holeNumber ? { ...h, par: safe } : h,
        ),
      }));
    },
    [mutate],
  );

  const loadEllaSharpPars = useCallback(() => {
    mutate((prev) => ({ ...prev, holes: ellaSharpHoles() }));
  }, [mutate]);

  const resetSeason = useCallback(() => {
    const fresh = seedSeason();
    setSeason(fresh);
  }, []);

  const replaceSeason = useCallback((data: SeasonData) => {
    setSeason(data);
  }, []);

  const startRound = useCallback(
    (input: CreateRoundInput) => {
      const created = createRound(season ?? seedSeason(), input);
      mutate((prev) => ({
        ...prev,
        rounds: [...prev.rounds.filter((r) => r.id !== created.id), created],
        activeRoundId: created.id,
      }));
      return created.id;
    },
    [season, mutate],
  );

  const updateRound = useCallback(
    (roundId: string, updater: (round: Round) => Round) => {
      mutate((prev) => ({
        ...prev,
        rounds: prev.rounds.map((r) => (r.id === roundId ? updater(r) : r)),
      }));
    },
    [mutate],
  );

  const finishRound = useCallback(
    (roundId: string) => {
      mutate((prev) => ({
        ...prev,
        rounds: prev.rounds.map((r) =>
          r.id === roundId ? { ...r, completed: true } : r,
        ),
        activeRoundId:
          prev.activeRoundId === roundId ? null : prev.activeRoundId,
      }));
    },
    [mutate],
  );

  const discardRound = useCallback(
    (roundId: string) => {
      mutate((prev) => ({
        ...prev,
        rounds: prev.rounds.filter((r) => r.id !== roundId),
        activeRoundId:
          prev.activeRoundId === roundId ? null : prev.activeRoundId,
      }));
    },
    [mutate],
  );

  const applyHandicapChange = useCallback(
    (playerId: string, to: number, afterRound: number) => {
      mutate((prev) => {
        const player = prev.players.find((p) => p.id === playerId);
        if (!player || player.handicap === to) return prev;
        const change: HandicapChange = {
          id: newId(),
          playerId,
          from: player.handicap,
          to,
          afterRound,
          timestamp: new Date().toISOString(),
        };
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId
              ? {
                  ...p,
                  handicap: to,
                  // New handicap is effective from the next round, resetting
                  // the player's review window.
                  handicapEffectiveFromRound: afterRound + 1,
                }
              : p,
          ),
          handicapChanges: [...prev.handicapChanges, change],
        };
      });
    },
    [mutate],
  );

  const addPhoto = useCallback(
    async ({ roundId, hole, playerId, file }: AddPhotoInput) => {
      const client = getSupabaseClient();
      const familyId = season?.familyId;
      if (!client || !familyId) return; // photos require a configured backend
      const { storagePath, url } = await uploadPhoto(
        client,
        familyId,
        roundId,
        file,
      );
      const photo: Photo = {
        id: newId(),
        roundId,
        hole,
        playerId,
        storagePath,
        url,
        createdAt: new Date().toISOString(),
      };
      mutate((prev) => ({ ...prev, photos: [...prev.photos, photo] }));
    },
    [season, mutate],
  );

  const updatePhotoCaption = useCallback(
    (photoId: string, caption: string) => {
      mutate((prev) => ({
        ...prev,
        photos: prev.photos.map((p) =>
          p.id === photoId ? { ...p, caption } : p,
        ),
      }));
    },
    [mutate],
  );

  const deletePhoto = useCallback(
    (photoId: string) => {
      mutate((prev) => ({
        ...prev,
        photos: prev.photos.filter((p) => p.id !== photoId),
      }));
    },
    [mutate],
  );

  const pendingOps = useCallback(() => store.pendingOps?.() ?? [], []);

  const uploadLocalToCloud = useCallback(async () => {
    if (!season || !store.bootstrap) return;
    await store.bootstrap(season);
    const reloaded = await store.load();
    if (reloaded) setSeason(migrateSeason(reloaded));
  }, [season]);

  const value = useMemo<SeasonContextValue>(
    () => ({
      season,
      loading,
      syncStatus,
      pendingOps,
      uploadLocalToCloud,
      addPhoto,
      updatePhotoCaption,
      deletePhoto,
      updatePlayerHandicap,
      updateHolePar,
      loadEllaSharpPars,
      resetSeason,
      replaceSeason,
      startRound,
      updateRound,
      finishRound,
      discardRound,
      applyHandicapChange,
    }),
    [
      season,
      loading,
      syncStatus,
      pendingOps,
      uploadLocalToCloud,
      addPhoto,
      updatePhotoCaption,
      deletePhoto,
      updatePlayerHandicap,
      updateHolePar,
      loadEllaSharpPars,
      resetSeason,
      replaceSeason,
      startRound,
      updateRound,
      finishRound,
      discardRound,
      applyHandicapChange,
    ],
  );

  return (
    <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>
  );
}

export function useSeason(): SeasonContextValue {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error("useSeason must be used within a SeasonProvider");
  return ctx;
}

/** Convenience: get a player by id from current season. */
export function findPlayer(
  season: SeasonData | null,
  id: string,
): Player | undefined {
  return season?.players.find((p) => p.id === id);
}
