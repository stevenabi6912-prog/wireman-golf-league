export const MAX_NOTE_LENGTH = 500;

/** Trim a round note to the maximum allowed length. */
export function clampNote(note: string): string {
  return note.slice(0, MAX_NOTE_LENGTH);
}
