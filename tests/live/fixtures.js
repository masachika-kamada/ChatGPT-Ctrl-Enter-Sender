// Playwright fixtures for optional tests against live sites.
// The persistent profile retains sessions created by tests/login-helper.js.
const { test: base, chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const { createTestExtension } = require("../fixtures");

const test = base.extend({
	// eslint-disable-next-line no-empty-pattern
	context: async ({}, use) => {
		const userDataDir = path.join(__dirname, "..", "..", "test-user-data");
		if (!fs.existsSync(userDataDir)) {
			fs.mkdirSync(userDataDir, { recursive: true });
		}
		const extensionPath = createTestExtension();

		const context = await chromium.launchPersistentContext(userDataDir, {
			...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
				? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
				: {}),
			headless: false,
			args: [
				`--disable-extensions-except=${extensionPath}`,
				`--load-extension=${extensionPath}`,
				"--no-first-run",
				"--disable-gpu",
				"--disable-blink-features=AutomationControlled",
			],
			ignoreDefaultArgs: ["--enable-automation"],
			viewport: { width: 1280, height: 720 },
		});

		for (const page of context.pages()) {
			await page.addInitScript(() => {
				Object.defineProperty(navigator, "webdriver", { get: () => undefined });
			});
		}
		context.on("page", async (page) => {
			await page.addInitScript(() => {
				Object.defineProperty(navigator, "webdriver", { get: () => undefined });
			});
		});

		await use(context);
		await context.close();
		fs.rmSync(extensionPath, { recursive: true, force: true });
	},
});

module.exports = { test };
