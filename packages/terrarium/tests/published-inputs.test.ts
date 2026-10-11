import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const input =
  process.env.FORMICARIUM_INPUTS_ROOT ??
  path.join(root, '.vendor/formicarium-inputs');
const script = path.join(root, 'scripts/prepare-published-formicarium.mjs');
const prepare = (from: string, output: string) =>
  execFileSync('node', [script, '--from', from, '--output', output], {
    encoding: 'utf8',
    timeout: 30000,
  });

test('published input preparation is idempotent and rejects drift without replacing output', async () => {
  const work = await mkdtemp(path.join(tmpdir(), 'terrarium-published-test-'));
  try {
    const output = path.join(work, 'accepted');
    const first = JSON.parse(prepare(input, output));
    expect(JSON.parse(prepare(input, output))).toEqual(first);
    const manifest = path.join(output, 'package/manifest.json');
    const accepted = await readFile(manifest);
    const corrupt = path.join(work, 'corrupt');
    await cp(input, corrupt, { recursive: true });
    await writeFile(path.join(corrupt, 'resolver/resolver.js'), 'changed');
    expect(() => prepare(corrupt, output)).toThrow();
    expect(await readFile(manifest)).toEqual(accepted);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}, 30000);
