import { exec } from 'child_process';
import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import semver from 'semver';

import { name as packageName, version as localVersion } from '../package.json';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import { confirmPrompt } from '../lib/prompts/promptUtils';
import { build } from './build';

// TODO: Change to import when this is converted to TS
const { uiLink } = require('../lib/ui');

// const BRANCH = {
//   MAIN: 'main',
//   EXPERIMENTAL: 'experimental',
// };

const BRANCH = {
  MAIN: 'improved-release-script',
  EXPERIMENTAL: 'improved-release-script',
} as const;

const TAG = {
  LATEST: 'latest',
  NEXT: 'next',
  EXPERIMENTAL: 'experimental',
} as const;

const VERSION_INCREMENT_OPTIONS = ['patch', 'minor', 'major'] as const;
const TAG_OPTIONS = [TAG.LATEST, TAG.NEXT, TAG.EXPERIMENTAL] as const;

type ReleaseArguments = {
  versionIncrement: typeof VERSION_INCREMENT_OPTIONS[number];
  tag: typeof TAG_OPTIONS[number];
};

type DistTags = {
  [TAG.LATEST]: string;
  [TAG.NEXT]: string;
  [TAG.EXPERIMENTAL]: string;
};

function runCommandAndGetOutput(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout) => {
      if (err) {
        reject(err);
      }
      resolve(stdout.trim());
    });
  });
}

function getGitBranch(): Promise<string> {
  return runCommandAndGetOutput('git rev-parse --abbrev-ref HEAD');
}

async function getDistTags(): Promise<DistTags> {
  const distTags = await runCommandAndGetOutput(
    `npm view ${packageName} dist-tags --json`
  );
  return JSON.parse(distTags) as DistTags;
}

async function cleanup(oldVersion: string, newVersion: string): Promise<void> {
  await exec(`yarn version --new-version ${oldVersion} --no-git-tag-version`);
  await exec(`git tag -D v${newVersion}`);
}

async function handler({
  versionIncrement,
  tag,
}: ArgumentsCamelCase<ReleaseArguments>): Promise<void> {
  const branch = await getGitBranch();

  const isExperimental = tag === TAG.EXPERIMENTAL;

  if (isExperimental && branch !== BRANCH.EXPERIMENTAL) {
    logger.error(
      'Releases to experimental tag can only be published from the experimental branch'
    );
    process.exit(EXIT_CODES.ERROR);
  } else if (branch !== BRANCH.MAIN) {
    logger.error(
      'Releases to latest and next tags can only be published from the main branch'
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const {
    next: currentNextTag,
    experimental: currentExperimentalTag,
  } = await getDistTags();

  // if (!isExperimental && currentNextTag !== localVersion) {
  //   logger.error(
  //     `Local package.json version ${localVersion} is out of sync with published version ${currentNextTag}`
  //   );
  //   process.exit(EXIT_CODES.ERROR);
  // }

  const currentVersion = isExperimental ? currentExperimentalTag : localVersion;
  const prereleaseIdentifier = isExperimental ? 'experimental' : 'beta';
  const incrementType =
    tag === TAG.LATEST ? versionIncrement : (`pre${versionIncrement}` as const);

  const newVersion = semver.inc(
    currentVersion,
    incrementType,
    prereleaseIdentifier
  );

  if (!newVersion) {
    logger.error('Error incrementing version.');
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log(`Current version: ${currentVersion}`);
  logger.log(`New version to release: ${newVersion}`);

  const shouldRelease = confirmPrompt(
    `Release version ${newVersion} on tag ${tag}?`
  );

  if (!shouldRelease) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  await exec(`yarn version --new-version ${newVersion}`);
  await build();
  process.chdir('./dist');

  try {
    await runCommandAndGetOutput(`npm publish --tag ${tag}`);
  } catch (e) {
    logger.error(
      'An error occurred while releasing the CLI. Correct the error and re-run `yarn build`.'
    );
    await cleanup(currentVersion, newVersion);
    process.exit(EXIT_CODES.ERROR);
  }

  await exec(`git push --atomic origin main v${newVersion}`);

  logger.success(`HubSpot CLI version ${newVersion} published successfully`);
  logger.log(
    uiLink('https://www.npmjs.com/package/@hubspot/cli?activeTab=versions')
  );

  process.exit(EXIT_CODES.SUCCESS);
}

async function builder(yargs: Argv): Promise<Argv> {
  return yargs.options({
    versionIncrement: {
      alias: 'v',
      demandOption: true,
      describe: 'SemVer increment type for the next release',
      choices: VERSION_INCREMENT_OPTIONS,
    },
    tag: {
      alias: 't',
      demandOption: true,
      describe: 'Tag for the next release',
      choices: TAG_OPTIONS,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-expressions
yargs(process.argv.slice(2))
  .scriptName('yarn')
  .usage('Hubspot CLI release script')
  .command(
    'release',
    'Create a new npm release of the CLI with the specified version and tag',
    builder,
    handler
  )
  .version(false)
  .help().argv;
