# ChatGPT Ctrl+Enter Sender

English | [日本語](README_JA.md) | [简体中文](README_CH.md)

## Overview

* Assigns "Ctrl+Enter" for message sending in ChatGPT to prevent accidental sending
* Intuitively use "Enter" for line breaks

## Browser Support

### Chromium-based Browsers (e.g. Chrome, Edge, Brave, etc.)
[Chat AI Ctrl+Enter Sender - Chrome Web Store](https://chromewebstore.google.com/detail/chat-ai-ctrl+enter-sender/gbncgdhklmnckojlibfhdadpfbcdbnch)

### Firefox
[Firefox Add-on page](https://github.com/masachika-kamada/ChatGPT-Ctrl-Enter-Sender/tree/firefox)

> **Note:** The Firefox version is not currently being updated as the maintainer is unable to dedicate time to it. The link above is the last available version.

## Features

**ChatGPT Ctrl+Enter Sender** allows you to send messages in ChatGPT and other sites using "Ctrl+Enter".<br>
With this extension, you can use "Enter" for line breaks instead of accidentally sending messages by pressing "Enter" to send.<br>
You can easily toggle the extension on and off with a toggle button by clicking the icon.

You can use this extension on the following pages:

* <https://chatgpt.com>
* <https://claude.ai>
* <https://gemini.google.com>
* <https://copilot.microsoft.com>
* <https://m365.cloud.microsoft/chat>
* <https://chat.deepseek.com>
* <https://grok.com>
* <https://www.perplexity.ai>
* <https://chat.mistral.ai>
* <https://notebooklm.google.com>
* <https://github.com> (Copilot, Spark)
* <https://poe.com>
* <https://v0.app>
* <https://cursor.com/agents> (opt-in)
* <https://www.genspark.ai> (opt-in)
* <https://duck.ai> (opt-in)
* <https://manus.im> (opt-in)
* <https://www.kimi.com> (opt-in)

*Opt-in sites: to keep updates from requiring new permissions for everyone, these sites are enabled per user. Open the site, click the extension icon, and press "Enable on this site" once.*

## Demo Video

<https://user-images.githubusercontent.com/63488322/231231536-0a45f182-eb20-4872-b469-ef0095342011.mp4>

## Usage Tips

We've noticed that when the following extensions are used concurrently, this extension may not function as expected.<br>
If you encounter any issues, we recommend disabling these extensions temporarily to see if the problem is resolved.

* [WebChatGPT](https://chrome.google.com/webstore/detail/webchatgpt-chatgpt-with-i/lpfemeioodjbpieminkklglpmhlngfcn)

### Microsoft Edge Limitation

This extension has been confirmed not to work on Microsoft domains such as `copilot.microsoft.com` and `m365.cloud.microsoft` when using Microsoft Edge (as of July 2026).<br>
If you experience this issue, please try using Chrome or another Chromium-based browser.

## Agent-managed development reload

After an unpacked development copy has been loaded once, repository agents must run the following command after extension-source changes. It updates the local build marker, requests `chrome.runtime.reload()` over a loopback-only control channel, and waits for the restarted extension to report the expected version and build ID. It does not open `chrome://extensions` or operate the user's active tabs.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/reload-extension.ps1
```

The `alarms`, `storage`, and `http://127.0.0.1:18792/*` permissions are used only for this local development reload handshake.

## Contributors

<a href="https://github.com/ry0y4n"><img src="https://github.com/ry0y4n.png" width="40"></a>
<a href="https://github.com/ore88ore"><img src="https://github.com/ore88ore.png" width="40"></a>
<a href="https://github.com/Aniny21"><img src="https://github.com/Aniny21.png" width="40"></a>
<a href="https://github.com/Amritanshu1912"><img src="https://github.com/Amritanshu1912.png" width="40"></a>
<a href="https://github.com/Juris710"><img src="https://github.com/Juris710.png" width="40"></a>
<a href="https://github.com/sahksas"><img src="https://github.com/sahksas.png" width="40"></a>
<a href="https://github.com/coni524"><img src="https://github.com/coni524.png" width="40"></a>
<a href="https://github.com/sakamossan"><img src="https://github.com/sakamossan.png" width="40"></a>
<a href="https://github.com/susumuota"><img src="https://github.com/susumuota.png" width="40"></a>
<a href="https://github.com/inadati"><img src="https://github.com/inadati.png" width="40"></a>
<a href="https://github.com/ankd-k"><img src="https://github.com/ankd-k.png" width="40"></a>
<a href="https://github.com/doma-itachi"><img src="https://github.com/doma-itachi.png" width="40"></a>
<a href="https://github.com/syuya2036"><img src="https://github.com/syuya2036.png" width="40"></a>
<a href="https://github.com/censor-ed"><img src="https://github.com/censor-ed.png" width="40"></a>
<a href="https://github.com/HappyOnigiri"><img src="https://github.com/HappyOnigiri.png" width="40"></a>
<a href="https://github.com/njm2360"><img src="https://github.com/njm2360.png" width="40"></a>
