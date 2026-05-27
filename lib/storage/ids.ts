/**
 * Deterministic UUID-shaped id derived from a key string. Lets the offline
 * client compute the same primary key for a (round, player) or
 * (player_score, hole) row every time, so upserts target the same row without
 * a server round-trip. Not cryptographic — collisions are irrelevant at the
 * scale of one family's season.
 */
export function deterministicUuid(key: string): string {
  // Fill 16 bytes from four independently-seeded FNV-1a passes.
  const bytes = new Uint8Array(16);
  const seeds = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  for (let word = 0; word < 4; word += 1) {
    let h = seeds[word] >>> 0;
    for (let i = 0; i < key.length; i += 1) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    bytes[word * 4 + 0] = (h >>> 24) & 0xff;
    bytes[word * 4 + 1] = (h >>> 16) & 0xff;
    bytes[word * 4 + 2] = (h >>> 8) & 0xff;
    bytes[word * 4 + 3] = h & 0xff;
  }
  // Stamp UUID version (4) and variant bits for a well-formed value.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function playerScoreId(roundId: string, playerId: string): string {
  return deterministicUuid(`ps:${roundId}:${playerId}`);
}

export function holeScoreId(playerScoreId: string, hole: number): string {
  return deterministicUuid(`hs:${playerScoreId}:${hole}`);
}

export function teamScoreId(roundId: string, teamId: string): string {
  return deterministicUuid(`ts:${roundId}:${teamId}`);
}
