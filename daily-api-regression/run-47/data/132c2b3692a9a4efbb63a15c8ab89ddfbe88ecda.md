# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/products/get-products.spec.ts >> @products-api - Products API >> API-0014: Unknown sort column is not a server error
- Location: tests/api/products/get-products.spec.ts:661:7

# Error details

```
Error: [Request] {"method":"GET","path":"/products","query":{"sort":"no_such_column,asc"}}
[Expected] Status is not 500
[Actual] 500

expect(received).not.toBe(expected) // Object.is equality

Expected: not 500
```

# Test source

```ts
  571 | 
  572 |   test('API-0011: Spec filter returns only products with that spec value', async ({ productsService, productsClient }) => {
  573 |     let request: ListRequest;
  574 |     let response: ApiResponse;
  575 |     let body: Paginated<Product>;
  576 | 
  577 |     const { specName, specValue } = await findProductSpec(productsService);
  578 | 
  579 |     await test.step('Send GET /products with by_spec=<spec_name>:<spec_value>.', async () => {
  580 |       ({ request, response } = await sendList(productsClient, { by_spec: `${specName}:${specValue}` }));
  581 |     });
  582 | 
  583 |     await test.step('Verify the response status is 200.', async () => {
  584 |       body = expectStatusAndBody<Paginated<Product>>(request, response, 200);
  585 |     });
  586 | 
  587 |     await test.step('Verify data is not empty.', async () => {
  588 |       expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
  589 |     });
  590 | 
  591 |     await test.step("Verify every item's specs, from GET /products/{productId} for the item, include a spec with that spec_name and spec_value.", async () => {
  592 |       expectSomeItems(request, body.data, 'data');
  593 |       for (const item of body.data) {
  594 |         const details = await productsService.getById(item.id);
  595 |         await attachJson(`Get Product ${item.id} Response`, details);
  596 |         const specs = (details.specs ?? []).map((spec) => ({ spec_name: spec.spec_name, spec_value: spec.spec_value }));
  597 |         expect(
  598 |           specs.some((spec) => spec.spec_name === specName && spec.spec_value === specValue),
  599 |           assertMessage({
  600 |             request: { method: 'GET', path: `/products/${item.id}` },
  601 |             expected: `Item ${item.id} has the spec ${specName}: ${specValue}`,
  602 |             actual: specs,
  603 |           })
  604 |         ).toBe(true);
  605 |       }
  606 |     });
  607 |   });
  608 | 
  609 |   test('API-0012: Page 2 returns the next products', async ({ productsService, productsClient }) => {
  610 |     let pageOneIds: string[] = [];
  611 |     let request: ListRequest;
  612 |     let response: ApiResponse;
  613 |     let body: Paginated<Product>;
  614 | 
  615 |     await test.step('Send GET /products and keep the item ids of page 1.', async () => {
  616 |       const list = await productsService.list();
  617 |       await attachJson('List Products Response', list);
  618 |       pageOneIds = list.data.map((item) => item.id);
  619 |       expect(pageOneIds.length, assertMessage({ request: LIST_REQUEST, expected: 'Page 1 has items', actual: list.total })).toBeGreaterThan(0);
  620 |     });
  621 | 
  622 |     await test.step('Send GET /products with page=2.', async () => {
  623 |       ({ request, response } = await sendList(productsClient, { page: 2 }));
  624 |     });
  625 | 
  626 |     await test.step('Verify the response status is 200.', async () => {
  627 |       body = expectStatusAndBody<Paginated<Product>>(request, response, 200);
  628 |     });
  629 | 
  630 |     await test.step('Verify current_page is 2.', async () => {
  631 |       expect(body.current_page, assertMessage({ request, expected: 'current_page is 2', actual: body.current_page })).toBe(2);
  632 |     });
  633 | 
  634 |     await test.step('Verify no item id on page 2 is among the page 1 ids.', async () => {
  635 |       const repeated = body.data.map((item) => item.id).filter((id) => pageOneIds.includes(id));
  636 |       expect(repeated, assertMessage({ request, expected: 'No page 2 id is on page 1', actual: { repeated, pageOneIds } })).toEqual([]);
  637 |     });
  638 |   });
  639 | 
  640 |   test('API-0013: Unknown category id returns an empty list', async ({ productsClient }) => {
  641 |     /** A well-formed ULID that no category has. */
  642 |     const unknownCategoryId = '01ZZZZZZZZZZZZZZZZZZZZZZZZ';
  643 |     let request: ListRequest;
  644 |     let response: ApiResponse;
  645 | 
  646 |     await test.step('Send GET /products with by_category set to a well-formed ULID that no category has.', async () => {
  647 |       ({ request, response } = await sendList(productsClient, { by_category: unknownCategoryId }));
  648 |     });
  649 | 
  650 |     await test.step('Verify the response status is 200.', async () => {
  651 |       expectStatusAndBody<Paginated<Product>>(request, response, 200);
  652 |     });
  653 | 
  654 |     await test.step('Verify data is an empty array.', async () => {
  655 |       const body = parseJson<Paginated<Product>>(request, response);
  656 |       expect(Array.isArray(body.data), assertMessage({ request, expected: 'data is an array', actual: body.data })).toBe(true);
  657 |       expect(body.data, assertMessage({ request, expected: 'data is empty', actual: body.data })).toEqual([]);
  658 |     });
  659 |   });
  660 | 
  661 |   test('API-0014: Unknown sort column is not a server error', async ({ productsClient }) => {
  662 |     test.fail(true, 'Known issue BUG-003: Returns 500 instead of a client error (or ignoring the column) for an unknown sort column.');
  663 |     let request: ListRequest;
  664 |     let response: ApiResponse;
  665 | 
  666 |     await test.step('Send GET /products with sort=no_such_column,asc.', async () => {
  667 |       ({ request, response } = await sendList(productsClient, { sort: 'no_such_column,asc' }));
  668 |     });
  669 | 
  670 |     await test.step('Verify the response status is not 500.', async () => {
> 671 |       expect(response.status, assertMessage({ request, expected: 'Status is not 500', actual: response.status })).not.toBe(500);
      |                                                                                                                       ^ Error: [Request] {"method":"GET","path":"/products","query":{"sort":"no_such_column,asc"}}
  672 |     });
  673 |   });
  674 | 
  675 |   test('API-0319: Filter by two category ids returns only products of those two categories', async ({ productsService, productsClient }) => {
  676 |     await filterByTwoCategories(productsService, productsClient);
  677 |   });
  678 | 
  679 |   test('API-0320: Filter by two brand ids returns only products of those two brands', async ({ productsService, productsClient }) => {
  680 |     await filterByTwoBrands(productsService, productsClient);
  681 |   });
  682 | 
  683 |   test('API-0321: Filter by brand and category together returns only products that match both', async ({ productsService, productsClient }) => {
  684 |     let request: ListRequest;
  685 |     let response: ApiResponse;
  686 |     let body: Paginated<Product>;
  687 | 
  688 |     const refs = await takeProductRefs(productsService, "Send GET /products and take the first item's brand id and category id.", ['brandId', 'categoryId']);
  689 | 
  690 |     await test.step('Send GET /products with by_brand set to that brand id and by_category set to that category id.', async () => {
  691 |       ({ request, response } = await sendList(productsClient, { by_brand: refs.brandId, by_category: refs.categoryId }));
  692 |     });
  693 | 
  694 |     await test.step('Verify the response status is 200.', async () => {
  695 |       body = expectStatusAndBody<Paginated<Product>>(request, response, 200);
  696 |     });
  697 | 
  698 |     await test.step('Verify data is not empty.', async () => {
  699 |       expect(body.data.length, assertMessage({ request, expected: 'data is not empty', actual: body.total })).toBeGreaterThan(0);
  700 |     });
  701 | 
  702 |     await test.step("Verify every item's brand id equals that brand id and its category id equals that category id.", async () => {
  703 |       expectSomeItems(request, body.data, 'data');
  704 |       for (const item of body.data) {
  705 |         const actual = { id: item.id, brand: item.brand, category: item.category };
  706 |         expect(item.brand?.id, assertMessage({ request, expected: `Item ${item.id}: brand id is ${refs.brandId}`, actual })).toBe(refs.brandId);
  707 |         expect(item.category?.id, assertMessage({ request, expected: `Item ${item.id}: category id is ${refs.categoryId}`, actual })).toBe(refs.categoryId);
  708 |       }
  709 |     });
  710 |   });
  711 | 
  712 |   test.describe(() => {
  713 |     test.use({ authMode: 'none' });
  714 | 
  715 |     test('API-0322: A product created with stock 0 is listed as not in stock', async ({ productsService, productsClient, adminProductsService, cleanup }) => {
  716 |       await createAndFindByStock(productsService, productsClient, adminProductsService, cleanup, 0, false);
  717 |     });
  718 | 
  719 |     test('API-0323: A product created with stock above 0 is listed as in stock', async ({ productsService, productsClient, adminProductsService, cleanup }) => {
  720 |       await createAndFindByStock(productsService, productsClient, adminProductsService, cleanup, 10, true);
  721 |     });
  722 |   });
  723 | 
  724 |   test('API-0324: A product created as a rental is listed by the rental filter', async ({
  725 |     productsService,
  726 |     productsClientWithToken,
  727 |     productsClient,
  728 |     adminProductsService,
  729 |     cleanup,
  730 |   }) => {
  731 |     let createRequest: CreateProductRequestInfo;
  732 |     let createResponse: ApiResponse;
  733 |     let productName = '';
  734 |     let productId = '';
  735 |     let request: ListRequest;
  736 |     let response: ApiResponse;
  737 |     let body: Paginated<Product>;
  738 |     let item: Product;
  739 | 
  740 |     const refs = (await takeProductRefs(productsService, PRODUCT_LIST_STEP)) as ProductRefs;
  741 | 
  742 |     await test.step(
  743 |       "Send POST /products with a unique product name, a positive price, those ids, is_location_offer false, is_rental true and stock 10, and take the new product's id.",
  744 |       async () => {
  745 |         ({ request: createRequest, response: createResponse, name: productName, productId } = await createListedProduct(
  746 |           productsClientWithToken,
  747 |           adminProductsService,
  748 |           cleanup,
  749 |           refs,
  750 |           { is_rental: true, stock: 10 },
  751 |           AUTH.defaultUser
  752 |         ));
  753 |       }
  754 |     );
  755 | 
  756 |     await test.step('Verify the response status is 201.', async () => {
  757 |       expectStatus(createRequest, createResponse, 201);
  758 |     });
  759 | 
  760 |     await test.step('Send GET /products with is_rental=true and q set to that unique product name.', async () => {
  761 |       ({ request, response } = await sendList(productsClient, { is_rental: 'true', q: productName }));
  762 |     });
  763 | 
  764 |     await test.step('Verify the response status is 200.', async () => {
  765 |       body = expectStatusAndBody<Paginated<Product>>(request, response, 200);
  766 |     });
  767 | 
  768 |     await test.step("Verify data has exactly one item and its id is the new product's id.", async () => {
  769 |       item = expectOnlyNewProduct(request, body, productId);
  770 |     });
  771 | 
```