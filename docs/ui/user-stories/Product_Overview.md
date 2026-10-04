As a visitor, I  want to browse a paginated overview of all products with search, filtering, sorting, and a price range slider, so that I can efficiently find products within my preferences and budget.

Acceptance Criteria
AC1 – Product grid is displayed
Given I navigate to the home page
Then a grid of product cards is displayed
And each card shows a product image, name, and price.

AC2 – Navigating to product detail
Given the product overview is displayed
When I click on a product card
Then I am navigated to the product detail page.

AC3 – Pagination
Given there are more products than fit on one page
Then pagination controls are displayed below the product grid
And clicking a page number updates the grid.

AC4 – Search
Given I enter a valid search query (3–40 characters) and submit
Then the product grid updates to show only matching products
And all active filters are reset.

AC5 – Category filter
Given I check one or more category checkboxes in the sidebar
Then the product grid updates to show only products from those categories.

AC6 – Hierarchical category selection
Given a parent category has child categories
When I check the parent category checkbox
Then all child category checkboxes are also checked
And unchecking all children unchecks the parent.

AC7 – Brand filter
Given I check one or more brand checkboxes in the sidebar
Then the product grid updates to show only products from those brands.

AC8 – Combining filters
Given I have selected categories and brands
Then the product grid shows only products matching both filters.

AC9 – Sorting
Given I select a sort option (Name A-Z, Name Z-A, Price High-Low, Price Low-High)
Then the product grid reloads with products ordered accordingly.

AC10 – Price range slider
Given I am on the product overview page
Then a price range slider is displayed in the sidebar with a default range of $1 to $100 and a maximum of $200.

AC11 – Adjusting the price range
Given I drag the slider handles to a new minimum and maximum
Then the product grid updates to show only products within the selected price range.

AC12 – Discount price display
Given a product has a discount (location-based or otherwise)
Then the product card shows the original price with a strikethrough and the discounted price below.

AC13 – Out of stock indicator
Given a product has no stock available
Then "Out of stock" is displayed on the product card.