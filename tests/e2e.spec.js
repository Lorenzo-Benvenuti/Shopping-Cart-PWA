const { test, expect } = require("@playwright/test");

test.describe("Shopping-Cart-PWA", () => {
  test("loads products and filters by category", async ({ page }) => {
    await page.goto("/");

    // Products rendered
    await expect(page.locator("#appView .card").first()).toBeVisible();

    // Category filter
    await page.selectOption("#categorySelect", "freschi");

    // After filtering there must be at least one product in the "freschi" category
    const visibleAddButtons = page.locator(
      'button[data-testid="add-to-cart"][data-id^="freschi_"]'
    );
    await expect(visibleAddButtons.first()).toBeVisible();
  });

  test("adds to cart and persists after refresh", async ({ page }) => {
    await page.goto("/");

    // Select a category to make the element deterministic
    await page.selectOption("#categorySelect", "dispensa");

    // Increase quantity for the first visible product and add to cart
    const firstInc = page.locator('button[data-testid="qty-inc"][data-id^="dispensa_"]').first();
    await firstInc.click();

    const firstAdd = page
      .locator('button[data-testid="add-to-cart"][data-id^="dispensa_"]')
      .first();
    await firstAdd.click();

    // Cart badge updated
    await expect(page.locator("#cartBadge")).toHaveText(/\d+/);

    // Go to cart
    await page.click("#btnCart");
    await expect(page.getByText("Total", { exact: true })).toBeVisible();

    // Refresh and verify persistence
    await page.reload();
    await page.click("#btnCart");
    await expect(page.getByText("Total", { exact: true })).toBeVisible();

    // Cart must not be empty
    await expect(page.locator("text=Your cart is empty.")).toHaveCount(0);
  });
});
