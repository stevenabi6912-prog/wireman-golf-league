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
import { createRound, newId, type CreateRoundInput } from "./round";
import { seedSeason } from "./seed";
import { LocalStorageStore } from "./storage/localStorage";
import type { SeasonStore } from "./storage/types";
import type {
  HandicapChange,
  Player,
  Round,
  SeasonData,
} from "./types";

interface SeasonContextValue {
  season: SeasonData | null;
  loading: boolean;
  // settings
  updatePlayerHandicap: (playerId: string, handicap: number) => void;
  updateHolePar: (holeNumber: number, par: number) => void;
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
}

const SeasonContext = createContext<SeasonContextValue | null>(null);

// Single place to choose the backend — swap this line for a network store.
const store: SeasonStore = new LocalStorageStore();

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);

  useEffect(() => {
    let active = true;
    store.load().then((data) => {
      if (!active) return;
      setSeason(data ?? seedSeason());
      setLoading(false);
      loaded.current = true;
    });
    return () => {
      active = false;
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
            p.id === playerId ? { ...p, handicap: to } : p,
          ),
          handicapChanges: [...prev.handicapChanges, change],
        };
      });
    },
    [mutate],
  );

  const value = useMemo<SeasonContextValue>(
    () => ({
      season,
      loading,
      updatePlayerHandicap,
      updateHolePar,
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
      updatePlayerHandicap,
      updateHolePar,
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
