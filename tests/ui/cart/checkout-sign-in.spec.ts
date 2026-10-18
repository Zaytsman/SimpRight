// Every scenario here has the precondition "A product that is in stock is in the cart.": the fixture puts one in the
// browser's cart through the API (removed after the test) and opens the home page before the steps.
import { openHomePageWithProductInCartTest as test, expect, registerCustomerForTest } from '@fixtures';
import { UserFactory } from '@data/factories/UserFactory';
import { totpCode } from '@utils/totp';
import type { CartPage } from '@ui/pages/CartPage';

/**
 * The checks of a "Verify the "Billing Address" step is shown." step. Approved reading: the wizard marks "Billing
 * Address" as the current step, and that step's content is visible.
 */
async function expectBillingAddressStep(cartPage: CartPage): Promise<void> {
  await expect(cartPage.currentStep, 'The wizard marks "Billing Address" as the current step').toHaveText('Billing Address');
  await expect(cartPage.billingAddressHeading, 'The Billing Address step is visible').toBeVisible();
}

// Scenarios: test-scenarios/ui/cart/checkout-sign-in.yml
test.describe('@cart - Checkout sign-in', () => {
  test.describe(() => {
    test.use({ authMode: 'none' });

    test('UI-058: A guest who proceeds from the cart step sees the sign-in step with a login form', async ({ cartPage }) => {
      await test.step('Open the checkout page.', async () => {
        await cartPage.open();
      });

      await test.step('Click "Proceed to checkout".', async () => {
        await cartPage.proceed();
      });

      await test.step('Verify the "Sign in" step is shown.', async () => {
        // Approved reading: the wizard marks "Sign in" as the current step, and that step's content is visible.
        await expect(cartPage.currentStep, 'The wizard marks "Sign in" as the current step').toHaveText('Sign in');
        await expect(cartPage.signInStepPanel, 'The Sign in step is visible').toBeVisible();
      });

      await test.step('Verify the login form is shown.', async () => {
        await expect(cartPage.signInStep.loginForm, 'The login form is visible on the Sign in step').toBeVisible();
      });
    });

    test('UI-059: The sign-in step shows the email and password fields and the "Login" button', async ({ cartPage }) => {
      await test.step('Open the checkout page.', async () => {
        await cartPage.open();
      });

      await test.step('Click "Proceed to checkout".', async () => {
        await cartPage.proceed();
      });

      await test.step('Verify the field "Email address" is shown.', async () => {
        await expect(cartPage.signInStep.emailField, 'The field "Email address" is visible').toBeVisible();
      });

      await test.step('Verify the field "Password" is shown.', async () => {
        await expect(cartPage.signInStep.passwordField, 'The field "Password" is visible').toBeVisible();
      });

      await test.step('Verify the button "Login" is shown.', async () => {
        await expect(cartPage.signInStep.loginButton, 'The button "Login" is visible').toBeVisible();
      });
    });

    test('UI-060: An account with TOTP enabled must enter a valid code on the sign-in step to sign in', async ({
      cartPage,
      usersService,
      adminUsersService,
      authService,
      usersServiceForToken,
      cleanup,
    }) => {
      // Precondition: A customer with TOTP enabled is registered; the test can compute the account's current TOTP code.
      // A customer of its own (removed as admin after the test), with TOTP turned on through its own token and a secret
      // the test knows, as the API scenarios do it.
      const { body, id, token } = await registerCustomerForTest({ usersService, adminUsersService, authService }, cleanup);
      const secret = UserFactory.totpSecret();
      const totpUpdate = await usersServiceForToken(token).partialUpdate(id, { totp_enabled: true, totp_secret: secret });
      if (!totpUpdate.success) throw new Error(`Setup: turning TOTP on for the customer failed: ${JSON.stringify(totpUpdate)}`);

      const signIn = cartPage.signInStep;

      await test.step('Open the checkout page.', async () => {
        await cartPage.open();
      });

      await test.step('Click "Proceed to checkout".', async () => {
        await cartPage.proceed();
      });

      await test.step('Enter the customer\'s email in the field "Email address".', async () => {
        await signIn.enterEmail(body.email);
      });

      await test.step('Enter the customer\'s password in the field "Password".', async () => {
        await signIn.enterPassword(body.password);
      });

      await test.step('Click "Login".', async () => {
        await signIn.login();
      });

      await test.step('Verify the field "TOTP Code" is shown.', async () => {
        await expect(signIn.totpCodeField, 'The field "TOTP Code" is visible').toBeVisible();
      });

      await test.step('Verify the button "Verify TOTP" is shown.', async () => {
        await expect(signIn.verifyTotpButton, 'The button "Verify TOTP" is visible').toBeVisible();
      });

      await test.step('Verify the fields "Email address" and "Password" are no longer shown.', async () => {
        await expect(signIn.emailField, 'The field "Email address" is gone').toBeHidden();
        await expect(signIn.passwordField, 'The field "Password" is gone').toBeHidden();
      });

      await test.step('Enter the code "000000" in the field "TOTP Code".', async () => {
        await signIn.enterTotpCode('000000');
      });

      await test.step('Click "Verify TOTP".', async () => {
        await signIn.verifyTotp();
      });

      await test.step('Verify the button "Proceed to checkout" is not shown.', async () => {
        await expect(signIn.proceedButton, 'A wrong code does not sign the customer in').toBeHidden();
      });

      await test.step('Enter the account\'s current TOTP code in the field "TOTP Code" (replacing the wrong one).', async () => {
        await signIn.enterTotpCode(totpCode(secret));
      });

      await test.step('Click "Verify TOTP".', async () => {
        await signIn.verifyTotp();
      });

      await test.step('Verify a message that the customer is already signed in is shown.', async () => {
        // Approved reading: the signed-in message is shown in place of the form; its wording is UI-062's check.
        await expect(signIn.signedInMessage, 'The signed-in message is visible').toBeVisible();
      });

      await test.step('Verify the button "Proceed to checkout" is shown.', async () => {
        await expect(signIn.proceedButton, 'The button "Proceed to checkout" is visible').toBeVisible();
      });
    });

    test('UI-061: Valid credentials on the sign-in step sign the guest in and lead to the billing address step', { tag: '@smoke' }, async ({
      cartPage,
      user,
    }) => {
      const signIn = cartPage.signInStep;

      await test.step('Open the checkout page.', async () => {
        await cartPage.open();
      });

      await test.step('Click "Proceed to checkout".', async () => {
        await cartPage.proceed();
      });

      await test.step('Enter the default user\'s email in the field "Email address".', async () => {
        await signIn.enterEmail(user.username);
      });

      await test.step('Enter the default user\'s password in the field "Password".', async () => {
        await signIn.enterPassword(user.password);
      });

      await test.step('Click "Login".', async () => {
        await signIn.login();
      });

      await test.step('Verify the login form is no longer shown.', async () => {
        await expect(signIn.loginForm, 'The login form is gone').toBeHidden();
      });

      await test.step('Verify the user menu is shown in the navigation.', async () => {
        await expect(cartPage.navBar.userMenu, 'The user menu is visible in the nav bar').toBeVisible();
      });

      await test.step('Click "Proceed to checkout" on the sign-in step.', async () => {
        await signIn.proceed();
      });

      await test.step('Verify the "Billing Address" step is shown.', async () => {
        await expectBillingAddressStep(cartPage);
      });
    });
  });

  test('UI-062: A logged-in customer sees the already-signed-in message on the sign-in step and proceeds to the billing address step', async ({
    cartPage,
    accessToken,
    usersServiceForToken,
  }) => {
    test.fail(true, 'Known issue BUG-048: The sign-in step tells a logged-in customer "Hello <first> <last>, you are already logged in." instead of "You are already signed in as <first> <last>".');

    const signIn = cartPage.signInStep;

    await test.step('Open the checkout page.', async () => {
      await cartPage.open();
    });

    await test.step('Click "Proceed to checkout".', async () => {
      await cartPage.proceed();
    });

    await test.step('Verify the message "You are already signed in as" followed by the default user\'s first and last name is shown.', async () => {
      const me = await usersServiceForToken(accessToken).me();
      await expect(signIn.signedInMessage, 'The signed-in message is visible').toBeVisible();
      await expect(signIn.signedInMessage, 'The message names the signed-in customer').toContainText(
        `You are already signed in as ${me.first_name} ${me.last_name}`
      );
    });

    await test.step('Verify the login form is not shown.', async () => {
      await expect(signIn.loginForm, 'No login form for a signed-in customer').toBeHidden();
    });

    await test.step('Click "Proceed to checkout" on the sign-in step.', async () => {
      await signIn.proceed();
    });

    await test.step('Verify the "Billing Address" step is shown.', async () => {
      await expectBillingAddressStep(cartPage);
    });
  });
});
