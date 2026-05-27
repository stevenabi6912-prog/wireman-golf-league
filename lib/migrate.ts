import { ellaSharpHoles } from "./seed";
import type { Round, SeasonData } from "./types";

/**
 * True when the season still carries the original "all holes par 4" default,
 * meaning the user has not customized any pars yet. Used to decide whether the
 * one-time Ella Sharp Park par migration should run.
 */
export function needsParMigration(data: SeasonData): boolean {
  return data.holes.length === 18 && data.holes.every((h) => h.par === 4);
}

function migrateEllaSharpPars(data: SeasonData): SeasonData {
  if (!needsParMigration(data)) return data;
  return { ...data, holes: ellaSharpHoles() };
}

/** Player IDs that have a score record on a legacy round (pre-playerIds). */
export function derivePlayerIds(round: Round): string[] {
  if (round.format === "scramble") {
    return (round.teams ?? []).flatMap((t) => t.playerIds);
  }
  return round.playerScores.map((ps) => ps.playerId);
}

function migrateRoundPlayerIds(data: SeasonData): SeasonData {
  let changed = false;
  const rounds = data.rounds.map((r) => {
    if (Array.isArray(r.playerIds)) return r;
    changed = true;
    return { ...r, playerIds: derivePlayerIds(r) };
  });
  return changed ? { ...data, rounds } : data;
}

function migratePlayerHandicapWindow(data: SeasonData): SeasonData {
  let changed = false;
  const players = data.players.map((p) => {
    if (typeof p.handicapEffectiveFromRound === "number") return p;
    changed = true;
    return { ...p, handicapEffectiveFromRound: 1 };
  });
  return changed ? { ...data, players } : data;
}

function migratePhotos(data: SeasonData): SeasonData {
  if (Array.isArray(data.photos)) return data;
  return { ...data, photos: [] };
}

/**
 * Apply any pending data migrations to a loaded season. Pure and idempotent:
 * returns the SAME reference when nothing needs to change, so callers can
 * cheaply detect whether a write-back is required.
 *
 * 1. Ella Sharp Park pars: if every hole is still par 4 (the old default),
 *    overwrite with the real course pars. Customized pars are preserved.
 * 2. Round playerIds: backfill participating players on rounds saved before
 *    per-round player selection existed.
 * 3. Player handicapEffectiveFromRound: default to 1 for legacy player records
 *    saved before the sliding-window review existed.
 */
export function migrateSeason(data: SeasonData): SeasonData {
  let next = data;
  next = migrateEllaSharpPars(next);
  next = migrateRoundPlayerIds(next);
  next = migratePlayerHandicapWindow(next);
  next = migratePhotos(next);
  return next;
}
