/**
 * Stable-ordered JSON serialization for the hash chain — byte-identical
 * output for structurally identical input, so the client (SQLite impl)
 * and the Store API (Go impl) produce the same digest for the same
 * fiscal content. Keys are alphabetically sorted at every depth; no
 * insignificant whitespace (JSON.stringify already emits none).
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortRecursively(value));
}

function sortRecursively(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortRecursively);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortRecursively((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
