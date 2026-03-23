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
- Poe, v0

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

## Firefox

**Firefox support has been discontinued.** The maintainer does not use Firefox and the Firefox extension platform has significant differences (MV3 migration, etc.), making continued maintenance difficult. The Firefox branch contains the last available version.
