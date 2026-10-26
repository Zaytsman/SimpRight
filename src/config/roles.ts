/**
 * The roles a test can act as (`test.use({ role: 'admin' })`): the project's own list, which the framework's core reads
 * through `@config/env`. A role logs in with its user from `testUsers` in `src/envs/<ENV>.json` (secrets from `.env`),
 * or with a user created for the run (`setRunUser`): here `admin` comes from the env file and `default` is the run's
 * customer.
 */
export const ROLES = ['admin', 'default'] as const;

export type UserRole = (typeof ROLES)[number];

/** The role of a test that doesn't set one: the scenarios' "default user". */
export const DEFAULT_ROLE: UserRole = 'default';
