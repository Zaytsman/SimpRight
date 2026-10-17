/** An amount as the app shows it, without the currency sign, minus or thousands separator: "- $1,234.56" -> 1234.56. */
export function parseAmount(text: string | null | undefined): number {
  return Number((text ?? '').replace(/[^0-9.]/g, ''));
}
