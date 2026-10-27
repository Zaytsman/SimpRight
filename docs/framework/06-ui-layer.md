# 6. UI layer

The UI layer is the page object model of the Toolshop's Angular app: **pages** (one per route), **components** (reusable parts of pages, scoped to a container), **dialogs** (modals), and **flows** (journeys over several pages). Page objects know the app: which element is which, and what signal says an action is done. They hold no assertions.

```
src/ui/
  pages/
    BasePage.ts            the core: page, config, goto()
    AppPage.ts             the app's base page: navBar, toast, getCartId(), goto() with the Cloudflare check
    HomePage.ts            search, sort; holds productGrid, filters, pagination, priceRange
    ProductPage.ts         the product detail: prices, quantity, add to cart, favourites, related
    CartPage.ts            the checkout wizard: cart lines, totals, proceed; holds signInStep
    RentalsPage.ts         the rentals overview; holds rentalGrid
    LoginPage.ts           used by project.uiLogin, globalSetup's UI login (storageState mode)
    waitForApiResponse.ts  wait for the app's own request
    components/            BaseComponent + NavBar, ProductGrid, ProductFilters, Pagination, PriceRangeSlider,
                           RentalGrid, CheckoutCartLine, CheckoutSignInStep
    dialogs/BaseDialog.ts  base for modals (no concrete dialog yet)
  flows/ShoppingFlow.ts    openProduct(name): home, search, the product's card
  visitor/                 browser state the app reads: setVisitorLocation, setVisitorCart
  auth/authState.ts        isStorageStateValid: whether a saved login still has 2 minutes left
```

## Pages

Every page extends [`AppPage`](../../src/ui/pages/AppPage.ts), the app's base page, which extends the core [`BasePage`](../../src/ui/pages/BasePage.ts) (the page, the config and `goto()`):

```ts
export class HomePage extends AppPage {
  private readonly searchInput: Locator;               // locators: private readonly, named with the element kind
  private readonly searchCaptionText: Locator;
  readonly productGrid: ProductGrid;                   // components: public readonly fields

  get searchCaption(): Locator { return this.searchCaptionText; }   // a getter, only when a test asserts on it

  async open(): Promise<void> { await this.goto('/'); await this.waitForLoaded(); }

  async search(term: string): Promise<void> {          // actions: verbs, and they wait for the app's signal
    await this.searchInput.fill(term);
    await this.searchButton.click();
    await expect(this.searchCompletedMarker).toBeAttached();
  }
}
```

| Rule | Why |
|---|---|
| Locators are `private readonly` fields assigned in the constructor, named with the element kind (`searchCaptionText`, `cartQuantityBadge`) | Tests can't reach into the page; the name says what the element is |
| A test reaches a locator only through a **noun getter** (`get searchCaption()`), added when a test asserts on it | The page's public surface is exactly what tests use |
| Dynamic locators are methods with parameters (`productGrid.card(name)`) | |
| Actions are verbs (`search`, `addToCart`, `openCart`); values come from `async get...()` methods (`getTotal()`, `getLines()`) | |
| Amounts are read with `parseAmount` ([`src/utils/amounts.ts`](../../src/utils/amounts.ts)) | It throws on text without digits, so a price that hasn't rendered never reads as 0 |
| `open()` calls the protected `goto(path)` and waits for the page's data (`waitForLoaded()`), not only its frame | An action started while the page is still loading can be overwritten by the late first load |
| No assertions; `expect(...)` inside an action only as a wait for the app's signal | Checks belong in specs |
| Locator priority: `getByTestId` (`data-test`) → `getByRole` / `getByLabel` / `getByText` → CSS with a comment saying why; never XPath | The site marks elements with `data-test`; ids that end in a record id change with the re-seed |

`AppPage` gives every page:

- `navBar` (the [`NavBar`](../../src/ui/pages/components/NavBar.ts) component: `userMenu`, `cartQuantity`, `openCart()`, `openRentals()`, `openCategoriesMenu()`);
- `toast`, the app's toast message (role `alert`, ngx-toastr);
- `getCartId()`, the visitor's cart id from sessionStorage;
- `goto(path)`, which throws **"Blocked by the site's Cloudflare bot check (environment): <path>"** when Cloudflare answers with its bot check instead of the app (the `cf-mitigated: challenge` header or the "Just a moment..." title). The failure then names the environment instead of a missing element.

## Components

A component extends [`BaseComponent(page, root)`](../../src/ui/pages/components/BaseComponent.ts) and looks up every locator **inside `root`**, its container. The same test id elsewhere on the page (the detail page's `product-name`, a second `<nav>`) is then never matched. Each component's constructor gives its container as the default `root`; a page can pass another one. `page` is only for what lies outside the container: result markers and network waits. Inside `filter({ has })`, the inner locator starts from `page`, because Playwright resolves it inside each match.

| Component | Responsibility |
|---|---|
| `NavBar` | The top navigation on every page; the cart link shows only when the cart has items |
| `ProductGrid` | The home/search grid: cards, names, prices, `openProduct(name)`, `waitForQueryResults` |
| `ProductFilters` | Category and brand checkboxes in the sidebar |
| `Pagination`, `PriceRangeSlider` | The page numbers; the ngx-slider price range |
| `RentalGrid` | The rentals page's cards |
| `CheckoutCartLine` | One line of the checkout's cart step: prices, quantity change, delete |
| `CheckoutSignInStep` | Step 2 of the wizard: login form, TOTP, proceed |

Components aren't fixtures: tests reach them through their page (`homePage.productGrid`). Dialogs extend [`BaseDialog(page, root?)`](../../src/ui/pages/dialogs/BaseDialog.ts), a component whose `root` defaults to `getByRole('dialog')`; its Cancel, OK and Delete buttons are scoped to it.

## Flows

[`ShoppingFlow`](../../src/ui/flows/ShoppingFlow.ts) is built from page objects. Each method is one user-level task a scenario step could name: `openProduct(name)` opens the home page, searches and opens the product's card. A spec uses a flow in a step only when the flow does exactly what the step says; a flow that spans several steps is for setup.

## Waiting for the app

Every action returns only when the page shows its result. In order of preference:

1. **The app's own marker or message.** The home grid's container `data-test` is the result state: `search_completed` after a search, `sorting_started` → `sorting_completed`, `filter_completed`. Toasts: `ProductPage.addToCart()` waits for "Product added to shopping cart".
2. **The app's own request, when it renders no marker:** `waitForApiResponse(page, method, path, matches?)`, started before the action and awaited after it.

   ```ts
   const cartLoaded = waitForApiResponse(this.page, 'GET', CART_REQUEST_PATH);   // /\/carts\/[^/]+$/
   await this.navBar.openCart();
   const response = await cartLoaded;
   ```

   `path` is a suffix of the URL path or a RegExp; `matches` narrows it further (the criteria of a `QUERY /products` filter).
3. **A visible change:** the next page's heading, a URL, an element that appears or disappears.

Never `waitForTimeout`, and never `networkidle` (the app may poll).

## Visitor state ([`src/ui/visitor/`](../../src/ui/visitor/))

The app keeps some visitor state in browser storage. Tests set it with **init scripts**, before any page loads, and only for their own browser context:

| Helper | Sets | Effect |
|---|---|---|
| `setVisitorLocation(page, LONDON)` | `localStorage.GEO_LOCATION` | Location offers show their city discount (London: 25%) |
| `setVisitorCart(page, cartId, quantity)` | `sessionStorage.cart_id` and `cart_quantity`, once per tab | The browser owns a cart made through the API; the nav bar shows its cart link |

## The checkout and Cloudflare

Cloudflare in front of the site answers most direct loads of `/checkout` from GitHub-hosted runners with an interactive bot check (never locally). So **[`CartPage.open()`](../../src/ui/pages/CartPage.ts) never loads `/checkout`**:

1. When no page of the app is open, it opens the home page and waits until it has loaded. A click on the cart link right after a fresh load can be lost.
2. It clicks the nav bar's cart link (a move inside the app loads no page).
3. It waits for the app's `GET /carts/{id}` and fails with a clear message when there's no answer or the status isn't 2xx ("The cart didn't load: ...").
4. It waits for the cart step to render.

Only `openWithoutCart()` (a visitor without a cart, so there's no link) still loads `/checkout` directly.

## How to add

| To add | Do |
|---|---|
| A page | A class in `pages/` extending `AppPage`, an `open()` and a `waitForLoaded()`; register it as a fixture in `src/ui/fixtures/fixtures.ts` |
| A component | A class in `pages/components/` extending `BaseComponent`, with its container as the default `root`; a page holds it as a `readonly` field |
| A wait | The app's marker if it has one; otherwise `waitForApiResponse` around the action |
| Locators | From the page inspector (`npm run inspect:ui -- <path>`), or the app's source where the inspector can't reach (the checkout steps need a cart) |

## Changed in the review

- Prices on the product page and in the grid were read with `Number(...)`, so an unrendered price read as 0 (UI-017 could pass as 0 = 3 × 0). Now they use `parseAmount`.
- Five hand-written `waitForResponse` predicates became one `waitForApiResponse`.
- `CartPage.open()`: the cart fixtures had already opened `/`, and `open()` loaded it again (12 tests). It now opens the home page only when no app page is open, waits until it has loaded (this fixed the old UI-055 "cart never rendered": a lost click), and waits for `GET /carts/{id}` with a clear error.
- The toast moved to `BasePage` (`ProductPage` and `CartPage` had their own).
- `BaseDialog` became a component (`extends BaseComponent`, no unused `config`).
- Dead code removed: `ShoppingFlow.addProductToCart` and `goToCart`, `NavBar.openHome` and `openSignIn`, `ProductGrid.noResults`.

Details: [13. Code review, October 2026](13-code-review-2026-10.md).
