import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { GitHub, Manifest } from 'release-please';
import { parseConventionalCommits } from 'release-please/build/src/commit.js';
import { FileNotFoundError } from 'release-please/build/src/errors/index.js';
import { buildStrategy } from 'release-please/build/src/factory.js';
import { TagName } from 'release-please/build/src/util/tag-name.js';
import { Version } from 'release-please/build/src/version.js';

const read = (path: string) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const config = JSON.parse(read('.github/release-please-config.json'));
const manifestPath = '.github/release-please-manifest.json';
const versions = JSON.parse(read(manifestPath));
const version = versions['.'] as string;
const { major, minor, patch } = Version.parse(version);
const patchVersion = `${major}.${minor}.${patch + 1}`;
const minorVersion = `${major}.${minor + 1}.0`;
const baseline = config['bootstrap-sha'];
const merge = 'b'.repeat(40);
const commit = {
  message: 'fix(docs): correct a page',
  sha: 'a'.repeat(40),
  files: ['docs/src/content/docs/index.mdx'],
};

function client() {
  return {
    repository: { owner: 'aletheia-works', repo: 'terrarium' },
    getFileJson: async (path: string) =>
      path === manifestPath ? versions : JSON.parse(read(path)),
    getFileContentsOnBranch: async (path: string) => {
      if (path === 'version.txt') throw new FileNotFoundError(path);
      const parsedContent = read(path);
      return {
        parsedContent,
        content: Buffer.from(parsedContent).toString('base64'),
      };
    },
    logger: { warn: () => {} },
    findFilesByGlobAndRef: async (path: string) => [path],
    tagIterator: async function* () {
      yield { name: 'terrarium-v0.1.0', sha: 'c'.repeat(40) };
    },
    releaseIterator: async function* () {
      yield { tagName: `v${version}`, sha: baseline, notes: '' };
    },
    mergeCommitIterator: async function* () {
      yield commit;
      yield { message: 'chore: historical release', sha: baseline, files: [] };
    },
  };
}

const load = (github: GitHub) =>
  Manifest.fromManifest(
    github,
    'main',
    '.github/release-please-config.json',
    manifestPath,
  );

for (const [message, expected] of [
  ['fix(docs): correct a page', patchVersion],
  ['fix(terminal): correct a command', patchVersion],
  ['feat(terminal): add a command', minorVersion],
  [
    'feat(terminal)!: change the interface',
    major === 0 ? minorVersion : `${major + 1}.0.0`,
  ],
  ['docs: document a command', undefined],
] as const) {
  test(`release engine: ${message}`, async () => {
    const github = client() as unknown as GitHub;
    const manifest = await load(github);
    const strategy = await buildStrategy({
      ...manifest.repositoryConfig['.']!,
      github,
      path: '.',
      targetBranch: 'main',
    });
    const pr = await strategy.buildReleasePullRequest(
      parseConventionalCommits([{ ...commit, message }]),
      { tag: new TagName(Version.parse(version)), sha: baseline, notes: '' },
    );
    expect(pr?.version?.toString()).toBe(expected);
    if (!pr) return;
    const changes = await GitHub.prototype.buildChangeSet.call(
      github,
      pr.updates,
      'main',
    );
    expect(changes.has('version.txt')).toBe(false);
    expect(changes.has('package.json')).toBe(false);
    expect(changes.has('CHANGELOG.md')).toBe(true);
    for (const path of [
      'packages/terrarium/package.json',
      'packages/terrarium/jsr.json',
    ]) {
      const update = pr.updates.find((entry) => entry.path === path);
      expect(update).toBeDefined();
      expect(JSON.parse(changes.get(path)!.content!).version).toBe(expected);
    }
  });
}

test('one reviewed release PR creates one v-tag on its merge commit', async () => {
  const mock = client();
  const manifest = await load(mock as unknown as GitHub);
  const prs = await manifest.buildPullRequests();
  expect(prs).toHaveLength(1);
  const pr = prs[0]!;
  expect(pr.headRefName).toBe(
    'release-please--branches--main--components--terrarium',
  );
  let content = JSON.stringify(versions);
  for (const update of pr.updates) {
    if (update.path === manifestPath)
      content = update.updater.updateContent(content);
  }
  expect(JSON.parse(content)).toEqual({ '.': patchVersion });
  Object.assign(mock, {
    pullRequestIterator: async function* () {
      yield {
        number: 1,
        title: pr.title.toString(),
        body: pr.body.toString(),
        headBranchName: pr.headRefName,
        baseBranchName: 'main',
        labels: ['autorelease: pending'],
        files: [],
        sha: merge,
      };
    },
  });
  const releases = await manifest.buildReleases();
  expect(releases).toHaveLength(1);
  expect(releases[0]!.tag.toString()).toBe(`v${patchVersion}`);
  expect(releases[0]!.sha).toBe(merge);
});

test('initial rollout uses the manifest baseline without a historical v-tag', async () => {
  const mock = client();
  mock.releaseIterator = async function* () {
    yield { tagName: 'terrarium-v0.1.0', sha: 'c'.repeat(40), notes: '' };
  };
  const manifest = await load(mock as unknown as GitHub);
  const prs = await manifest.buildPullRequests();
  expect(prs).toHaveLength(1);
  expect(prs[0]!.version?.toString()).toBe(patchVersion);
});
