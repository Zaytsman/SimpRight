const PLACEHOLDER = /\$\{(\w+)\}/g;

/**
 * Recursively replaces `${VAR}` placeholders in string values with `process.env.VAR`.
 * Collects every missing variable and throws once, so all gaps in `.env` are reported together.
 */
export function resolvePlaceholders<T>(value: T, source: NodeJS.ProcessEnv = process.env): T {
  const missing = new Set<string>();

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      return node.replace(PLACEHOLDER, (_, name: string) => {
        const resolved = source[name];
        if (resolved === undefined || resolved === '') {
          missing.add(name);
          return '';
        }
        return resolved;
      });
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
    }
    return node;
  };

  const result = walk(value) as T;
  if (missing.size > 0) {
    throw new Error(`Missing environment variables: ${[...missing].join(', ')}. Add them to .env.`);
  }
  return result;
}
