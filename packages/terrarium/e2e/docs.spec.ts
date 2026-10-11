import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { releaseVersion } from '../../../scripts/latest-guests.mjs';
import { PAGES, SITE } from '../playwright.formicarium.config.ts';
import type { TerrariumTerminal } from '../src/terminal.ts';

const root = process.env.TERRARIUM_SITE_DIR!;
const tools = JSON.parse(
  readFileSync(path.join(root, 'web/tools.json'), 'utf8'),
);
const { builds } = JSON.parse(
  readFileSync(path.join(root, 'web/dist/builds.json'), 'utf8'),
);
const aube = builds.aube[tools.aube.default];
test.use({ serviceWorkers: 'allow' });

test('documentation navigation and search work under the Pages base without loading guests', async ({
  page,
}) => {
  const guestRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/web\//.test(request.url())) guestRequests.push(request.url());
  });
  await page.goto(`${PAGES}/terrarium/`);
  await expect(
    page.getByRole('heading', { name: 'A CLI in your browser', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Get started', exact: true }).click();
  await expect(page).toHaveURL(/\/terrarium\/guides\/getting-started\/$/);
  await page.getByRole('button', { name: 'Search', exact: false }).click();
  await page
    .getByRole('textbox', { name: 'Search', exact: true })
    .fill('Embedding');
  await expect(
    page
      .locator('.pagefind-ui__result-link')
      .filter({ hasText: 'Embedding' })
      .first(),
  ).toBeVisible();
  expect(guestRequests).toEqual([]);
  expect(
    await page.evaluate(() => navigator.serviceWorker.controller),
  ).toBeNull();
});

test('aube dedicated demo runs the accepted guest on Pages without server isolation headers', async ({
  page,
}) => {
  const response = await page.goto(`${PAGES}/terrarium/demos/aube/`);
  expect(response?.headers()['cross-origin-opener-policy']).toBeUndefined();
  await expect(page.locator('#demo-status')).toContainText('Ready: aube');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope,
  );
  expect(scope).toBe(`${PAGES}/terrarium/`);
  // The controller must keep a Safari-compatible policy on later navigations.
  await page.reload();
  await expect(page.locator('#demo-status')).toContainText('Ready: aube');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  const result = await page.evaluate(async () => {
    const terminal = document.querySelector(
      'terrarium-terminal',
    ) as TerrariumTerminal;
    const ready = await terminal.ready;
    const version = await terminal.run('aube --version');
    const project = await terminal.run('cat package.json');
    return { ready, version, project };
  });
  expect(result.ready).toMatchObject({
    tool: 'aube',
    ref: aube.ref,
    commit: aube.source.commit,
  });
  expect(result.version.code).toBe(0);
  expect(result.version.output).toContain(releaseVersion(aube.ref));
  expect(result.project.code).toBe(0);
  expect(result.project.output).toContain('dependencies');
  await page.screenshot({
    path: test.info().outputPath('aube-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  await page.screenshot({
    path: test.info().outputPath('aube-mobile.png'),
    fullPage: true,
  });
  await page.goto(`${PAGES}/terrarium/guides/embedding/`);
  await expect(
    page.getByRole('heading', { name: 'Embedding', exact: true }),
  ).toBeVisible();
  await expect(page.locator('terrarium-terminal')).toHaveCount(0);
});

test('dedicated demo preserves ref and session query parameters', async ({
  page,
}) => {
  await page.goto(
    `${SITE}/terrarium/demos/aube/?ref=${encodeURIComponent(tools.aube.default)}&fixture=&cwd=%2Fwork&run=pwd&run=ls`,
  );
  await expect(page.locator('#demo-status')).toContainText('Ready: aube');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (document.querySelector('terrarium-terminal') as TerrariumTerminal)
            .transcript,
      ),
    )
    .toBe('/work\n');
});

test('original console accepts direct query links', async ({ page }) => {
  const query = '?tool=aube&fixture=&cwd=%2Fwork&run=pwd';
  await page.goto(`${SITE}/terrarium/web/${query}`);
  await expect(page).toHaveURL(`${SITE}/terrarium/web/${query}`);
  await expect(page.locator('#status')).toContainText('Ready in');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (document.querySelector('terrarium-terminal') as TerrariumTerminal)
            .transcript,
      ),
    )
    .toBe('/work\n');
});
