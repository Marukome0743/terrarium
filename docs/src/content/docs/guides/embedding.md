---
title: Embedding
description: Embed the terminal as a custom element or iframe.
---

## Custom element

Import the terminal bundle in your browser and point `base` at the published
runtime assets. The hosting page must provide cross-origin isolation (COOP/COEP).

```html
<script type="module" src="https://aletheia-works.github.io/terrarium/web/terrarium.mjs"></script>
<terrarium-terminal
  tool="aube"
  base="https://aletheia-works.github.io/terrarium/web/"
></terrarium-terminal>
```

Listen for `terrarium-ready`, `terrarium-exit` and `terrarium-error`.
After `terminal.ready` resolves, call `terminal.run('aube --version')`.
The published npm package is `@aletheia-works/terrarium`.

## Iframe

The existing iframe entry stays at `/terrarium/web/`. Set `embed=1` and
`origin` to your parent's exact origin. Validate the sender's origin and
`event.source` when receiving `terrarium:ready`, `terrarium:exit` and
`terrarium:error`. Send commands with `{ type: 'terrarium:run', command: 'ls' }`.

```html
<iframe
  src="https://aletheia-works.github.io/terrarium/web/?tool=aube&embed=1&origin=https%3A%2F%2Fexample.com"
  allow="cross-origin-isolated"
  credentialless
></iframe>
```

Cross-origin iframe hosting also requires isolation on the parent page and
browser support for credentialless iframes. Same-origin hosting works across
Chromium, Firefox and WebKit. See the repository's browser fixtures for examples.
