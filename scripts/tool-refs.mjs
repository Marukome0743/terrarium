import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateUnmodifiedProvenance } from './latest-guest-resolver.mjs';
import { buildLatest, fixtureFiles } from './latest-guests.mjs';
import { validateBuild } from './latest-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const save = async (file, value) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
};
const api = (endpoint) =>
  JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8' }));
export async function resolveToolRef(input, githubApi, registry) {
  const github = githubApi ?? api;
  const registered =
    registry ?? (await json(path.join(root, 'web/tools.json')));
  const tool = input.tool;
  const config = registered[tool];
  if (!/^[a-z][a-z0-9-]*$/.test(tool ?? '') || !config?.native)
    throw new Error('unregistered native tool');
  const repo =
    input.repository ?? config.repository.replace('https://github.com/', '');
  if (
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repo ?? '')
  )
    throw new Error('invalid repository');
  if (typeof input.ref !== 'string' || !input.ref.trim())
    throw new Error('tool ref required');
  let ref = input.ref;
  let pr;
  const match = ref.match(/^pr-(\d+)$/);
  let commit;
  if (match) {
    const pull = await github(`repos/${repo}/pulls/${match[1]}`);
    ref = `refs/pull/${match[1]}/head`;
    commit = pull.head.sha;
    pr = `https://github.com/${repo}/pull/${match[1]}`;
  } else
    commit = (await github(`repos/${repo}/commits/${encodeURIComponent(ref)}`))
      .sha;
  if (!/^[a-f0-9]{40}$/.test(commit ?? '')) throw new Error('invalid commit');
  const name = input.name ?? `${repo.replace('/', '-')}-${commit.slice(0, 12)}`;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))
    throw new Error('invalid build name');
  const fixture = input.fixture ?? config.fixture;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(fixture ?? ''))
    throw new Error('invalid fixture');
  await fixtureFiles(path.join(root, 'fixtures', fixture));
  return {
    ...input,
    tool,
    repo,
    ref,
    commit,
    name,
    fixture,
    ...(pr && { pr }),
  };
}
export async function stageToolRef(resolved, binaries, site, resolver) {
  const tool = resolved.tool;
  const registered = await json(path.join(root, 'web/tools.json'));
  if (!registered[tool]?.native) throw new Error('unregistered native tool');
  const guest = await readFile(path.join(binaries, tool));
  const info = await readFile(path.join(binaries, `${tool}.json`));
  const provenance = JSON.parse(info);
  const { validateGuestElf } = await import(
    pathToFileURL(path.join(resolver, 'resolver.js')).href
  );
  validateGuestElf(guest);
  if (
    provenance.source?.url !== `https://github.com/${resolved.repo}` ||
    provenance.source?.ref !== resolved.ref ||
    provenance.source?.commit !== resolved.commit
  )
    throw new Error('tool source identity mismatch');
  const fixtureNames = [
    ...new Set([registered[tool].fixture, resolved.fixture]),
  ];
  const fixtures = {};
  for (const name of fixtureNames)
    fixtures[name] = Buffer.from(
      `${JSON.stringify(await fixtureFiles(path.join(root, 'fixtures', name)))}\n`,
    );
  // Hash the actual published metadata, including the selection name.
  const adapted = { ...provenance, ref: resolved.name };
  const adaptedInfo = Buffer.from(`${JSON.stringify(adapted)}\n`);
  const dir = `dist/${tool}/${sha(Buffer.concat([guest, adaptedInfo, ...Object.values(fixtures)]))}`;
  const asset = (name, bytes) => ({
    url: `${dir}/${name}`,
    sha256: sha(bytes),
  });
  const build = {
    schemaVersion: 1,
    tool,
    ref: resolved.name,
    source: provenance.source,
    built_at: provenance.built_at,
    guest: { ...asset('guest', guest), format: 'static-musl-x86_64' },
    buildInfo: asset('build-info.json', adaptedInfo),
    fixtures: Object.fromEntries(
      Object.entries(fixtures).map(([name, bytes]) => [
        name,
        asset(`fixture-${name}.json`, bytes),
      ]),
    ),
    upstream_pr: resolved.pr ?? null,
  };
  validateBuild(build, {
    tool,
    ref: resolved.name,
    base: 'https://stage.invalid/web/',
  });
  validateUnmodifiedProvenance(adapted, build);
  const catalogue = await json(path.join(site, 'dist/builds.json'));
  const tools = await json(path.join(site, 'tools.json'));
  if (tools[tool]?.default === resolved.name)
    throw new Error('source ref cannot replace the latest default');
  if (!catalogue.builds[tool]) throw new Error('missing tool catalogue');
  if (
    catalogue.builds[tool][resolved.name]?.source?.commit &&
    catalogue.builds[tool][resolved.name].source.url !== build.source.url
  )
    throw new Error('tool build name repository collision');
  await mkdir(path.join(site, dir), { recursive: true });
  for (const [name, bytes] of [
    ['guest', guest],
    ['build-info.json', adaptedInfo],
    ...Object.entries(fixtures).map(([name, bytes]) => [
      `fixture-${name}.json`,
      bytes,
    ]),
  ])
    await writeFile(path.join(site, dir, name), bytes);

  catalogue.builds[tool][resolved.name] = build;
  await save(path.join(site, 'dist/builds.json'), catalogue);
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [mode, inputFile, ...args] = process.argv.slice(2);
  if (mode === 'resolve') {
    const config = await json(inputFile);
    if (process.env.TOOL_REF)
      config.refs.push({
        tool: process.env.REF_TOOL,
        ...(process.env.REF_REPOSITORY && {
          repository: process.env.REF_REPOSITORY,
        }),
        ref: process.env.TOOL_REF,
      });
    const refs = [];
    const names = new Set();
    for (const input of config.refs) {
      const resolved = await resolveToolRef(input);
      if (names.has(`${resolved.tool}:${resolved.name}`))
        throw new Error('duplicate tool build name');
      names.add(`${resolved.tool}:${resolved.name}`);
      refs.push(resolved);
    }
    await save(args[0], { refs });
    console.log(
      JSON.stringify({
        include: refs.map(({ tool, name, commit }) => ({ tool, name, commit })),
      }),
    );
  } else if (mode === 'build') {
    const [tool, name, binaries, resolver, latestFile] = args;
    const { refs } = await json(inputFile);
    const resolved = refs.find((ref) => ref.tool === tool && ref.name === name);
    if (!resolved) throw new Error('unknown tool build');
    const tools = { [tool]: resolved };
    const registered = await json(path.join(root, 'web/tools.json'));
    if (registered[tool].native.ui) {
      if (!latestFile)
        throw new Error('UI build requires resolved latest build dependencies');
      tools.aube = (await json(latestFile)).tools.aube;
    }
    await buildLatest(
      { schemaVersion: 1, tools },
      path.resolve(binaries),
      path.resolve(resolver),
    );
  } else if (mode === 'stage') {
    const [binaries, site, resolver] = args;
    const { refs } = await json(inputFile);
    for (const resolved of refs)
      await stageToolRef(
        resolved,
        path.resolve(binaries, `tool-ref-${resolved.tool}-${resolved.name}`),
        path.resolve(site),
        path.resolve(resolver),
      );
    await save(path.join(site, 'tool-ref-resolutions.json'), { refs });
  } else
    throw new Error(
      'usage: tool-refs.mjs <resolve|build|stage> <resolutions/config> <arguments>',
    );
}
