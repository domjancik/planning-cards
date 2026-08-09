const { chromium } = require("@playwright/test");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "docs", "screenshots");
const baseUrl = "http://127.0.0.1:4173";

function startServer() {
  const server = spawn("python3", ["-m", "http.server", "4173", "--bind", "127.0.0.1"], {
    cwd: root,
    stdio: "ignore",
  });

  return server;
}

async function waitForServer() {
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  throw new Error(`Server did not become ready at ${baseUrl}`);
}

async function disableMotion(page) {
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

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const server = startServer();
  try {
    await waitForServer();

    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const controller = await context.newPage();
    const publicDisplay = await context.newPage();

    await controller.goto(baseUrl);
    await controller.evaluate(() => localStorage.clear());
    await controller.reload();
    await publicDisplay.goto(`${baseUrl}/?view=public`);

    await disableMotion(controller);
    await disableMotion(publicDisplay);

    await controller.getByRole("button", { name: "Select 8" }).click();
    await controller.locator("#displayCard").waitFor({ state: "visible" });
    await publicDisplay.locator("#displayCard.has-visual-card").waitFor({ state: "visible" });

    await controller.screenshot({
      path: path.join(outDir, "controller-placed.png"),
      fullPage: false,
    });
    await publicDisplay.screenshot({
      path: path.join(outDir, "public-hidden.png"),
      fullPage: false,
    });

    await controller.getByRole("button", { name: "Reveal" }).click();
    await publicDisplay.locator("#displayCard.is-revealed").waitFor({ state: "visible" });
    await publicDisplay.screenshot({
      path: path.join(outDir, "public-revealed.png"),
      fullPage: false,
    });

    await browser.close();
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
