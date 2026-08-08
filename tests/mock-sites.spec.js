const { test } = require("./fixtures");
const { expect } = require("@playwright/test");

const MOCK_SITES = [
  {
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    route: "https://chatgpt.com/**",
    markup: '<div id="prompt-textarea" contenteditable="true" role="textbox"></div>',
    inputSelector: "#prompt-textarea",
  },
  {
    name: "Claude",
    url: "https://claude.ai/new",
    route: "https://claude.ai/**",
    markup: '<div id="prompt" contenteditable="true" role="textbox"></div>',
    inputSelector: "#prompt",
  },
  {
    name: "Gemini",
    url: "https://gemini.google.com/app",
    route: "https://gemini.google.com/**",
    markup: '<div id="prompt" class="ql-editor" contenteditable="true" role="textbox"></div>',
    inputSelector: "#prompt",
  },
  {
    name: "Copilot",
    url: "https://copilot.microsoft.com/",
    route: "https://copilot.microsoft.com/**",
    markup: '<textarea id="prompt"></textarea>',
    inputSelector: "#prompt",
  },
  {
    name: "Microsoft 365 Copilot",
    url: "https://m365.cloud.microsoft/chat",
    route: "https://m365.cloud.microsoft/**",
    markup: '<div id="m365-chat-editor-target-element" contenteditable="true" role="textbox"></div>',
    inputSelector: "#m365-chat-editor-target-element",
  },
  {
    name: "DeepSeek",
    url: "https://chat.deepseek.com/",
    route: "https://chat.deepseek.com/**",
    markup: '<textarea id="prompt"></textarea>',
    inputSelector: "#prompt",
  },
  {
    name: "Grok",
    url: "https://grok.com/",
    route: "https://grok.com/**",
    markup: '<textarea id="prompt"></textarea>',
    inputSelector: "#prompt",
  },
  {
    name: "Perplexity",
    url: "https://www.perplexity.ai/",
    route: "https://www.perplexity.ai/**",
    markup: '<div id="ask-input" contenteditable="true" role="textbox"></div>',
    inputSelector: "#ask-input",
  },
  {
    name: "Mistral",
    url: "https://chat.mistral.ai/chat",
    route: "https://chat.mistral.ai/**",
    markup: '<div id="prompt" class="ProseMirror" contenteditable="true" role="textbox"></div>',
    inputSelector: "#prompt",
  },
  {
    name: "GitHub Copilot",
    url: "https://github.com/copilot",
    route: "https://github.com/**",
    markup: '<textarea id="prompt"></textarea>',
    inputSelector: "#prompt",
  },
  {
    name: "Poe",
    url: "https://poe.com/",
    route: "https://poe.com/**",
    markup: '<textarea id="prompt"></textarea>',
    inputSelector: "#prompt",
  },
  {
    name: "v0",
    url: "https://v0.app/",
    route: "https://v0.app/**",
    markup: '<textarea id="prompt"></textarea>',
    inputSelector: "#prompt",
  },
];

function createSiteFixture(site) {
  return `<!doctype html>
<html>
<body>
  ${site.markup}
  <script>
    const input = document.querySelector(${JSON.stringify(site.inputSelector)});
    const submitViaButton = ${Boolean(site.submitViaButton)};
    window.fixtureState = { submitCount: 0 };

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;

      if (event.shiftKey) {
        event.preventDefault();
        if (input instanceof HTMLTextAreaElement) {
          input.value += "\\n";
        } else {
          input.textContent += "\\n";
        }
      } else if (!submitViaButton && !event.defaultPrevented) {
        event.preventDefault();
        window.fixtureState.submitCount += 1;
      }
    });

    const submitButton = document.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.addEventListener("click", (event) => {
        event.preventDefault();
        window.fixtureState.submitCount += 1;
      });
    }
  </script>
</body>
</html>`;
}

for (const site of MOCK_SITES) {
  test(`${site.name} maps Enter to newline and Ctrl+Enter to one submit`, async ({ context }) => {
    await context.route(site.route, (route) => route.fulfill({
      contentType: "text/html",
      body: createSiteFixture(site),
    }));

    const page = await context.newPage();
    await page.goto(site.url);
    // The first run opens the options page, which would otherwise take the keystrokes
    await page.bringToFront();

    const input = page.locator(site.inputSelector);
    await input.click();
    await page.keyboard.press("Enter");

    await expect.poll(() => input.evaluate((element) => (
      element instanceof HTMLTextAreaElement ? element.value : element.textContent
    ))).toContain("\n");
    await expect.poll(() => page.evaluate(() => window.fixtureState.submitCount)).toBe(0);

    await page.keyboard.press("Control+Enter");

    await expect.poll(() => page.evaluate(() => window.fixtureState.submitCount)).toBe(1);
  });
}
