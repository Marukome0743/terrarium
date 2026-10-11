import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSession } from '../packages/terrarium/node_modules/@aletheia-works/formicarium/runtime/node/api.js';

const site = path.resolve(process.argv[2], 'web');
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const { refs } = await json(path.join(site, 'tool-ref-resolutions.json'));
const tools = await json(path.join(site, 'tools.json'));
const { builds } = await json(path.join(site, 'dist/builds.json'));
const { convertFixture } = await import(
  pathToFileURL(path.join(site, 'formicarium-guest-distribution/fixtures.js'))
    .href
);
for (const resolved of refs) {
  const build = builds[resolved.tool][resolved.name];
  if (
    build.source.commit !== resolved.commit ||
    build.source.ref !== resolved.ref ||
    build.source.url !== `https://github.com/${resolved.repo}`
  )
    throw new Error('source ref identity mismatch');
  const guest = await readFile(path.join(site, build.guest.url));
  const cwd = tools[resolved.tool].cwd ?? '/work';
  const entries = convertFixture(
    await json(path.join(site, build.fixtures[resolved.fixture].url)),
    { cwd },
  );
  const s = await createSession({ cwd: '/work', entries });
  try {
    await s.setCwd(cwd);
    const version = await s.run({
      guest,
      args: ['--version'],
      timeoutMs: 600_000,
    });
    if (version.exitCode !== 0)
      throw new Error('tool source version execution failed');
    const output = new TextDecoder().decode(version.stdout).trim();
    if (!output) throw new Error('empty source version output');
    console.log(
      `${resolved.tool}/${resolved.name} ${resolved.repo}@${resolved.ref} ${resolved.commit}: ${output}`,
    );
    if (resolved.tool === 'biome' && resolved.expected) {
      const result = await s.run({
        guest,
        args: ['migrate', 'prettier', '--write'],
        timeoutMs: 600_000,
      });
      if (result.exitCode !== 0)
        throw new Error(new TextDecoder().decode(result.stderr));
      const config = JSON.parse(
        new TextDecoder().decode(await s.readFile(`${cwd}/biome.json`)),
      );
      for (const [key, value] of Object.entries(resolved.expected))
        if (config.javascript?.formatter?.[key] !== value)
          throw new Error(`Biome migration mismatch: ${resolved.name} ${key}`);
      console.log(
        `${resolved.repo}@${resolved.ref} ${resolved.commit}: ${JSON.stringify(config.javascript.formatter)}`,
      );
    }
  } finally {
    await s.dispose();
  }
}
