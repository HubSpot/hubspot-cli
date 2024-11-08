import { exec as _exec, spawn } from 'child_process';
import { promisify } from 'util';
import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import { logger, setLogLevel, LOG_LEVEL } from '@hubspot/local-dev-lib/logger';
import semver from 'semver';

import { name as packageName, version as localVersion } from '../package.json';
import { EXIT_CODES } from '../lib/enums/exitCodes';
import { build } from './build';

// TODO: Change to import when this is converted to TS
const { uiLink, uiLine } = require('../lib/ui');
const { confirmPrompt } = require('../lib/prompts/promptUtils');

const exec = promisify(_exec);

const MAIN_BRANCH = 'main';

const TAG = {
  LATEST: 'latest',
  NEXT: 'next',
  EXPERIMENTAL: 'experimental',
} as const;

const INCREMENT = {
  PATCH: 'patch',
  MINOR: 'minor',
  MAJOR: 'major',
  PRERELEASE: 'prerelease',
} as const;

const VERSION_INCREMENT_OPTIONS = [
  INCREMENT.PATCH,
  INCREMENT.MINOR,
  INCREMENT.MAJOR,
  INCREMENT.PRERELEASE,
] as const;
const TAG_OPTIONS = [TAG.LATEST, TAG.NEXT, TAG.EXPERIMENTAL] as const;

const PRERELEASE_IDENTIFIER = {
  NEXT: 'beta',
  EXPERIMENTAL: 'experimental',
} as const;

type ReleaseArguments = {
  versionIncrement: typeof VERSION_INCREMENT_OPTIONS[number];
  tag: typeof TAG_OPTIONS[number];
  dryRun?: boolean;
};

type DistTags = {
  [TAG.LATEST]: string;
  [TAG.NEXT]: string;
  [TAG.EXPERIMENTAL]: string;
};

type Tag = typeof TAG_OPTIONS[number];

async function getGitBranch(): Promise<string> {
  const { stdout } = await exec('git rev-parse --abbrev-ref HEAD');
  return stdout.trim();
}

async function getDistTags(): Promise<DistTags> {
  const { stdout } = await exec(`npm view ${packageName} dist-tags --json`);
  const distTags = stdout.trim();
  return JSON.parse(distTags) as DistTags;
}

async function cleanup(newVersion: string): Promise<void> {
  await exec(`git reset HEAD~`);
  await exec(`git checkout .`);
  await exec(`git tag -d v${newVersion}`);
}

async function publish(tag: Tag, isDryRun: boolean): Promise<void> {
  logger.log();
  logger.log(`Publishing to ${tag}...`);
  uiLine();
  logger.log();

  const commandArgs = ['publish', '--tag', tag];

  if (isDryRun) {
    commandArgs.push('--dry-run');
  }

  return new Promise((resolve, reject) => {
    const childProcess = spawn('npm', commandArgs, {
      stdio: 'inherit',
      cwd: './dist',
    });

    childProcess.on('close', code => {
      if (code !== EXIT_CODES.SUCCESS) {
        reject();
      } else {
        resolve();
      }
    });
  });
}

async function handler({
  versionIncrement,
  tag,
  dryRun,
}: ArgumentsCamelCase<ReleaseArguments>): Promise<void> {
  setLogLevel(LOG_LEVEL.LOG);

  const branch = await getGitBranch();

  const isExperimental = tag === TAG.EXPERIMENTAL;
  const isDryRun = Boolean(dryRun);

  if (isExperimental && branch === MAIN_BRANCH) {
    logger.error(
      'Releases to experimental tag cannot be published from the main branch'
    );
    process.exit(EXIT_CODES.ERROR);
  } else if (!isExperimental && branch !== MAIN_BRANCH) {
    logger.error(
      'Releases to latest and next tags can only be published from the main branch'
    );
    process.exit(EXIT_CODES.ERROR);
  }

  if (tag === TAG.LATEST && versionIncrement === INCREMENT.PRERELEASE) {
    logger.error(
      'Invalid release: cannot increment prerelease number on latest tag.'
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const {
    next: currentNextTag,
    experimental: currentExperimentalTag,
  } = await getDistTags();

  if (!isExperimental && currentNextTag !== localVersion) {
    logger.error(
      `Local package.json version ${localVersion} is out of sync with published version ${currentNextTag}`
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const currentVersion = isExperimental ? currentExperimentalTag : localVersion;
  const prereleaseIdentifier = isExperimental
    ? PRERELEASE_IDENTIFIER.EXPERIMENTAL
    : PRERELEASE_IDENTIFIER.NEXT;
  const incrementType =
    tag === TAG.LATEST || versionIncrement === INCREMENT.PRERELEASE
      ? versionIncrement
      : (`pre${versionIncrement}` as const);

  const newVersion = semver.inc(
    currentVersion,
    incrementType,
    prereleaseIdentifier
  );

  if (!newVersion) {
    logger.error('Error incrementing version.');
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log();
  logger.log(`Current version: ${currentVersion}`);
  logger.log(`New version to release: ${newVersion}`);

  const shouldRelease = await confirmPrompt(
    `Release version ${newVersion} on tag ${tag}?`
  );

  if (!shouldRelease) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  if (
    tag === TAG.LATEST &&
    !localVersion.includes(PRERELEASE_IDENTIFIER.NEXT)
  ) {
    logger.log();
    const proceedWithoutBetaRelease = await confirmPrompt(
      `The current changes have not yet been released in beta. It's recommended to release and test all changes on the ${TAG.NEXT} tag before releasing them to ${TAG.LATEST}. Are you sure you want to proceed?`,
      false
    );

    if (!proceedWithoutBetaRelease) {
      logger.log();
      logger.log(
        `To release your changes on the next tag, run \`yarn release -v=${versionIncrement} -t=next\``
      );
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  logger.log();
  logger.log(`Updating version to ${newVersion}...`);
  await exec(`yarn version --new-version ${newVersion}`);
  logger.success('Version updated successfully');

  logger.log();
  logger.log('Creating a new build...');
  await build();
  logger.success('Build successful');

  try {
    await publish(tag, isDryRun);

    if (tag === TAG.LATEST) {
      await publish(TAG.NEXT, isDryRun);
    }
  } catch (e) {
    logger.error(
      'An error occurred while releasing the CLI. Correct the error and re-run `yarn build`.'
    );
    await cleanup(newVersion);
    process.exit(EXIT_CODES.ERROR);
  }

  if (isDryRun) {
    await cleanup(newVersion);
    logger.log();
    logger.success('Dry run release finished successfully');
    process.exit(EXIT_CODES.SUCCESS);
  }

  logger.log();
  logger.log(`Pushing changes to Github...`);
  await exec(`git push --atomic origin ${branch} v${newVersion}`);
  logger.log(`Changes pushed successfully`);

  logger.log();
  logger.success(`HubSpot CLI version ${newVersion} published successfully`);
  logger.log(
    uiLink(
      'View on npm',
      'https://www.npmjs.com/package/@hubspot/cli?activeTab=versions'
    )
  );
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
    dryRun: {
      alias: 'd',
      describe: 'Run through the publish process without actually publishing',
      type: 'boolean',
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