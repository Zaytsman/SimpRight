As a visitor, I want to view a product's details, add it to my cart, or save it to my favorites, so that I can purchase it or come back to it later.

Acceptance Criteria
AC1 – Product information shown
Given I am on the product detail page
Then the product image, name, description, price, category badge, and brand badge are shown.

AC2 – Discount price display
Given the product has a discount
Then the original price is shown with a strikethrough
And the discounted price and discount percentage badge are displayed.

AC3 – Quantity selector
Given the product is in stock
Then a quantity input field is displayed with plus (+) and minus (-) buttons
And the default quantity is 1.

AC4 – Increase quantity
Given the quantity input is displayed
When I click the plus button
Then the quantity increases by 1.

AC5 – Decrease quantity
Given the quantity is greater than 1
When I click the minus button
Then the quantity decreases by 1.

AC6 – Minimum quantity
Given the quantity is 1
When I click the minus button
Then the quantity remains at 1.

AC7 – Manual quantity entry
Given the quantity input is displayed
When I type a number directly into the input field
Then the quantity is updated to the entered value
And the value is clamped between 1 and 999,999,999.

AC8 – Add to cart
Given a valid quantity is selected
When I click the "Add to Cart" button
Then the product is added to the cart with the selected quantity
And a success message "Product added to shopping cart." is displayed.

AC9 – Out of stock
Given the product is not in stock and is not a rental item
Then the "Add to Cart" button is disabled
And "Out of stock" is shown in red.

AC10 – Rental duration slider
Given the product is a rental item
Then a duration slider (1–10 hours) is shown instead of plus/minus buttons
And the total price is calculated as hourly rate multiplied by duration.

AC11 – Add to Favorites
Given I am logged in
When I click "Add to Favorites"
Then a success message "Product added to your favorites list." is displayed.

AC12 – Duplicate favorite
Given the product is already in my favorites
When I click "Add to Favorites"
Then the message "Product already in your favorites list." is displayed.

AC13 – Not logged in
Given I am not logged in
When I click "Add to Favorites"
Then the message "Unauthorized, can not add product to your favorite list." is displayed.

AC14 – Related products
Given the product detail page is displayed
Then related products are shown below the main information.