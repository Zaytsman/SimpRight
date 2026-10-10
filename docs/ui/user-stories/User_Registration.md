As a new visitor, I want to create an account with strong password validation and real-time feedback, so that I can securely access the application.

Acceptance Criteria
AC1 – Registration form fields
Given the registration form is displayed
Then the following required fields are shown:

First name
Last name
Date of birth (ISO format YYYY-MM-DD)
Street
Postal code (numeric)
City
State
Country (dropdown)
Phone (numeric only)
Email (max 256 characters, RFC-compliant format)
Password
AC2 – Password requirements displayed
Given the password input is focused
Then a list of requirements is displayed:

at least 8 characters long
both uppercase and lowercase letters
at least one number
at least one special character
AC3 – Real-time password validation
Given I type in the password field
Then the requirements update immediately to reflect which rules are fulfilled.

AC4 – Password strength indicator
Given I am entering a password
Then a strength indicator is displayed with levels:

Weak (1 criterion met, 20% bar)
Moderate (2 criteria met, 40% bar)
Strong (3 criteria met, 60% bar)
Very Strong (4 criteria met, 80% bar)
Excellent (all criteria met, 100% bar)
AC5 – Duplicate email
Given the email is already registered
Then the error "Email is already in use." is displayed.

AC6 – Successful registration
Given all fields are valid
When I submit the form
Then the account is created
And a confirmation email is sent to the registered email address
And I am redirected to the login page.