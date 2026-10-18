export { test, expect, type TestFixtures } from './fixtures';
export { openHomePageTest } from '../ui/fixtures/preconditions/openHomePageTest';
export { openProductPageTest } from '../ui/fixtures/preconditions/openProductPageTest';
export { openProductPageInLondonTest } from '../ui/fixtures/preconditions/openProductPageInLondonTest';
export { openHomePageInLondonTest } from '../ui/fixtures/preconditions/openHomePageInLondonTest';
export { openProductPageWithNewCustomerTest } from '../ui/fixtures/preconditions/openProductPageWithNewCustomerTest';
export { openRentalsPageTest } from '../ui/fixtures/preconditions/openRentalsPageTest';
export { openHomePageWithProductInCartTest } from '../ui/fixtures/preconditions/openHomePageWithProductInCartTest';
export { openHomePageWithRentalAndProductInCartTest } from '../ui/fixtures/preconditions/openHomePageWithRentalAndProductInCartTest';
export { removeCartAfterTest } from '../ui/fixtures/cartCleanup';
export { registerCustomerForTest } from '../ui/fixtures/newCustomerFixtures';
export { putProductsInCart, putProductInCart, assertNoEcoRating } from '../ui/fixtures/cartSetup';
export { createProductInStock, findProductByName, catalogueProductNames } from '../ui/fixtures/productSetup';
export { AMSTERDAM } from '../ui/visitor/visitorLocation';

// API setup and check helpers, one module per area. Everything a module exports reaches specs, so keep names that only
// the module itself uses unexported; a name two modules export is a compile error here.
export * from '../api/fixtures/apiSteps';
export * from '../api/fixtures/productSteps';
export * from '../api/fixtures/cartSteps';
export * from '../api/fixtures/userSteps';
export * from '../api/fixtures/brandSteps';
export * from '../api/fixtures/categorySteps';
export * from '../api/fixtures/productSpecSteps';
export * from '../api/fixtures/favoriteSteps';
export * from '../api/fixtures/reportSteps';
export * from '../api/fixtures/messageSteps';
export * from '../api/fixtures/invoiceSteps';
