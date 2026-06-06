/**
 * Generate a stable text primary key for any row (UUID v4).
 * Used for every `text('id').primaryKey()` column across the schema.
 */
export function newId(): string {
  return crypto.randomUUID();
}
