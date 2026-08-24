const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:4187",
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: "python3 -m http.server 4187 --bind 127.0.0.1",
    url: "http://127.0.0.1:4187",
    reuseExistingServer: false,
    timeout: 10000,
  },
});
