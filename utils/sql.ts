export type SqlValue = string | number | null;

/**
 * Build a parameterised `SET` clause from a partial update object.
 *
 * Column names cannot be bound as SQL parameters, so only keys in the
 * explicit allowlist are interpolated. Unknown keys are rejected rather than
 * silently ignored so a caller cannot smuggle SQL fragments or protected
 * columns (e.g. `pin`, `id`) through an untyped runtime object.
 */
export function buildUpdateAssignments(
  data: Record<string, unknown>,
  allowedColumns: readonly string[],
  ignoredColumns: readonly string[] = ['id', 'created_at', 'updated_at']
): { assignments: string[]; values: SqlValue[] } {
  const assignments: string[] = [];
  const values: SqlValue[] = [];

  for (const [column, value] of Object.entries(data)) {
    if (value === undefined || ignoredColumns.includes(column)) continue;
    if (!allowedColumns.includes(column)) {
      throw new Error(`Column '${column}' cannot be updated`);
    }
    assignments.push(`${column} = ?`);
    values.push(typeof value === 'boolean' ? (value ? 1 : 0) : (value as SqlValue));
  }

  return { assignments, values };
}
