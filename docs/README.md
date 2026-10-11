# Documentation site

Astro + Starlight builds the documentation, search index and dedicated CLI consoles. The
production base is `/terrarium/`. English content initially follows the existing
repository documentation.

Use `mise run site:build` after preparing the fixed formicarium inputs and
package dependencies. It installs this package with its frozen lockfile, runs
`astro check`, builds the documentation separately from the verified `/web/`
assets, then commits the whole local candidate in one transaction. Pages and PR
browser acceptance use the same assembly task.

Content lives in `src/content/docs/`. Dedicated demo routes live in
`src/pages/demos/` and reuse the published terminal element, catalog and runtime
under `/web/`. Do not import the browser-only terminal into Astro's server build.

The Service Worker is copied from the existing vendored `web/coi-serviceworker.js`
to the site root during assembly. A demo registers it for `/terrarium/`, covering
both the page and the shared runtime Workers. A narrower demo-only scope cannot
isolate Workers under `/web/`. Visiting documentation alone registers no worker
and loads no guest; documentation remains usable after a demo registers it.

The root URL opens documentation. Link to `/web/` directly for the console and
iframe, or `/demos/` for the CLI cards and dedicated consoles. These terminal entries accept
their query parameters directly. Demo `run` parameters use the terminal's newline
command format. Never add another Pages deployment workflow for this site.

Biome's Astro support only analyzes frontmatter, so its JS unused-reference and
import autofixes are disabled for `.astro` files. `bun run check` first syncs
Astro's generated types and runs the project's TypeScript 7 compiler, then runs
the official `astro-check` CLI to verify complete templates.

Astro's current checker uses TypeScript's JavaScript compiler API and declares a
TypeScript 5/6 peer dependency; the native TypeScript 7.0 compiler does not provide
that API. `tooling/astro-check/` is an isolated, private tooling package with its
own frozen lockfile. Its compatible TypeScript 6 peer is a tool implementation
dependency, while both project packages use TypeScript 7. No type checks are
skipped. The site assembly installs and runs both checkers after validating the
fixed guest inputs. Dependabot updates the isolated checker in the docs group.

Astro's new content mapper requires TypeScript 7.1 or later. Revisit this isolated
checker once that integration supports a stable TypeScript release.
