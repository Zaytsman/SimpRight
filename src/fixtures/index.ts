export { test, expect, type TestFixtures } from './fixtures';
export { openHomePageTest } from './openHomePage';
export {
  PRODUCT_LIST_STEP,
  PRODUCT_CREATE_STEP,
  OTHER_REFS_LIST_STEP,
  PRODUCT_CREATE_FIRST_REFS_STEP,
  FIND_PRODUCT_SPEC_STEP,
  createProductToUpdate,
  createProductWithOtherRefs,
  takeProductRefs,
  findProductSpec,
  expectFieldMessages,
} from '../api/fixtures/productSteps';
export { USER_REGISTER_STEP, registerThrowawayCustomer, type ThrowawayCustomer } from '../api/fixtures/userSteps';
