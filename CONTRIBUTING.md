# Contributing to ChatGPT Ctrl+Enter Sender

Thank you for your interest in contributing! Please read the following guidelines before submitting issues or pull requests.

## Site Support Policy

This extension supports major AI chat services. We use a tier system to manage support:

### Tier 1 — Fully Supported
These sites are actively maintained and tested:
- ChatGPT (chatgpt.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- Microsoft Copilot (copilot.microsoft.com, m365.cloud.microsoft)

### Tier 2 — Community Supported
These sites are supported but maintained on a best-effort basis:
- DeepSeek, Grok, Perplexity, Mistral (Le Chat), NotebookLM, GitHub Copilot Chat

### Tier 3 — Minimal Support
These sites may be removed if they become unmaintainable:
- Poe, v0, Cursor, Genspark, duck.ai, Manus, Kimi

## How New Sites Are Shipped (Opt-in)

Adding a site to the manifest's required permissions disables the extension
for every existing user until they re-approve it. To avoid this, all new
sites are added as **opt-in** sites:

- They are listed in `optional_host_permissions` (never in `host_permissions`
  or static `content_scripts`).
- They are marked `optional: true` in `constants/site-configs.js`.
- Users enable them once per site via the popup ("Enable on this site").
- `tests/permission-warnings.spec.js` should be run locally before release to verify that no change introduces
  a new permission warning.

See the checklist in `constants/site-configs.js` for the exact steps.

## New Site Requests

We consider new site support under these criteria:

- ✅ Major AI chat service with tens of millions of monthly visits
- ✅ Free access to the chat input (verifiable without paid subscription)
- ❌ API dashboards, IDE-embedded chat, or niche services
- ❌ Services with limited regional availability

Pull requests for new sites are welcome but **not guaranteed to be merged**. Please include:
1. The site URL and a description of the input element
2. Confirmation of testing on at least one OS/browser
3. Screenshots or video demonstrating the behavior

## Bug Reports

Bug reports for Tier 1 and Tier 2 sites are always welcome. Please use the issue template and include:
- Browser and OS version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable

## Pull Requests

- One PR per issue. Keep changes small and focused.
- Follow the existing code style.
- Test your changes on the affected site(s).
- Link related issues in the PR description.

## Testing

Run `npm test` before opening a pull request. This command runs the deterministic
unit and extension integration suites and does not connect to supported AI sites.

Tests under `tests/live/` connect to real sites and are intentionally excluded
from the default suite. Run them only from a dedicated test environment:

```shell
npm run login
npm run test:live
```

The live suite reuses the ignored `test-user-data/` profile. Use dedicated test
accounts for that profile; do not copy cookies or a personal browser profile into
the repository test environment. Live-site failures are diagnostic and are not a
release gate because authentication, bot detection, and site DOM changes are
outside this extension's control.

## Releasing

The version lives in `manifest.json`, `package.json` and `package-lock.json`, and
the release workflow refuses to publish when the tag and the manifest disagree.
Bump all three with one command rather than editing them by hand:

```shell
npm run bump 2.5.1
```

Commit that on `development`; a release does not need its own branch. Then:

1. Open a pull request from `development` to `main` and merge it
2. Tag `main` with `vX.Y.Z`, which builds the extension ZIP and creates the GitHub release
3. Upload that ZIP to the Chrome Web Store

## Firefox

**Firefox support has been discontinued.** The maintainer does not use Firefox and the Firefox extension platform has significant differences (MV3 migration, etc.), making continued maintenance difficult. The Firefox branch contains the last available version.
