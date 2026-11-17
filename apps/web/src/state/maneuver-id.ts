/**
 * Deterministic maneuver ids (contracts-v1 section 14; owner decision of 2026-11-17, UI-only
 * option). Maneuver ids enter the requestId, so a random id would give two identical scenarios
 * different requestIds. The id is the first free `m<k>` (k = 1, 2, ...) among the ids already in
 * the scenario, which needs no counter field in the contract: the scenario itself is the state.
 */
export function nextManeuverId(existingIds: readonly string[]): string {
  const taken = new Set(existingIds);
  for (let k = 1; ; k += 1) {
    const id = `m${String(k)}`;
    if (!taken.has(id)) {
      return id;
    }
  }
}
