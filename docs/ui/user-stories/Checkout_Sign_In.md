As a user who is not logged in, I want the possibility to log in during the checkout workflow, so that I can complete my purchase without leaving the checkout.

Acceptance Criteria
AC1 – Login step displayed for guests
Given I am not logged in
And I am on the checkout page
When I click "Proceed to Checkout" from the cart step
Then a login form is displayed as the next step in the checkout wizard.

AC2 – Login form fields
Given the checkout login step is displayed
Then email and password fields are shown
And a submit button is available.

AC3 – TOTP support during checkout login
Given I have TOTP enabled on my account
When I submit valid email and password on the checkout login step
Then a 6-digit TOTP input field is displayed
And I must enter a valid TOTP code to proceed.

AC4 – Successful login during checkout
Given I enter valid credentials on the checkout login step
When I submit the form
Then I am authenticated
And I can proceed to the billing address step.

AC5 – Already logged in
Given I am already logged in
When I reach the checkout login step
Then a message "You are already signed in as [First Name] [Last Name]" is displayed
And I can proceed directly to the billing address step.