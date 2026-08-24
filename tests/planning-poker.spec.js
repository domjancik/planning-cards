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
  await expect(controller.locator("#stateLabel")).toHaveText("No card");
  await expect(controller.locator("#hiddenMarker")).toHaveText("?");

  for (const value of ["1", "3", "5", "8", "13", "infinite"]) {
    await expect(controller.getByRole("button", { name: `Select ${value}`, exact: true })).toBeVisible();
  }

  await expect(controller.getByRole("button", { name: "Ready" })).toBeVisible();
  await expect(controller.getByRole("button", { name: "Reveal" })).toBeDisabled();
  await expect(controller.getByRole("button", { name: "Clear" })).toBeDisabled();
  await expect(controller.getByRole("button", { name: "Display" })).toBeVisible();
  await expect(controller.getByRole("button", { name: "Room" })).toBeVisible();

  await controller.getByRole("button", { name: "Ready" }).click();

  await expect(controller.locator("#stateLabel")).toHaveText("Ready");
  await expect(controller.getByRole("button", { name: "Not Ready" })).toBeVisible();
});

test("public display starts as an empty card field", async ({ context }) => {
  const controller = await openCleanController(context);
  const publicDisplay = await context.newPage();
  await publicDisplay.goto("/?view=public");
  await disableTransitions(publicDisplay);

  await expect(publicDisplay.locator(".topbar")).toBeHidden();
  await expect(publicDisplay.locator(".controls")).toBeHidden();
  await expect(publicDisplay.locator("#displayCard")).toBeVisible();
  await expect(publicDisplay.locator("#displayCard")).not.toHaveClass(/is-revealed/);
  await expect(publicDisplay.locator("#displayCard")).not.toHaveClass(/has-visual-card/);
  await expect(publicDisplay.locator("#cardValue")).toHaveText("?");
  await expect(publicDisplay.locator("#hiddenMarker")).toHaveText("?");
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
  await expect(controller.locator("#displayCard")).toHaveClass(/has-selection/);
  await expect(controller.locator("#displayCard")).toHaveClass(/has-visual-card/);
  await expect(controller.locator("#stateLabel")).toHaveText("Placed");
  await expect(controller.locator("#cardValue")).toHaveText("8");
  await expect(publicDisplay.locator("#displayCard")).not.toHaveClass(/is-revealed/);
  await expect(publicDisplay.locator("#displayCard")).toHaveClass(/has-selection/);
  await expect(publicDisplay.locator("#displayCard")).toHaveClass(/has-visual-card/);
  await expect(publicDisplay.locator("#cardValue")).toHaveText("8");
  await expect(publicDisplay.locator("#hiddenMarker")).toHaveText("?");
  await expect(publicDisplay.locator("#displayCard")).toHaveAttribute("aria-label", "Hidden card placed");
  await expect(publicDisplay.locator("#displayCard")).toHaveScreenshot("public-selected-facedown.png");

  await controller.getByRole("button", { name: "Reveal" }).click();

  await expect(controller.locator("#stateLabel")).toHaveText("Revealed");
  await expect(controller.getByRole("button", { name: "Hide" })).toBeVisible();
  await expect(publicDisplay.locator("#displayCard")).toHaveClass(/is-revealed/);
  await expect(publicDisplay.locator("#displayCard")).toHaveAttribute("aria-label", "Revealed card 8");
  await expect(publicDisplay.locator("#cardValue")).toHaveText("8");
  await expect(publicDisplay.locator("#displayCard")).toHaveScreenshot("public-card-8-revealed.png");
});

test("card slides in when placed and out when cleared", async ({ context }) => {
  const controller = await openCleanController(context);
  const publicDisplay = await context.newPage();
  await publicDisplay.goto("/?view=public");

  await controller.getByRole("button", { name: "Select 5" }).click();

  await expect(publicDisplay.locator("#displayCard")).toHaveClass(/has-visual-card/);
  await expect(publicDisplay.locator("#displayCard")).toHaveClass(/is-entering/);

  await controller.getByRole("button", { name: "Clear" }).click();

  await expect(publicDisplay.locator("#displayCard")).toHaveClass(/is-exiting/);
  await expect(publicDisplay.locator("#displayCard")).toHaveClass(/has-visual-card/);
  await expect(publicDisplay.locator("#displayCard")).not.toHaveClass(/has-selection/);
  await expect(publicDisplay.locator("#displayCard")).toHaveAttribute("aria-label", "No card selected");
  await expect(publicDisplay.locator("#displayCard")).not.toHaveClass(/has-visual-card/, { timeout: 1000 });
});

test("shared room shows local participant readiness and hidden card on the table", async ({ context }) => {
  const controller = await context.newPage();
  await controller.goto("/?room=test-room");
  await controller.evaluate(() => localStorage.clear());
  await controller.reload();
  await disableTransitions(controller);

  await expect(controller.locator("#roomPill")).toHaveText("test-room");
  await expect(controller.locator("#connectionLabel")).toHaveText("Config missing");
  await expect(controller.locator("#sharedTable .participant")).toHaveCount(1);
  await expect(controller.locator("#sharedTable .you-badge")).toHaveText("You");
  await expect(controller.locator("#sharedTable .ready-badge")).toHaveText("Waiting");
  await expect(controller.locator("#sharedTable .participant-card")).not.toHaveClass(/is-hidden/);

  await controller.getByRole("button", { name: "Ready" }).click();
  await controller.getByRole("button", { name: "Select 13" }).click();

  await expect(controller.locator("#stateLabel")).toHaveText("Ready");
  await expect(controller.locator("#sharedTable .ready-badge")).toHaveText("Ready");
  await expect(controller.locator("#sharedTable .participant-card")).toHaveClass(/is-hidden/);
  await expect(controller.locator("#sharedTable .participant-card")).not.toHaveText("13");

  await controller.getByRole("button", { name: "Reveal All" }).click();

  await expect(controller.locator("#sharedTable .participant-card")).toHaveClass(/is-revealed/);
  await expect(controller.locator("#sharedTable .participant-value")).toHaveText("13");

  await controller.getByRole("button", { name: "Reset" }).click();

  await expect(controller.locator("#stateLabel")).toHaveText("No card");
  await expect(controller.locator("#sharedTable .ready-badge")).toHaveText("Waiting");
  await expect(controller.locator("#sharedTable .participant-card")).not.toHaveClass(/is-hidden/);
  await expect(controller.locator("#sharedTable .participant-card")).not.toHaveClass(/is-revealed/);
});
