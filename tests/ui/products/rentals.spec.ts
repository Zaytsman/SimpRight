// UI-082 and UI-083 start on the rentals page (the fixture opens it); UI-081 starts on the home page.
import { openRentalsPageTest as test, expect, openHomePageTest } from '@fixtures';
import { TestConstants } from '@data/TestConstants';

// Scenarios: test-scenarios/ui/products/rentals.yml
test.describe('@products - Rentals', () => {
  test.describe(() => {
    // Precondition: The home page is open.
    const test = openHomePageTest;

    test('UI-081: The Rentals page opens from the Categories menu and lists the rental products', async ({
      homePage,
      rentalsPage,
    }) => {
      const rentals = [TestConstants.products.rentalProduct, 'Bulldozer', 'Crane'];

      await test.step('Open the "Categories" menu.', async () => {
        await homePage.navBar.openCategoriesMenu();
      });

      await test.step('Click "Rentals".', async () => {
        await homePage.navBar.openRentals();
        await rentalsPage.waitForLoaded();
      });

      await test.step('Verify the "Rentals" page is shown, with the heading "Rentals".', async () => {
        // Approved reading: the page is shown when its h1 heading is visible and reads "Rentals" (no URL check).
        await expect(rentalsPage.heading, 'The rentals page heading is shown').toBeVisible();
        await expect(rentalsPage.heading, 'The page heading reads "Rentals"').toHaveText('Rentals');
      });

      await test.step('Verify the cards of "Excavator", "Bulldozer" and "Crane" are shown.', async () => {
        for (const name of rentals) {
          await expect(rentalsPage.rentalGrid.card(name), `The card of "${name}" is shown`).toBeVisible();
        }
      });
    });
  });

  test('UI-082: Each rental card shows an image, a name and a description', async ({ rentalsPage }) => {
    const grid = rentalsPage.rentalGrid;

    await test.step('Verify the page shows at least one rental card.', async () => {
      await expect(grid.cards.first(), 'At least one rental card is shown').toBeVisible();
    });

    // Approved reading for the three "every rental card" steps below: every card the rentals page renders (it has no
    // pagination).
    await test.step('Verify every rental card shows a product image.', async () => {
      // Approved reading: the image is shown when its <img> is visible; whether the picture loaded isn't checked.
      const count = await grid.cards.count();
      for (let i = 0; i < count; i++) {
        await expect(grid.cardImage(i), `Rental card ${i + 1} of ${count} shows a product image`).toBeVisible();
      }
    });

    await test.step('Verify every rental card shows its name.', async () => {
      const count = await grid.cards.count();
      for (let i = 0; i < count; i++) {
        await expect(grid.cardName(i), `Rental card ${i + 1} of ${count} shows its product name`).toBeVisible();
        await expect(grid.cardName(i), `Rental card ${i + 1} of ${count} has a non-empty product name`).toHaveText(/\S/);
      }
    });

    await test.step('Verify every rental card shows a description that is not empty.', async () => {
      const count = await grid.cards.count();
      for (let i = 0; i < count; i++) {
        await expect(grid.cardDescription(i), `Rental card ${i + 1} of ${count} shows a description`).toBeVisible();
        await expect(grid.cardDescription(i), `Rental card ${i + 1} of ${count} has a non-empty description`).toHaveText(/\S/);
      }
    });
  });

  test('UI-083: Clicking a rental card opens its product page with the duration slider', async ({ rentalsPage, productPage }) => {
    const productName = TestConstants.products.rentalProduct;

    await test.step('Click the card of "Excavator".', async () => {
      await rentalsPage.rentalGrid.openProduct(productName);
      await productPage.waitForLoaded();
    });

    await test.step('Verify the product page of "Excavator" is shown, with the name "Excavator".', async () => {
      // Approved reading (as UI-071): the detail page is shown when its description (rendered only on that page) is visible.
      await expect(productPage.description, 'The product detail page shows the product description').toBeVisible();
      await expect(productPage.name, 'The product name is shown').toBeVisible();
      await expect(productPage.name, `The product name is "${productName}"`).toHaveText(productName);
    });

    await test.step('Verify a duration slider is shown.', async () => {
      await expect(productPage.durationSlider, 'The duration slider is shown').toBeVisible();
    });
  });
});
