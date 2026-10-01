/**
 * A readable name that won't collide with other runs or other users of the shared app:
 * `<prefix>-<yyyymmdd>-<6 random hex chars>`, e.g. `Lifecycle-20261001-3fa9c2`.
 * Factories use it for every record a test creates.
 */
export function uniqueName(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `${prefix}-${date}-${crypto.randomUUID().slice(0, 6)}`;
}
