import type { Locator, Page } from '@playwright/test';
import type { EnvConfig } from '../../config/env';
import { NavBar } from './components/NavBar';

/** The title of Cloudflare's bot-check page ("Just a moment..."); the app's own titles never start with it. */
const CLOUDFLARE_CHALLENGE_TITLE = /^Just a moment/i;

export abstract class BasePage {
  protected readonly page: Page;
  protected readonly config: EnvConfig;
  readonly navBar: NavBar;
  /**
   * The toast the app shows after an action (ngx-toastr, role "alert"), such as "Product added to shopping cart." or
   * "Product quantity updated.". The pages have no other alert at rest. From the app source; the inspector can't
   * trigger a toast (it never submits).
   */
  protected readonly toastAlert: Locator;

  constructor(page: Page, config: EnvConfig) {
    this.page = page;
    this.config = config;
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
   * Navigates to a path relative to `baseUrl`, e.g. `/auth/login`. Subclasses expose `open()`.
   * Throws at once when Cloudflare answers with its bot check ("Performing security verification", a "Verify you are
   * human" box) instead of the app, as it does for most direct loads of /checkout from GitHub-hosted runners: the
   * failure then names the environment instead of a missing element. Cheap: it reads the response's `cf-mitigated`
   * header and the page title, without waiting.
   */
  protected async goto(path: string): Promise<void> {
    const response = await this.page.goto(path);
    const challenged = response?.headers()['cf-mitigated'] === 'challenge' || CLOUDFLARE_CHALLENGE_TITLE.test(await this.page.title());
    if (challenged) throw new Error(`Blocked by the site's Cloudflare bot check (environment): ${path}`);
  }
}
