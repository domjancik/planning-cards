const { defineConfig } = require("@playwright/test");

function baseUrl(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

const baseURL = baseUrl(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4187");

module.exports = defineConfig({
  testDir: "./tests",
  use: {
    baseURL,
    viewport: { width: 1280, height: 720 },
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "python3 -m http.server 4187 --bind 127.0.0.1",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 10000,
      },
});
