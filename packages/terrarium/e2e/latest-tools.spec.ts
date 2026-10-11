import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { releaseVersion } from '../../../scripts/latest-guests.mjs';
import { SITE } from '../playwright.formicarium.config.ts';
import type { TerrariumTerminal } from '../src/terminal.ts';

const site = process.env.TERRARIUM_SITE_DIR;
if (!site) throw new Error('TERRARIUM_SITE_DIR required');
const resolutions = JSON.parse(
  readFileSync(path.join(site, 'web/latest-resolutions.json'), 'utf8'),
) as {
  tools: Record<string, { ref: string; commit: string }>;
};
for (const [tool, resolved] of Object.entries(resolutions.tools)) {
  test(`${tool} executes the latest stable release at its resolved commit`, async ({
    page,
  }) => {
    await page.goto(`${SITE}/element.html?tool=${encodeURIComponent(tool)}`);
    await page.locator('terrarium-terminal').waitFor();
    const ready = await page.evaluate(
      () =>
        (document.querySelector('terrarium-terminal') as TerrariumTerminal)
          .ready,
    );
    expect(ready).toMatchObject({
      tool,
      ref: resolved.ref,
      commit: resolved.commit,
    });
    const result = await page.evaluate(
      (tool) =>
        (document.querySelector('terrarium-terminal') as TerrariumTerminal).run(
          `${tool} --version`,
        ),
      tool,
    );
    expect(result.code).toBe(0);
    expect(result.output.match(/\b\d+\.\d+\.\d+\b/)?.[0]).toBe(
      releaseVersion(resolved.ref),
    );
  });
}

if (resolutions.tools.biome) {
  test('Biome formats persisted files and reports lint diagnostics on the public page', async ({
    page,
  }) => {
    await page.goto(`${SITE}/web/?tool=biome`);
    await page.locator('terrarium-terminal').waitFor();
    await page.evaluate(
      () =>
        (document.querySelector('terrarium-terminal') as TerrariumTerminal)
          .ready,
    );
    await expect(page.locator('#tool')).toHaveValue('biome');
    const run = (command: string) =>
      page.evaluate(
        (command) =>
          (
            document.querySelector('terrarium-terminal') as TerrariumTerminal
          ).run(command),
        command,
      );
    expect((await run('biome format --write example.js')).code).toBe(0);
    expect((await run('cat example.js')).output).toContain(
      'const greeting = {',
    );
    const lint = await run('biome lint lint.js');
    expect(lint.code).toBe(1);
    expect(lint.output).toContain('noDebugger');
  });
}

const toolRefs = JSON.parse(
  readFileSync(path.join(site, 'web/tool-ref-resolutions.json'), 'utf8'),
) as {
  refs: Array<{
    tool: string;
    name: string;
    commit: string;
    ref: string;
    repo: string;
    fixture: string;
    expected?: { semicolons: string; quoteStyle: string };
  }>;
};
for (const resolved of toolRefs.refs) {
  test(`source ref ${resolved.tool}/${resolved.name} executes with its exact identity and fixture behavior`, async ({
    page,
  }) => {
    await page.goto(
      `${SITE}/element.html?tool=${encodeURIComponent(resolved.tool)}&ref=${encodeURIComponent(resolved.name)}`,
    );
    await page.locator('terrarium-terminal').waitFor();
    const ready = await page.evaluate(
      () =>
        (document.querySelector('terrarium-terminal') as TerrariumTerminal)
          .ready,
    );
    expect(ready).toMatchObject({
      tool: resolved.tool,
      ref: resolved.name,
      commit: resolved.commit,
    });
    // Selecting a source build without a fixture keeps the normal tool usable.
    const normal = await page.evaluate(
      (tool) =>
        (document.querySelector('terrarium-terminal') as TerrariumTerminal).run(
          `${tool} --version`,
        ),
      resolved.tool,
    );
    expect(normal.code).toBe(0);
    expect(normal.output.trim()).not.toBe('');
    await page.goto(
      `${SITE}/element.html?tool=${encodeURIComponent(resolved.tool)}&ref=${encodeURIComponent(resolved.name)}&fixture=${resolved.fixture}`,
    );
    await page.evaluate(async () => {
      await customElements.whenDefined('terrarium-terminal');
      await (document.querySelector('terrarium-terminal') as TerrariumTerminal)
        .ready;
    });
    const result = await page.evaluate(
      (command) =>
        (document.querySelector('terrarium-terminal') as TerrariumTerminal).run(
          command,
        ),
      resolved.tool === 'biome' && resolved.expected
        ? 'biome migrate prettier --write'
        : `${resolved.tool} --version`,
    );
    expect(result.code).toBe(0);
    if (resolved.tool === 'biome' && resolved.expected) {
      const config = await page.evaluate(() =>
        (document.querySelector('terrarium-terminal') as TerrariumTerminal).run(
          'cat biome.json',
        ),
      );
      const parsed = JSON.parse(config.output);
      expect(parsed.javascript.formatter).toMatchObject(resolved.expected);
    }
  });
}
