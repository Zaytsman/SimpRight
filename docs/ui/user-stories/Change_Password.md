As an authenticated user, I want to change my password with real-time strength feedback, so that I can maintain strong account security.

Acceptance Criteria
AC1 – Change password form
Given I am on my profile page
Then a change password section is displayed with:

Current password (required)
New password (required)
Confirm new password (required)
AC2 – Password strength indicator
Given I enter a new password
Then the same password strength indicator as registration is displayed
With the same 5 strength levels and visual progress bar.

AC3 – Passwords must match
Given the new password and confirmation do not match
Then the error "Passwords do not match." is displayed.

AC4 – Current password verification
Given I enter an incorrect current password
When I submit the form
Then the error "Your current password does not matches with the password." is displayed.

AC5 – New password must differ
Given I enter a new password identical to the current one
When I submit the form
Then the error "New Password cannot be same as your current password." is displayed.

AC6 – Successful change
Given I provide a valid current password and a new password that matches the confirmation
When I submit the form
Then a success message is displayed
And I am logged out after 5 seconds.