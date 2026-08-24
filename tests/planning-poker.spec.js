const { test, expect } = require("@playwright/test");

async function openCleanController(context) {
  const page = await context.newPage();
  await page.goto(".");
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

async function resetSharedCardAnimationLog(page) {
  await page.evaluate(() => {
    window.__sharedCardAnimations = [];

    if (window.__sharedCardAnimationLogInstalled) {
      return;
    }

    window.__sharedCardAnimationLogInstalled = true;
    document.querySelector("#sharedTable")?.addEventListener(
      "animationstart",
      (event) => {
        const card = event.target;
        if (!(card instanceof HTMLElement) || !card.classList.contains("participant-card")) {
          return;
        }

        const participant = card.closest(".participant");
        const name = participant?.querySelector(".participant-name")?.textContent ?? "";
        window.__sharedCardAnimations.push({ name, animationName: event.animationName });
      },
      true
    );
  });
}

async function sharedCardAnimationCounts(page, animationName) {
  return page.evaluate((expectedAnimationName) => {
    return (window.__sharedCardAnimations ?? [])
      .filter((entry) => entry.animationName === expectedAnimationName)
      .reduce((counts, entry) => {
        counts[entry.name] = (counts[entry.name] ?? 0) + 1;
        return counts;
      }, {});
  }, animationName);
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

  const deckBox = await controller.locator("#deck").boundingBox();
  const actionsBox = await controller.locator(".actions").boundingBox();
  if (!deckBox || !actionsBox) {
    throw new Error("Expected deck and action controls to be laid out");
  }
  expect(actionsBox.y).toBeGreaterThan(deckBox.y + deckBox.height - 1);

  await controller.getByRole("button", { name: "Ready" }).click();

  await expect(controller.locator("#stateLabel")).toHaveText("Ready");
  await expect(controller.getByRole("button", { name: "Not Ready" })).toBeVisible();
});

test("public display starts as an empty card field", async ({ context }) => {
  const controller = await openCleanController(context);
  const publicDisplay = await context.newPage();
  await publicDisplay.goto("?view=public");
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
  await publicDisplay.goto("?view=public");
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
  await publicDisplay.goto("?view=public");

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

test("shared room syncs readiness and cards across two participants and a public display", async ({
  browser,
}) => {
  test.setTimeout(60_000);

  const room = `playwright-${Date.now()}`;
  const controllerAContext = await browser.newContext();
  const controllerBContext = await browser.newContext();
  const publicContext = await browser.newContext();

  try {
    const controllerA = await controllerAContext.newPage();
    const controllerB = await controllerBContext.newPage();
    const publicDisplay = await publicContext.newPage();

    await controllerA.goto(`?room=${room}`);
    await controllerB.goto(`?room=${room}`);
    await publicDisplay.goto(`?room=${room}&view=public`);
    await disableTransitions(controllerA);
    await disableTransitions(controllerB);
    await disableTransitions(publicDisplay);

    await expect(controllerA.locator("#roomPill")).toHaveText(room);
    await expect(controllerA.locator("#connectionLabel")).toHaveText("Online", { timeout: 20_000 });
    await expect(controllerB.locator("#connectionLabel")).toHaveText("Online", { timeout: 20_000 });
    await expect(publicDisplay.locator("#connectionLabel")).toHaveText("Online", { timeout: 20_000 });

    await controllerA.locator("#participantNameInput").fill("Alice");
    await controllerB.locator("#participantNameInput").fill("Bob");
    await controllerA.getByRole("button", { name: "Ready" }).click();
    await controllerB.getByRole("button", { name: "Ready" }).click();
    await controllerA.getByRole("button", { name: "Select 13" }).click();
    await controllerB.getByRole("button", { name: "Select 5" }).click();

    const controllerAlice = controllerA.locator("#sharedTable .participant").filter({ hasText: "Alice" });
    const controllerAliceCard = controllerAlice.locator(".participant-card");
    const participants = publicDisplay.locator("#sharedTable .participant");
    const alice = participants.filter({ hasText: "Alice" });
    const bob = participants.filter({ hasText: "Bob" });

    await expect(controllerAliceCard).toHaveClass(/is-entering/);
    await expect(controllerAliceCard).toHaveCSS("animation-name", "cardSlideIn");
    await expect(participants).toHaveCount(2, { timeout: 12_000 });
    await expect(alice.locator(".ready-badge")).toHaveText("Ready");
    await expect(bob.locator(".ready-badge")).toHaveText("Ready");
    await expect(alice.locator(".participant-card")).toHaveClass(/is-hidden/);
    await expect(bob.locator(".participant-card")).toHaveClass(/is-hidden/);
    await expect(alice.locator(".participant-value")).toHaveCount(0);
    await expect(bob.locator(".participant-value")).toHaveCount(0);

    await resetSharedCardAnimationLog(publicDisplay);
    await controllerA.getByRole("button", { name: "Reveal All" }).click();

    await expect(controllerAliceCard).toHaveClass(/is-revealing/);
    await expect(controllerAliceCard).toHaveCSS("animation-name", "sharedCardReveal");
    await expect(alice.locator(".participant-card")).toHaveClass(/is-revealed/);
    await expect(bob.locator(".participant-card")).toHaveClass(/is-revealed/);
    await expect(alice.locator(".participant-value")).toHaveText("13");
    await expect(bob.locator(".participant-value")).toHaveText("5");
    await publicDisplay.waitForTimeout(700);

    const revealCounts = await sharedCardAnimationCounts(publicDisplay, "sharedCardReveal");
    expect(revealCounts.Alice).toBe(1);
    expect(revealCounts.Bob).toBe(1);

    await resetSharedCardAnimationLog(publicDisplay);
    await controllerA.getByRole("button", { name: "Hide All" }).click();

    await expect(controllerAliceCard).toHaveClass(/is-hiding/);
    await expect(controllerAliceCard).toHaveCSS("animation-name", "sharedCardHide");
    await expect(controllerA.getByRole("button", { name: "Reveal All" })).toBeVisible();
    await expect(controllerB.getByRole("button", { name: "Reveal All" })).toBeVisible();
    await expect(alice.locator(".participant-card")).toHaveClass(/is-hidden/);
    await expect(bob.locator(".participant-card")).toHaveClass(/is-hidden/);
    await expect(alice.locator(".participant-card")).not.toHaveClass(/is-revealed/);
    await expect(bob.locator(".participant-card")).not.toHaveClass(/is-revealed/);
    await expect(alice.locator(".participant-value")).toHaveCount(0);
    await expect(bob.locator(".participant-value")).toHaveCount(0);

    await publicDisplay.waitForTimeout(700);

    const hideCounts = await sharedCardAnimationCounts(publicDisplay, "sharedCardHide");
    expect(hideCounts.Alice).toBe(1);
    expect(hideCounts.Bob).toBe(1);

    await expect(alice.locator(".participant-card")).toHaveClass(/is-hidden/);
    await expect(bob.locator(".participant-card")).toHaveClass(/is-hidden/);
    await expect(alice.locator(".participant-value")).toHaveCount(0);
    await expect(bob.locator(".participant-value")).toHaveCount(0);

    await controllerA.getByRole("button", { name: "Reveal All" }).click();

    await expect(alice.locator(".participant-card")).toHaveClass(/is-revealed/);
    await expect(bob.locator(".participant-card")).toHaveClass(/is-revealed/);
    await expect(alice.locator(".participant-value")).toHaveText("13");
    await expect(bob.locator(".participant-value")).toHaveText("5");

    await controllerA.getByRole("button", { name: "Reset Room" }).click();

    await expect(controllerAliceCard).toHaveClass(/is-exiting/);
    await expect(controllerAliceCard).toHaveCSS("animation-name", "cardSlideOut");
    await expect(alice.locator(".ready-badge")).toHaveText("Waiting");
    await expect(bob.locator(".ready-badge")).toHaveText("Waiting");
    await expect(alice.locator(".participant-card")).not.toHaveClass(/is-hidden/);
    await expect(bob.locator(".participant-card")).not.toHaveClass(/is-hidden/);
    await expect(alice.locator(".participant-card")).not.toHaveClass(/is-revealed/);
    await expect(bob.locator(".participant-card")).not.toHaveClass(/is-revealed/);
  } finally {
    await controllerAContext.close();
    await controllerBContext.close();
    await publicContext.close();
  }
});
