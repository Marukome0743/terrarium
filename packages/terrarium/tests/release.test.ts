import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isPublished, validateVersion } from '../scripts/release.js';

const metadata = { name: '@aletheia-works/terrarium', version: '0.1.0' };

describe('release validation', () => {
  test('accepts matching stable and prerelease tags', () => {
    expect(validateVersion(metadata, metadata, 'v0.1.0')).toBe('0.1.0');
    const rc = { ...metadata, version: '0.2.0-rc.1' };
    expect(validateVersion(rc, rc, 'v0.2.0-rc.1')).toBe(rc.version);
  });

  test('rejects mismatched manifests, tags and invalid versions', () => {
    expect(() =>
      validateVersion(metadata, { ...metadata, version: '0.2.0' }),
    ).toThrow();
    expect(() =>
      validateVersion(metadata, { ...metadata, name: '@other/tool' }),
    ).toThrow();
    expect(() => validateVersion(metadata, metadata, 'v0.2.0')).toThrow();
    expect(() =>
      validateVersion(metadata, metadata, 'terrarium-v0.1.0'),
    ).toThrow();
    for (const version of ['01.0.0', '0.1.0-01', '0.1', '0.1.0; echo bad']) {
      const invalid = { ...metadata, version };
      expect(() => validateVersion(invalid, invalid)).toThrow();
    }
  });

  test('only registry 404 means unpublished', async () => {
    const url = 'https://registry.npmjs.org/example/0.1.0';
    const mock =
      (status: number, body = '{}') =>
      async () =>
        new Response(body, { status });
    expect(await isPublished(url, mock(404))).toBe(false);
    expect(await isPublished(url, mock(200, '{"version":"0.1.0"}'))).toBe(true);
    expect(await isPublished(url, mock(200, '{"manifest":{}}'))).toBe(true);
    for (const status of [401, 403, 429, 500, 503]) {
      await expect(isPublished(url, mock(status))).rejects.toThrow();
    }
    for (const body of ['{}', 'null', '[]', 'not json']) {
      await expect(isPublished(url, mock(200, body))).rejects.toThrow();
    }
    const offline = async () => {
      throw new Error('offline');
    };
    await expect(isPublished(url, offline)).rejects.toThrow('offline');
  });

  test('repository-wide release config updates both published manifests', () => {
    const read = (name: string) =>
      readFileSync(new URL(`../../../${name}`, import.meta.url), 'utf8');
    const config = JSON.parse(read('.github/release-please-config.json'));
    expect(Object.keys(config.packages)).toEqual(['.']);
    expect(config.packages['.']['release-type']).toBe('simple');
    expect(config.packages['.']['include-component-in-tag']).toBe(false);
    expect(config.packages['.']['extra-files']).toEqual([
      {
        type: 'json',
        path: 'packages/terrarium/package.json',
        jsonpath: '$.version',
      },
      {
        type: 'json',
        path: 'packages/terrarium/jsr.json',
        jsonpath: '$.version',
      },
    ]);
    const npm = JSON.parse(read('packages/terrarium/package.json'));
    const jsr = JSON.parse(read('packages/terrarium/jsr.json'));
    expect(validateVersion(npm, jsr)).toBe(
      JSON.parse(read('.github/release-please-manifest.json'))['.'],
    );
  });
});

test('publication validation uses public manifests without a repository version file', () => {
  const root = new URL('../../../', import.meta.url);
  expect(existsSync(new URL('version.txt', root))).toBe(false);
  expect(existsSync(new URL('package.json', root))).toBe(false);
  const npm = JSON.parse(
    readFileSync(new URL('packages/terrarium/package.json', root), 'utf8'),
  );
  const run = (tag: string) =>
    spawnSync(process.execPath, ['scripts/release.ts'], {
      cwd: new URL('packages/terrarium/', root),
      env: { ...process.env, RELEASE_TAG: tag },
      encoding: 'utf8',
    });
  expect(run(`v${npm.version}`).status).toBe(0);
  const mismatch = run('v999.0.0');
  expect(mismatch.status).not.toBe(0);
  expect(mismatch.stderr).toContain(`Expected tag v${npm.version}`);
});
