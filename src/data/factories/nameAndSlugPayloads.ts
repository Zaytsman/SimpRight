import { uniqueName } from './testDataUtils';

/** The API validates the name and slug of brands and categories the same way: at most 120 characters, slug alpha_dash. */
const NAME_MAX = 120;
const SLUG_MAX = 120;

/**
 * The payload builders that BrandFactory and CategoryFactory share, for an area whose records have a name and a slug
 * (`area`: "Brand" or "Category"). Names are `<Area>-<yyyymmdd>-<6 hex>`, slugs the same in lower case (uniqueName).
 * The invalid payloads are plain objects, because they break the request types on purpose.
 */
export function nameAndSlugPayloads(area: string) {
  const name = (): string => uniqueName(area);
  const slug = (): string => uniqueName(area.toLowerCase());
  const nameTooLong = (): string => name().padEnd(NAME_MAX + 1, 'x');
  const slugWithInvalidChars = (): string => `${slug()} x!`;

  return {
    /** A unique name. */
    name,

    /** A unique slug: lower-case letters, digits and dashes only (alpha_dash). */
    slug,

    /** A PUT or PATCH body with only a new unique name. */
    updateName: (): { name: string } => ({ name: name() }),

    /** A PUT body with a new unique name and a new unique slug. */
    updateNameAndSlug: (): { name: string; slug: string } => ({ name: name(), slug: slug() }),

    /** A PUT or PATCH body with only the given slug. */
    updateSlug: (value: string): { slug: string } => ({ slug: value }),

    /** A PUT or PATCH body with a new unique name and the given slug. */
    updateNameWithSlug: (value: string): { name: string; slug: string } => ({ name: name(), slug: value }),

    /** A PUT or PATCH body with only a name over the limit (nameTooLong). */
    updateNameTooLong: (): { name: string } => ({ name: nameTooLong() }),

    /** A PUT or PATCH body with only a slug outside alpha_dash (slugWithInvalidChars). */
    updateInvalidSlug: (): { slug: string } => ({ slug: slugWithInvalidChars() }),

    /** A name one character over the limit (121), starting with a unique name. */
    nameTooLong,

    /** A slug one character over the limit (121), starting with a unique slug, letters, digits and dashes only. */
    slugTooLong: (): string => slug().padEnd(SLUG_MAX + 1, 'x'),

    /** A unique slug followed by " x!" (a space and an exclamation mark), outside alpha_dash. */
    slugWithInvalidChars,

    /** A unique name followed by U+2082 SUBSCRIPT TWO, inside the rejected range U+2070-U+209F. */
    nameWithSubscript: (): string => `${name()}₂`,

    /** A body with only a name that isn't a string. */
    nameNotString: (): Record<string, unknown> => ({ name: 123 }),

    /**
     * A unique search term of letters and digits only (no dashes, so full-text search treats it as one word), longer
     * than 4 characters: `<Area>Search<yyyymmdd><6 hex>`. No record has it unless a test creates one with it.
     */
    searchTerm: (): string => uniqueName(`${area}Search`).replaceAll('-', ''),
  };
}
