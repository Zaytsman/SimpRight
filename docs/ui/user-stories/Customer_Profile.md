As an authenticated user, I want to view and update my personal information, so that my account details are accurate.

Acceptance Criteria
AC1 – Profile page is accessible
Given I am logged in
When I navigate to my profile page
Then my current profile information is displayed.

AC2 – Editable fields
Given the profile page is displayed
Then I can edit:

First name (required)
Last name (required)
Phone (required)
Street (required)
Postal code (required)
City (required)
State (required)
Country (required)
AC3 – Read-only email
Given the profile page is displayed
Then the email field is not editable.

AC4 – Successful update
Given I modify profile fields with valid data
When I save
Then a success message is displayed and fades out after 5 seconds.