---
title: Getting started
description: Try the browser terminal and understand its limits.
---

Choose a CLI from the [CLI consoles](/terrarium/demos/) cards. Each opens a
dedicated terminal with its preloaded project. For example, the
[aube console](/terrarium/demos/aube/) loads a local dependency fixture. Try `aube --version`, `ls` and `cat package.json`.

The terminal runs one CLI build at a time. Files persist across commands within
that session; reloading the page starts a fresh session. No server executes your
commands. Network access and Node.js lifecycle scripts are unavailable.

The [original console](/terrarium/web/) also offers pitchfork and Biome.
Existing console and iframe links remain valid, including their query parameters.

The browser requires a secure context and cross-origin isolation. On GitHub
Pages, a Service Worker prepares this automatically and reloads the demo once.
If your browser blocks Service Workers, allow them for the site and reload.
Documentation pages do not load the guest runtime.
