import { mergeTests } from '@playwright/test';
import { test as apiTest, type ApiFixtures } from '../api/fixtures/fixtures';
import { test as uiTest, type UiFixtures } from '../ui/fixtures/fixtures';
import type { BaseFixtures, BaseOptions } from './base';

export type TestFixtures = BaseOptions & BaseFixtures & ApiFixtures & UiFixtures;

/** The single `test` specs import: base + API + UI fixtures. Fixtures are lazy, so a test only pays for what it uses. */
export const test = mergeTests(apiTest, uiTest);

export { expect } from '@playwright/test';
