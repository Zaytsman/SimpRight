# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui/products/rentals.spec.ts >> @products - Rentals >> UI-082: Each rental card shows an image, a name and a description
- Location: tests/ui/products/rentals.spec.ts:40:7

# Error details

```
Error: Rental card 4 of 4 shows a description

expect(locator).toBeVisible() failed

Locator:  locator('app-overview').locator('div[data-test^="product-"]').nth(3).getByRole('paragraph')
Expected: visible
Received: hidden
Timeout:  10000ms

Call log:
  - Rental card 4 of 4 shows a description locator('app-overview').locator('div[data-test^="product-"]').nth(3).getByRole('paragraph') with timeout 10000ms
  - waiting for locator('app-overview').locator('div[data-test^="product-"]').nth(3).getByRole('paragraph')
    24 × locator resolved to <p class="card-text" _ngcontent-ng-c1739684510=""></p>
       - unexpected value "hidden"

```

```yaml
- text: View the
- link "Documentation":
  - /url: https://testsmith-io.github.io/practice-software-testing/#/
- text: for this application. Practice Black Box Testing & Bug Hunting
- button "Testing Guide"
- button "🐛 Bug Hunting"
- navigation:
  - link "Practice Software Testing - Toolshop":
    - /url: /
    - img
  - menubar "Main menu":
    - menuitem "Home":
      - link "Home":
        - /url: /
    - menuitem "Categories":
      - button "Categories"
    - menuitem "Contact":
      - link "Contact":
        - /url: /contact
    - menuitem "SimpRight Runner":
      - button "SimpRight Runner"
  - button "Select language": EN
- heading "Rentals" [level=1]
- img "Excavator"
- heading "Excavator" [level=5]
- paragraph: Heavy-duty tracked excavator available for hourly rental, designed for professional foundation digging, trenching, utility installation, and general earthmoving operations on residential and commercial construction sites. The powerful hydraulic system delivers smooth, responsive boom, arm, and bucket controls for precise positioning and efficient material handling in both tight urban spaces and open excavation sites. An enclosed climate-controlled cab provides operator comfort during long shifts, with excellent forward, side, and rear visibility through large laminated safety-glass windows and an integrated rearview camera system. The rubber-tracked undercarriage minimizes ground disturbance on finished surfaces while providing stable, sure-footed mobility on slopes, soft ground, and uneven terrain. Quick-coupling hydraulic connections allow rapid attachment changes between digging buckets, grading blades, and hydraulic breakers without leaving the cab. Suitable for projects ranging from swimming pool excavation and basement digging to municipal utility trenching and site grading operations.
- img "Bulldozer"
- heading "Bulldozer" [level=5]
- paragraph: Robust tracked bulldozer available for hourly rental, built for heavy-duty grading, site clearing, land leveling, and large-volume earthmoving operations on construction and infrastructure projects. The wide-blade dozer pushes enormous volumes of soil, sand, gravel, and debris with ease, while the optional rear-mounted ripper attachment fractures compacted ground, asphalt, and embedded tree roots ahead of the blade pass. Ergonomic joystick cab controls and a fully automatic hydrostatic transmission allow operators of all experience levels to work efficiently and precisely from the first hour of rental. The enclosed cab features climate control, a suspension seat, and panoramic visibility for comfortable, fatigue-free operation during extended shifts. Integrated GPS rough-grading guidance is available as an optional add-on for projects requiring precise elevation control. Ideal for subdivision site preparation, road subgrade construction, agricultural land reclamation, and large-scale commercial landscaping projects.
- img "Crane"
- heading "Crane" [level=5]
- paragraph: Mobile hydraulic crane available for hourly rental, purpose-engineered for lifting, positioning, and placing heavy loads on active construction sites, industrial facilities, and infrastructure projects. The multi-section telescoping boom extends smoothly to reach elevated installation positions while the four-point hydraulic outrigger system provides a rock-solid, perfectly level base on uneven, sloped, or soft terrain. The precision proportional load control system allows millimeter-accurate positioning of suspended loads, while the rated capacity indicator and automatic overload cutoff ensure every lift is performed safely within the machines certified working limits. The fully enclosed operators cab features ergonomic controls, climate management, and unobstructed boom-tip visibility for confident operation in all weather conditions. Extensive safety systems including anti-two-block, swing-limit, and wind-speed monitoring protect both the operator and surrounding workers on busy sites. Perfect for structural steel erection, precast concrete placement, HVAC rooftop installation, and any material handling task that exceeds the reach or capacity of standard jobsite equipment.
- img "Product-20261026-b7c6da"
- heading "Product-20261026-b7c6da" [level=5]
- paragraph
- contentinfo:
  - text: Learn & Explore
  - link "Learn Test Automation Hands-on courses for Playwright, Robot Framework, APIs and more":
    - /url: https://onlinecourses.testsmith.io
  - link "API Spector Open-source API testing, mocking and contract testing":
    - /url: https://api-spector.dev
  - link "GitHub Source code, issues and contributions":
    - /url: https://github.com/testsmith-io/practice-software-testing
  - text: This is a DEMO application, used for software testing training purpose. |
  - link "Privacy Policy":
    - /url: /privacy
  - text: "| Banner photo by"
  - link "Barn Images":
    - /url: https://unsplash.com/@barnimages
  - text: "on"
  - link "Unsplash":
    - /url: https://unsplash.com/photos/t5YUoHW6zRo
  - text: . v2.5 | Built 2026-10-11 | Angular 20.0.5
- button "Open chat":
  - img
- button "Show live shop activity"
```

# Test source

```ts
  1  | // UI-082 and UI-083 start on the rentals page (the fixture opens it); UI-081 starts on the home page.
  2  | import { openRentalsPageTest as test, expect, openHomePageTest } from '@fixtures';
  3  | import { TestConstants } from '@data/TestConstants';
  4  | 
  5  | // Scenarios: test-scenarios/ui/products/rentals.yml
  6  | test.describe('@products - Rentals', () => {
  7  |   test.describe(() => {
  8  |     // Precondition: The home page is open.
  9  |     const test = openHomePageTest;
  10 | 
  11 |     test('UI-081: The Rentals page opens from the Categories menu and lists the rental products', async ({
  12 |       homePage,
  13 |       rentalsPage,
  14 |     }) => {
  15 |       const rentals = [TestConstants.products.rentalProduct, 'Bulldozer', 'Crane'];
  16 | 
  17 |       await test.step('Open the "Categories" menu.', async () => {
  18 |         await homePage.navBar.openCategoriesMenu();
  19 |       });
  20 | 
  21 |       await test.step('Click "Rentals".', async () => {
  22 |         await homePage.navBar.openRentals();
  23 |         await rentalsPage.waitForLoaded();
  24 |       });
  25 | 
  26 |       await test.step('Verify the "Rentals" page is shown, with the heading "Rentals".', async () => {
  27 |         // Approved reading: the page is shown when its h1 heading is visible and reads "Rentals" (no URL check).
  28 |         await expect(rentalsPage.heading, 'The rentals page heading is shown').toBeVisible();
  29 |         await expect(rentalsPage.heading, 'The page heading reads "Rentals"').toHaveText('Rentals');
  30 |       });
  31 | 
  32 |       await test.step('Verify the cards of "Excavator", "Bulldozer" and "Crane" are shown.', async () => {
  33 |         for (const name of rentals) {
  34 |           await expect(rentalsPage.rentalGrid.card(name), `The card of "${name}" is shown`).toBeVisible();
  35 |         }
  36 |       });
  37 |     });
  38 |   });
  39 | 
  40 |   test('UI-082: Each rental card shows an image, a name and a description', async ({ rentalsPage }) => {
  41 |     const grid = rentalsPage.rentalGrid;
  42 | 
  43 |     await test.step('Verify the page shows at least one rental card.', async () => {
  44 |       await expect(grid.cards.first(), 'At least one rental card is shown').toBeVisible();
  45 |     });
  46 | 
  47 |     // Approved reading for the three "every rental card" steps below: every card the rentals page renders (it has no
  48 |     // pagination).
  49 |     await test.step('Verify every rental card shows a product image.', async () => {
  50 |       // Approved reading: the image is shown when its <img> is visible; whether the picture loaded isn't checked.
  51 |       const count = await grid.cards.count();
  52 |       for (let i = 0; i < count; i++) {
  53 |         await expect(grid.cardImage(i), `Rental card ${i + 1} of ${count} shows a product image`).toBeVisible();
  54 |       }
  55 |     });
  56 | 
  57 |     await test.step('Verify every rental card shows its name.', async () => {
  58 |       const count = await grid.cards.count();
  59 |       for (let i = 0; i < count; i++) {
  60 |         await expect(grid.cardName(i), `Rental card ${i + 1} of ${count} shows its product name`).toBeVisible();
  61 |         await expect(grid.cardName(i), `Rental card ${i + 1} of ${count} has a non-empty product name`).toHaveText(/\S/);
  62 |       }
  63 |     });
  64 | 
  65 |     await test.step('Verify every rental card shows a description that is not empty.', async () => {
  66 |       const count = await grid.cards.count();
  67 |       for (let i = 0; i < count; i++) {
> 68 |         await expect(grid.cardDescription(i), `Rental card ${i + 1} of ${count} shows a description`).toBeVisible();
     |                                                                                                       ^ Error: Rental card 4 of 4 shows a description
  69 |         await expect(grid.cardDescription(i), `Rental card ${i + 1} of ${count} has a non-empty description`).toHaveText(/\S/);
  70 |       }
  71 |     });
  72 |   });
  73 | 
  74 |   test('UI-083: Clicking a rental card opens its product page with the duration slider', async ({ rentalsPage, productPage }) => {
  75 |     const productName = TestConstants.products.rentalProduct;
  76 | 
  77 |     await test.step('Click the card of "Excavator".', async () => {
  78 |       await rentalsPage.rentalGrid.openProduct(productName);
  79 |       await productPage.waitForLoaded();
  80 |     });
  81 | 
  82 |     await test.step('Verify the product page of "Excavator" is shown, with the name "Excavator".', async () => {
  83 |       // Approved reading (as UI-071): the detail page is shown when its description (rendered only on that page) is visible.
  84 |       await expect(productPage.description, 'The product detail page shows the product description').toBeVisible();
  85 |       await expect(productPage.name, 'The product name is shown').toBeVisible();
  86 |       await expect(productPage.name, `The product name is "${productName}"`).toHaveText(productName);
  87 |     });
  88 | 
  89 |     await test.step('Verify a duration slider is shown.', async () => {
  90 |       await expect(productPage.durationSlider, 'The duration slider is shown').toBeVisible();
  91 |     });
  92 |   });
  93 | });
  94 | 
```