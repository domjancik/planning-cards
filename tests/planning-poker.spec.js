const { test, expect } = require("@playwright/test");

async function openCleanController(context) {
  const page = await context.newPage();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  return page;
}

async function disableTransitions(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

test("controller exposes the expected private controls", async ({ context }) => {
  const controller = await openCleanController(context);
  await disableTransitions(controller);

  await expect(controller.getByRole("heading", { name: "Planning Poker" })).toBeVisible();
  await expect(controller.locator("#displayCard")).toBeVisible();
  await expect(controller.locator("#displayCard")).toBeDisabled();
  await expect(controller.locator("#stateLabel")).toHaveText("Hidden");

  for (const value of ["1", "3", "5", "8", "13", "infinite"]) {
    await expect(controller.getByRole("button", { name: `Select ${value}`, exact: true })).toBeVisible();
  }

  await expect(controller.getByRole("button", { name: "Reveal" })).toBeDisabled();
  await expect(controller.getByRole("button", { name: "Clear" })).toBeDisabled();
  await expect(controller.getByRole("button", { name: "Display" })).toBeVisible();
});

test("public display starts as a clean face-down card", async ({ context }) => {
  const controller = await openCleanController(context);
  const publicDisplay = await context.newPage();
  await publicDisplay.goto("/?view=public");
  await disableTransitions(publicDisplay);

  await expect(publicDisplay.locator(".topbar")).toBeHidden();
  await expect(publicDisplay.locator(".controls")).toBeHidden();
  await expect(publicDisplay.locator("#displayCard")).toBeVisible();
  await expect(publicDisplay.locator("#displayCard")).not.toHaveClass(/is-revealed/);
  await expect(publicDisplay.locator("#cardValue")).toHaveText("?");
  await expect(publicDisplay.locator("#displayCard")).toHaveScreenshot("public-empty-facedown.png");

  await controller.close();
});

test("public display syncs selected face-down and revealed card states", async ({ context }) => {
  const controller = await openCleanController(context);
  const publicDisplay = await context.newPage();
  await publicDisplay.goto("/?view=public");
  await disableTransitions(controller);
  await disableTransitions(publicDisplay);

  await controller.getByRole("button", { name: "Select 8" }).click();

  await expect(controller.locator("#displayCard")).not.toHaveClass(/is-revealed/);
  await expect(controller.locator("#cardValue")).toHaveText("8");
  await expect(publicDisplay.locator("#displayCard")).not.toHaveClass(/is-revealed/);
  await expect(publicDisplay.locator("#cardValue")).toHaveText("8");
  await expect(publicDisplay.locator("#displayCard")).toHaveScreenshot("public-selected-facedown.png");

  await controller.getByRole("button", { name: "Reveal" }).click();

  await expect(controller.locator("#stateLabel")).toHaveText("Revealed");
  await expect(controller.getByRole("button", { name: "Hide" })).toBeVisible();
  await expect(publicDisplay.locator("#displayCard")).toHaveClass(/is-revealed/);
  await expect(publicDisplay.locator("#displayCard")).toHaveAttribute("aria-label", "Revealed card 8");
  await expect(publicDisplay.locator("#cardValue")).toHaveText("8");
  await expect(publicDisplay.locator("#displayCard")).toHaveScreenshot("public-card-8-revealed.png");
});
