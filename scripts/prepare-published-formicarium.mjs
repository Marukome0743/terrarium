import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  descriptorAt,
  INPUT_ROOT,
  prepareInputs,
  ROOT,
  verifyInputs,
} from './prepare-formicarium.mjs';

const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index].slice(2);
  if (
    !['from', 'archive', 'url', 'output'].includes(key) ||
    !process.argv[index + 1] ||
    key in options
  )
    throw new Error(
      'expected --from, --archive or --url and optional --output',
    );
  options[key] = process.argv[index + 1];
}
const output = options.output ?? INPUT_ROOT;
if ([options.from, options.archive, options.url].filter(Boolean).length !== 1)
  throw new Error('provide exactly one input source');
// Accept already upgraded inputs only after matching the complete fixed identity.
let prepared;
if (options.from) {
  try {
    prepared = await verifyInputs(options.from);
  } catch {
    /* Check the pinned source below. */
  }
}
if (prepared) {
  console.log(
    JSON.stringify(await prepareInputs({ from: options.from, output })),
  );
} else {
  const work = await mkdtemp(
    path.join(tmpdir(), 'terrarium-published-inputs-'),
  );
  try {
    const sourceDescriptor = path.join(
      ROOT,
      'integration/formicarium-source-inputs.json',
    );
    const source = path.join(work, 'source');
    await prepareInputs({
      ...options,
      output: source,
      descriptor: await descriptorAt(sourceDescriptor),
    });
    const upgraded = path.join(work, 'upgraded');
    execFileSync(
      process.execPath,
      [
        path.join(ROOT, 'scripts/prepare-formicarium-rc-inputs.mjs'),
        '--from',
        source,
        '--descriptor',
        sourceDescriptor,
        '--output',
        upgraded,
      ],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
    console.log(
      JSON.stringify(await prepareInputs({ from: upgraded, output })),
    );
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
