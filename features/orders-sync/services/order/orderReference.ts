/**
 * Marker embedded in the platform order's note field so a retry after a
 * lost create response (or an app crash before the local row is marked
 * synced) can find the already-created platform order instead of
 * pushing a duplicate. See audit bug 3.
 */

export const ORDER_REFERENCE_PREFIX = 'POS-ORDER:';

export function orderReferenceMarker(reference: string): string {
  return `${ORDER_REFERENCE_PREFIX}${reference}`;
}

/** Append the marker to an existing note (or create one). */
export function noteWithReference(note: string | undefined, reference: string): string {
  const marker = orderReferenceMarker(reference);
  return note ? `${note} | ${marker}` : marker;
}

/** Whether a platform-side note field carries our marker. */
export function noteHasReference(note: unknown, reference: string): boolean {
  return typeof note === 'string' && note.includes(orderReferenceMarker(reference));
}
