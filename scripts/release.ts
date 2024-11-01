import { exec } from 'child_process';
import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import semver from 'semver';

import { name as packageName, version as localVersion } from '../package.json';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import { confirmPrompt } from '../lib/prompts/promptUtils';

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

function getCommandOutput(command: string): Promise<string> {
  return new Promise(resolve => {
    exec(command, (err, stdout) => {
      if (err) {
        logger.error(err);
        process.exit(EXIT_CODES.ERROR);
      }
      resolve(stdout.trim());
    });
  });
}

function getGitBranch(): Promise<string> {
  return getCommandOutput('git rev-parse --abbrev-ref HEAD');
}

async function getDistTags(): Promise<DistTags> {
  const distTags = await getCommandOutput(
    `npm view ${packageName} dist-tags --json`
  );
  return JSON.parse(distTags) as DistTags;
}

async function cleanup(oldVersion: string, newVersion: string): Promise<void> {
  await exec(`yarn version --new-version ${oldVersion}`);
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

  console.log(`Current version: ${currentVersion}`);
  console.log(`New version to release: ${newVersion}`);

  const shouldRelease = confirmPrompt(
    `Release version ${newVersion} on tag ${tag}?`
  );

  if (!shouldRelease) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  await exec(`yarn version --new-version ${newVersion}`);
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
