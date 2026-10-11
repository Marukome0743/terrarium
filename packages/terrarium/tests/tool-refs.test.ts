import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveToolRef, stageToolRef } from '../../../scripts/tool-refs.mjs';

const commit = 'a'.repeat(40);
test('fork branches and commits resolve without changing source identity', async () => {
  for (const ref of ['fix/migrate-prettier-default-semi-quotes', commit]) {
    const result = await resolveToolRef(
      { tool: 'biome', repository: 'JamBalaya56562/biome', ref },
      async (endpoint) => {
        expect(endpoint).toBe(
          `repos/JamBalaya56562/biome/commits/${encodeURIComponent(ref)}`,
        );
        return { sha: commit };
      },
    );
    expect(result).toMatchObject({ repo: 'JamBalaya56562/biome', ref, commit });
  }
});
test('PR source resolves its head in the requested repository', async () => {
  const result = await resolveToolRef(
    { tool: 'biome', repository: 'biomejs/biome', ref: 'pr-123' },
    async (endpoint) => {
      expect(endpoint).toBe('repos/biomejs/biome/pulls/123');
      return { head: { sha: commit } };
    },
  );
  expect(result).toMatchObject({
    ref: 'refs/pull/123/head',
    commit,
    pr: 'https://github.com/biomejs/biome/pull/123',
  });
});
test('unsafe repositories, labels and invalid commits fail before build', async () => {
  for (const input of [
    { tool: 'biome', repository: '../biome', ref: 'main' },
    { tool: 'biome', repository: 'biomejs/biome', ref: 'main', name: '../bad' },
    { tool: 'biome', repository: 'biomejs/biome', ref: '' },
  ])
    await expect(
      resolveToolRef(input, async () => ({ sha: commit })),
    ).rejects.toThrow();
  await expect(
    resolveToolRef(
      { tool: 'biome', repository: 'biomejs/biome', ref: 'main' },
      async () => ({
        sha: 'invalid',
      }),
    ),
  ).rejects.toThrow('invalid commit');
});

for (const tool of ['aube', 'pitchfork', 'biome']) {
  test(`${tool} source selections retain independent metadata and the stable default`, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), `${tool}-alias-`));
    try {
      const guest = Buffer.alloc(120);
      guest.set([127, 69, 76, 70, 2, 1, 1]);
      guest.writeUInt16LE(2, 16);
      guest.writeUInt16LE(62, 18);
      guest.writeUInt32LE(1, 20);
      guest.writeBigUInt64LE(64n, 32);
      guest.writeUInt16LE(64, 52);
      guest.writeUInt16LE(56, 54);
      guest.writeUInt16LE(1, 56);
      guest.writeUInt32LE(1, 64);
      const source = {
        type: 'git-unmodified',
        url: `https://github.com/owner/${tool}`,
        ref: 'main',
        commit,
      };
      await writeFile(path.join(directory, tool), guest);
      await writeFile(
        path.join(directory, `${tool}.json`),
        JSON.stringify({
          schemaVersion: 1,
          tool,
          ref: 'main',
          source,
          built_at: '2026-10-10T00:00:00Z',
          target: 'x86_64-unknown-linux-musl',
          linkage: 'static',
          libc: 'musl',
          sourcePatches: [],
        }),
      );
      await mkdir(path.join(directory, 'dist'));
      await writeFile(
        path.join(directory, 'tools.json'),
        JSON.stringify({ [tool]: { default: 'stable' } }),
      );
      await writeFile(
        path.join(directory, 'dist/builds.json'),
        JSON.stringify({ builds: { [tool]: {} } }),
      );
      const resolver = path.resolve(
        import.meta.dir,
        '../../../.vendor/formicarium-inputs/resolver',
      );
      for (const name of ['first', 'second']) {
        const resolved = await resolveToolRef(
          {
            tool,
            repository: `owner/${tool}`,
            ref: 'main',
            name,
            fixture: 'biome-migrate-prettier',
          },
          async () => ({ sha: commit }),
        );
        await stageToolRef(resolved, directory, directory, resolver);
      }
      const catalogue = JSON.parse(
        await readFile(path.join(directory, 'dist/builds.json'), 'utf8'),
      );
      const builds = catalogue.builds[tool];
      expect(
        JSON.parse(await readFile(path.join(directory, 'tools.json'), 'utf8'))[
          tool
        ].default,
      ).toBe('stable');
      expect(builds.first.fixtures['biome-migrate-prettier']).toBeDefined();
      expect(builds.first.buildInfo.url).not.toBe(builds.second.buildInfo.url);
      for (const name of ['first', 'second']) {
        const bytes = await readFile(
          path.join(directory, builds[name].buildInfo.url),
        );
        expect(JSON.parse(bytes.toString()).ref).toBe(name);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(
          builds[name].buildInfo.sha256,
        );
      }
      const before = await readFile(
        path.join(directory, 'dist/builds.json'),
        'utf8',
      );
      await expect(
        stageToolRef(
          {
            tool,
            repo: `owner/${tool}`,
            ref: 'main',
            commit,
            name: 'stable',
            fixture: 'biome-migrate-prettier',
          },
          directory,
          directory,
          resolver,
        ),
      ).rejects.toThrow('cannot replace the latest default');
      await expect(
        stageToolRef(
          {
            tool,
            repo: `other/${tool}`,
            ref: 'main',
            commit,
            name: 'first',
            fixture: 'biome-migrate-prettier',
          },
          directory,
          directory,
          resolver,
        ),
      ).rejects.toThrow('source identity mismatch');
      expect(
        await readFile(path.join(directory, 'dist/builds.json'), 'utf8'),
      ).toBe(before);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

for (const tool of ['aube', 'pitchfork', 'biome']) {
  for (const ref of ['fix/branch', 'b'.repeat(40), 'pr-42']) {
    test(`${tool} resolves a fork ${ref} to its exact source identity`, async () => {
      const calls: string[] = [];
      const resolved = await resolveToolRef(
        { tool, repository: `owner/custom-${tool}`, ref },
        async (endpoint) => {
          calls.push(endpoint);
          return endpoint.includes('/pulls/')
            ? { head: { sha: commit } }
            : { sha: commit };
        },
      );
      expect(resolved).toMatchObject({
        tool,
        repo: `owner/custom-${tool}`,
        commit,
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toContain(
        ref === 'pr-42' ? '/pulls/42' : encodeURIComponent(ref),
      );
      if (ref === 'pr-42')
        expect(resolved.pr).toBe(
          `https://github.com/owner/custom-${tool}/pull/42`,
        );
    });
  }
}
test('a newly registered Cargo CLI uses the same ref resolver without a repository-name special case', async () => {
  const resolved = await resolveToolRef(
    { tool: 'future', ref: 'main' },
    async () => ({ sha: commit }),
    {
      future: {
        repository: 'https://github.com/owner/arbitrary-repository',
        fixture: 'aube-local-deps',
        native: { kind: 'cargo', binary: 'future' },
      },
    },
  );
  expect(resolved).toMatchObject({
    tool: 'future',
    repo: 'owner/arbitrary-repository',
    commit,
    fixture: 'aube-local-deps',
  });
  await expect(
    resolveToolRef({ tool: 'unknown', ref: 'main' }),
  ).rejects.toThrow('unregistered');
});
