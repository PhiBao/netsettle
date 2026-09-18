/** Deterministic party normalization. Semantic matching lives in @netting/typesafe. */
export function normalizePartyKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

export function displayParty(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}
