import { ellaSharpHoles } from "./seed";
import type { SeasonData } from "./types";

/**
 * True when the season still carries the original "all holes par 4" default,
 * meaning the user has not customized any pars yet. Used to decide whether the
 * one-time Ella Sharp Park par migration should run.
 */
export function needsParMigration(data: SeasonData): boolean {
  return data.holes.length === 18 && data.holes.every((h) => h.par === 4);
}

/**
 * Apply any pending data migrations to a loaded season. Pure and idempotent:
 * returns the SAME reference when nothing needs to change, so callers can cheaply
 * detect whether a write-back is required.
 *
 * Migration 1 — Ella Sharp Park pars: if every hole is still par 4 (the old
 * default), overwrite with the real course pars. Customized pars are preserved.
 */
export function migrateSeason(data: SeasonData): SeasonData {
  let next = data;
  if (needsParMigration(next)) {
    next = { ...next, holes: ellaSharpHoles() };
  }
  return next;
}
