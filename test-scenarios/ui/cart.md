# UI: Cart

## UI-CART-001: Add a product with quantity 2 to the cart

- **Role:** default
- **Automated in:** `tests/ui/cart/add-to-cart.spec.ts`

**Steps**
1. Search for `Combination Pliers` and open the product.
2. Set quantity to 2 and click "Add to cart".
3. Open the cart.

**Expected**
- The cart badge in the nav bar shows `2`.
- The cart has exactly one line: "Combination Pliers", quantity 2.
- Cart total = 2 × the product's unit price.
