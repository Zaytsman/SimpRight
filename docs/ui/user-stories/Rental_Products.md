As a visitor, I want to browse products available for rent, so that I can find tools I can rent by the hour.

Acceptance Criteria
AC1 – Rentals page is accessible
Given I navigate to the rentals page
Then a list of all rental products is displayed.

AC2 – Rental product display
Given the rentals page is displayed
Then each rental product shows a product image, name, and description.

AC3 – Rental detail page
Given I click on a rental product
Then the product detail page shows a duration slider (1–10 hours) instead of plus/minus buttons
And the total price is calculated as the hourly rate multiplied by the selected duration.

AC4 – Rental label in checkout
Given a rental item is in my cart
Then the item is marked with "This is a rental item" in the checkout cart.

AC5 – Location-based discount on rentals
Given a rental product is marked as a location offer
And my location matches a supported city
Then the location discount is applied to the rental price.