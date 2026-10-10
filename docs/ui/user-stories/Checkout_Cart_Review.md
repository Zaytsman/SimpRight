As a customer, I want to review the items in my cart, including any applied discounts, so that I can verify my order is correct.

Acceptance Criteria
AC1 – Cart contents displayed
Given I have items in my cart
When I navigate to the checkout page
Then a table is displayed with columns: Item, Quantity, Price, Total, and Actions.

AC2 – Update quantity
Given I change the quantity of a cart item
Then the item total and cart total are recalculated
And a confirmation message "Product quantity updated." is displayed.

AC3 – Delete item
Given I click the delete button on a cart item
Then the item is removed from the cart
And the cart total is recalculated.

AC4 – Empty cart
Given I have no items in my cart
Then the message "Your shopping cart is empty" is displayed.

AC5 – Proceed
Given the cart contains at least one item
When I click "Proceed"
Then I advance to the next checkout step.

AC6 – Discount badge on items
Given a cart item has a discount
Then a discount badge is shown next to the product name
And both the original and discounted price are displayed.

AC7 – Combined product discount
Given the cart contains both rental and non-rental items
Then a 15% additional discount is applied to the cart subtotal
And the cart shows the subtotal, discount amount, and final total.

AC8 – Combined discount removed
Given I remove all rental or all non-rental items
Then the 15% combined discount is removed
And the total reverts to the regular subtotal.