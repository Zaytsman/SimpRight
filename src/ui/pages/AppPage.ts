import type { Locator, Page, Response } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { BasePage } from './BasePage';
import { NavBar } from './components/NavBar';

/** The title of Cloudflare's bot-check page ("Just a moment..."); the app's own titles never start with it. */
const CLOUDFLARE_CHALLENGE_TITLE = /^Just a moment/i;

/**
 * The Toolshop's base page, which every page object extends: what every page of the app has (the nav bar, the toast,
 * the visitor's cart id), and a `goto` that recognizes Cloudflare's bot check.
 */
export abstract class AppPage extends BasePage {
  readonly navBar: NavBar;
  /**
   * The toast the app shows after an action (ngx-toastr, role "alert"), such as "Product added to shopping cart." or
   * "Product quantity updated.". The pages have no other alert at rest. From the app source; the inspector can't
   * trigger a toast (it never submits).
   */
  protected readonly toastAlert: Locator;

  constructor(page: Page, config: EnvConfig) {
    super(page, config);
    this.navBar = new NavBar(page);
    this.toastAlert = page.getByRole('alert');
  }

  /** The toast message the app shows after an action. */
  get toast(): Locator {
    return this.toastAlert;
  }

  /** The id of the visitor's cart, which the app keeps in sessionStorage once something is added; null before that. */
  async getCartId(): Promise<string | null> {
    return this.page.evaluate(() => window.sessionStorage.getItem('cart_id'));
  }

  /**
   * Navigates like `BasePage.goto`, but throws at once when Cloudflare answers with its bot check ("Performing security
   * verification", a "Verify you are human" box) instead of the app, as it does for most direct loads of /checkout from
   * GitHub-hosted runners: the failure then names the environment instead of a missing element. Cheap: it reads the
   * response's `cf-mitigated` header and the page title, without waiting.
   */
  protected override async goto(path: string): Promise<Response | null> {
    const response = await super.goto(path);
    const challenged = response?.headers()['cf-mitigated'] === 'challenge' || CLOUDFLARE_CHALLENGE_TITLE.test(await this.page.title());
    if (challenged) throw new Error(`Blocked by the site's Cloudflare bot check (environment): ${path}`);
    return response;
  }
}
