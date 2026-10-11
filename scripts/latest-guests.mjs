import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateUnmodifiedProvenance } from './latest-guest-resolver.mjs';
import { validateBuild } from './latest-manifest.mjs';
import { archiveFiles } from './prepare-formicarium.mjs';

export function releaseVersion(ref) {
  return ref.match(/^(?:v|@biomejs\/biome@)?(\d+\.\d+\.\d+)$/)?.[1];
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const load = async (filename) => JSON.parse(await readFile(filename, 'utf8'));
const save = async (filename, value) => {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`);
};
const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: 'inherit', ...options });
const github = (endpoint) =>
  JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8' }));

/** Resolve every registered tool once; the resulting commits are build inputs. */
export async function resolveLatest(tools, api = github) {
  const resolutions = {};
  for (const [tool, config] of Object.entries(tools)) {
    if (!/^[a-z][a-z0-9-]*$/.test(tool)) throw new Error('invalid tool name');
    const repo = config.repository?.match(
      /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/,
    )?.[1];
    if (!repo) throw new Error(`invalid repository: ${tool}`);
    const release = await api(`repos/${repo}/releases/latest`);
    const ref = release.tag_name;
    if (release.draft || release.prerelease || !releaseVersion(ref))
      throw new Error(`invalid latest stable release: ${tool}`);
    const { sha: commit } = await api(
      `repos/${repo}/commits/${encodeURIComponent(ref)}`,
    );
    if (!/^[0-9a-f]{40}$/.test(commit))
      throw new Error('invalid source commit');
    const names = new Set([
      `${tool}-${ref}-x86_64-unknown-linux-musl.tar.gz`,
      `${tool}-x86_64-unknown-linux-musl.tar.gz`,
      ...(tool === 'biome' ? ['biome-linux-x64-musl'] : []),
    ]);
    const assets = (release.assets ?? []).filter((asset) =>
      names.has(asset.name),
    );
    if (assets.length > 1)
      throw new Error(`ambiguous musl release asset: ${tool}`);
    const asset = assets[0];
    const releaseAsset = asset && {
      name: asset.name,
      url: asset.browser_download_url,
      sha256: asset.digest?.match(/^sha256:([0-9a-f]{64})$/)?.[1],
      size: asset.size,
      ...(tool === 'biome' && { format: 'binary' }),
    };
    if (
      releaseAsset &&
      (!releaseAsset.sha256 ||
        decodeURIComponent(releaseAsset.url) !==
          `https://github.com/${repo}/releases/download/${ref}/${releaseAsset.name}` ||
        !Number.isSafeInteger(releaseAsset.size) ||
        releaseAsset.size <= 0)
    )
      throw new Error(`invalid release asset identity: ${tool}`);
    resolutions[tool] = {
      repo,
      ref,
      commit,
      ...(releaseAsset && { releaseAsset }),
    };
  }
  if (!Object.keys(resolutions).length) throw new Error('no registered tools');
  return { schemaVersion: 1, tools: resolutions };
}

/** Reject an old catalogue even if its assets and provenance are valid. */
export function validateLatest(tools, builds, resolutions, registered) {
  const wanted = Object.keys(registered).sort();
  if (
    resolutions.schemaVersion !== 1 ||
    JSON.stringify(Object.keys(resolutions.tools).sort()) !==
      JSON.stringify(wanted) ||
    JSON.stringify(Object.keys(tools).sort()) !== JSON.stringify(wanted) ||
    JSON.stringify(Object.keys(builds.builds).sort()) !== JSON.stringify(wanted)
  )
    throw new Error('latest tool coverage mismatch');
  for (const tool of wanted) {
    const { repo, ref, commit } = resolutions.tools[tool];
    const build = builds.builds[tool]?.[ref];
    if (
      !releaseVersion(ref) ||
      !/^[0-9a-f]{40}$/.test(commit) ||
      registered[tool].repository !== `https://github.com/${repo}` ||
      tools[tool].repository !== registered[tool].repository ||
      tools[tool].default !== ref ||
      build?.ref !== ref ||
      build?.source?.ref !== ref ||
      build?.source?.commit !== commit ||
      build?.source?.url !== registered[tool].repository
    )
      throw new Error(`latest source mismatch: ${tool}`);
  }
}

export async function fixtureFiles(directory, prefix = '') {
  const result = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory())
      Object.assign(
        result,
        await fixtureFiles(path.join(directory, entry.name), `${relative}/`),
      );
    else if (entry.isFile())
      result[relative] = await readFile(
        path.join(directory, entry.name),
        'utf8',
      );
    else throw new Error(`unsupported fixture entry: ${relative}`);
  }
  return result;
}

export async function stageLatest({
  resolutions,
  binaries,
  destination,
  resolverRoot,
}) {
  const registered = await load(path.join(root, 'web/tools.json'));
  const { validateGuestElf } = await import(
    pathToFileURL(path.join(resolverRoot, 'resolver.js')).href
  );
  const tools = {};
  const builds = { builds: {} };
  for (const [tool, config] of Object.entries(registered)) {
    const resolved = resolutions.tools[tool];
    if (!resolved) throw new Error(`missing resolution: ${tool}`);
    const guest = await readFile(path.join(binaries, tool));
    validateGuestElf(guest);
    const info = await readFile(path.join(binaries, `${tool}.json`));
    const provenance = JSON.parse(info);
    if (
      resolved.releaseAsset &&
      (provenance.provenanceKind !== 'upstream-release' ||
        JSON.stringify(provenance.releaseAsset) !==
          JSON.stringify(resolved.releaseAsset))
    )
      throw new Error(`release asset provenance mismatch: ${tool}`);
    const fixture = Buffer.from(
      `${JSON.stringify(await fixtureFiles(path.join(root, 'fixtures', config.fixture)), null, 2)}\n`,
    );
    const directory = `dist/${tool}/${hash(Buffer.concat([guest, info, fixture]))}`;
    const asset = (name, bytes) => ({
      url: `${directory}/${name}`,
      sha256: hash(bytes),
    });
    const build = {
      schemaVersion: 1,
      tool,
      ref: resolved.ref,
      source: {
        type: 'git-unmodified',
        url: config.repository,
        ref: resolved.ref,
        commit: resolved.commit,
      },
      built_at: provenance.built_at,
      guest: { ...asset('guest', guest), format: 'static-musl-x86_64' },
      buildInfo: asset('build-info.json', info),
      fixtures: { [config.fixture]: asset('fixture.json', fixture) },
    };
    validateBuild(build, {
      tool,
      ref: resolved.ref,
      base: 'https://stage.invalid/web/',
    });
    validateUnmodifiedProvenance(provenance, build);
    tools[tool] = { ...config, default: resolved.ref };
    builds.builds[tool] = { [resolved.ref]: build };
    await mkdir(path.join(destination, directory), { recursive: true });
    for (const [name, bytes] of [
      ['guest', guest],
      ['build-info.json', info],
      ['fixture.json', fixture],
    ])
      await writeFile(path.join(destination, directory, name), bytes);
  }
  validateLatest(tools, builds, resolutions, registered);
  await save(path.join(destination, 'tools.json'), tools);
  await save(path.join(destination, 'dist/builds.json'), builds);
  await save(path.join(destination, 'latest-resolutions.json'), resolutions);
}

/** Verify the publisher archive before accepting its one executable. */
export function releaseBinary(archive, tool, asset) {
  if (archive.length !== asset.size || hash(archive) !== asset.sha256)
    throw new Error(`release archive digest/size mismatch: ${tool}`);
  if (asset.format === 'binary') return archive;
  const candidates = [...archiveFiles(archive, { ignoreLinks: true })].filter(
    ([name]) => path.posix.basename(name) === tool,
  );
  if (candidates.length !== 1)
    throw new Error(`expected one release executable: ${tool}`);
  return candidates[0][1];
}

export async function buildLatest(resolutions, destination, resolverRoot) {
  // Setup installs build tools explicitly; never install unrelated project tools.
  process.env.MISE_AUTO_INSTALL = '0';
  for (const [tool, resolved] of Object.entries(resolutions.tools)) {
    if (
      !resolved.releaseAsset &&
      !['aube', 'pitchfork', 'biome'].includes(tool)
    )
      throw new Error(`no native guest builder: ${tool}`);
  }
  const { validateGuestElf } = await import(
    pathToFileURL(path.join(resolverRoot, 'resolver.js')).href
  );
  if (resolutions.tools.pitchfork && !resolutions.tools.pitchfork.releaseAsset)
    run('mise', ['install', 'node@24.21.0'], { cwd: root });
  await mkdir(destination, { recursive: true });
  const ordered = Object.keys(resolutions.tools).sort((a, b) =>
    a === 'aube' ? -1 : b === 'aube' ? 1 : a.localeCompare(b),
  );
  for (const tool of ordered) {
    const resolved = resolutions.tools[tool];
    const source = path.join(destination, `source-${tool}-${resolved.commit}`);
    const archive = path.join(destination, `${tool}.tar.gz`);
    const info = {
      schemaVersion: 1,
      tool,
      ref: resolved.ref,
      source: {
        type: 'git-unmodified',
        url: `https://github.com/${resolved.repo}`,
        ref: resolved.ref,
        commit: resolved.commit,
      },
      built_at: new Date().toISOString(),
      target: 'x86_64-unknown-linux-musl',
      linkage: 'static',
      libc: 'musl',
      sourcePatches: [],
    };
    if (resolved.releaseAsset) {
      run('curl', [
        '--fail',
        '--location',
        '--retry',
        '3',
        resolved.releaseAsset.url,
        '-o',
        archive,
      ]);
      const binary = releaseBinary(
        await readFile(archive),
        tool,
        resolved.releaseAsset,
      );
      validateGuestElf(binary);
      await writeFile(path.join(destination, tool), binary, { mode: 0o755 });
      info.provenanceKind = 'upstream-release';
      info.releaseAsset = resolved.releaseAsset;
      info.timestampMeaning = 'local release import time';
    } else {
      await mkdir(source, { recursive: true });
      run('curl', [
        '--fail',
        '--location',
        '--retry',
        '3',
        `https://codeload.github.com/${resolved.repo}/tar.gz/${resolved.commit}`,
        '-o',
        archive,
      ]);
      run('tar', ['-xzf', archive, '--strip-components=1', '-C', source]);
      run('bash', [
        path.join(root, 'mise-tasks/build/native.sh'),
        tool,
        source,
        destination,
      ]);
      validateGuestElf(await readFile(path.join(destination, tool)));
      info.provenanceKind = 'source-build';
      info.rustc = execFileSync(
        'mise',
        ['exec', 'rust', '--', 'rustc', '--version'],
        {
          cwd: root,
          encoding: 'utf8',
        },
      ).trim();
      if (tool === 'pitchfork') {
        info.ui_node = execFileSync(
          'mise',
          ['exec', 'node@24.21.0', '--', 'node', '--version'],
          { cwd: root, encoding: 'utf8' },
        ).trim();
        info.ui_index_sha256 = hash(
          await readFile(path.join(source, 'ui/dist/index.html')),
        );
      }
    }
    await save(path.join(destination, `${tool}.json`), info);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [verb, filename, destination, resolverRoot] = process.argv.slice(2);
  if (verb === 'resolve' && filename)
    await save(
      filename,
      await resolveLatest(await load(path.join(root, 'web/tools.json'))),
    );
  else if (verb === 'build' && filename && destination)
    await buildLatest(
      await load(filename),
      path.resolve(destination),
      path.resolve(
        resolverRoot ?? path.join(root, '.vendor/formicarium-inputs/resolver'),
      ),
    );
  else if (verb === 'verify' && filename && destination)
    validateLatest(
      await load(path.join(destination, 'tools.json')),
      await load(path.join(destination, 'dist/builds.json')),
      await load(filename),
      await load(path.join(root, 'web/tools.json')),
    );
  else if (verb === 'stage' && filename && destination && resolverRoot)
    await stageLatest({
      resolutions: await load(filename),
      binaries: path.dirname(path.resolve(filename)),
      destination: path.resolve(destination),
      resolverRoot: path.resolve(resolverRoot),
    });
  else
    throw new Error(
      'usage: latest-guests.mjs resolve <resolutions.json> | build <resolutions.json> <binaries> [resolver] | verify <resolutions.json> <site> | stage <binaries/resolutions.json> <site> <resolver>',
    );
}
