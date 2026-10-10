As a customer, I want to enter my billing address, pre-filled from my account if logged in, so that my invoice is accurate.

Acceptance Criteria
AC1 – Address form fields
Given I am on the billing address step
Then the following required fields are displayed:

Street (max 70 characters)
City (max 40 characters)
State (max 40 characters)
Country (max 40 characters)
Postal code (max 10 characters)
AC2 – Validation
Given I leave a required field empty
Then the field is highlighted as invalid
And the "Proceed" button is disabled.

AC3 – Proceed to payment
Given all address fields are filled in
When I click "Proceed"
Then I advance to the payment step.

AC4 – Pre-fill for logged-in users
Given I am logged in
Then the address fields are pre-filled with my account address details.