/**
 * An amount as the app shows it, without the currency sign, minus or thousands separator: "- $1,234.56" -> 1234.56.
 * Throws when the text holds no digits, so an empty cell never reads as 0.
 */
export function parseAmount(text: string | null | undefined): number {
  const digits = (text ?? '').replace(/[^0-9.]/g, '');
  if (!/\d/.test(digits)) throw new Error(`No amount in ${JSON.stringify(text)}`);
  return Number(digits);
}
