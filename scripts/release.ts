import { exec as _exec, spawn } from 'node:child_process';
import { promisify } from 'util';
import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import { logger, setLogLevel, LOG_LEVEL } from '@hubspot/local-dev-lib/logger';
import semver from 'semver';
import open from 'open';

import {
  name as packageName,
  version as localVersion,
  publishConfig,
} from '../package.json';
import { EXIT_CODES } from '../lib/enums/exitCodes.js';
import { build } from './lib/build.js';
// import { syncToPublicRepo } from './sync-to-public.js';
import { uiLine, uiLink } from '../lib/ui/index.ts';
import { confirmPrompt, promptUser } from '../lib/prompts/promptUtils.ts';

const exec = promisify(_exec);

const MASTER_BRANCH = 'master';

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

// Commands run with `spawn` won't always get this from the package.json
const REGISTRY = publishConfig.registry;

type ReleaseArguments = {
  versionIncrement: (typeof VERSION_INCREMENT_OPTIONS)[number];
  tag: (typeof TAG_OPTIONS)[number];
  dryRun?: boolean;
};

type DistTags = {
  [TAG.LATEST]: string;
  [TAG.NEXT]: string;
  [TAG.EXPERIMENTAL]: string;
};

type Tag = (typeof TAG_OPTIONS)[number];

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

async function publish(
  tag: Tag,
  otp: string,
  isDryRun: boolean
): Promise<void> {
  logger.log();
  logger.log(`Publishing to ${tag}...`);
  uiLine();
  logger.log();

  const commandArgs = [
    'publish',
    '--tag',
    tag,
    '--registry',
    REGISTRY,
    '--otp',
    otp,
  ];

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

async function updateNextTag(
  newVersion: string,
  otp: string,
  isDryRun: boolean
): Promise<void> {
  logger.log();
  logger.log(`Updating ${TAG.NEXT} tag...`);

  const commandArgs = [
    'dist-tag',
    'add',
    `${packageName}@${newVersion}`,
    TAG.NEXT,
    '--registry',
    REGISTRY,
    '--otp',
    otp,
  ];

  return new Promise((resolve, reject) => {
    if (isDryRun) {
      const distTagCommand = ['npm', ...commandArgs].join(' ');
      logger.log(`Dry run: skipping run of \`${distTagCommand}\``);
      resolve();
    } else {
      const childProcess = spawn('npm', commandArgs, { stdio: 'inherit' });

      childProcess.on('close', code => {
        if (code !== EXIT_CODES.SUCCESS) {
          reject();
        } else {
          logger.success(`${TAG.NEXT} tag updated successfully`);
          resolve();
        }
      });
    }
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

  if (isExperimental && branch === MASTER_BRANCH) {
    logger.error(
      'Releases to experimental tag cannot be published from the master branch'
    );
    process.exit(EXIT_CODES.ERROR);
  } else if (!isExperimental && branch !== MASTER_BRANCH) {
    logger.error(
      'Releases to latest and next tags can only be published from the master branch'
    );
    process.exit(EXIT_CODES.ERROR);
  }

  if (tag === TAG.LATEST && versionIncrement === INCREMENT.PRERELEASE) {
    logger.error(
      'Invalid release: cannot increment prerelease number on latest tag.'
    );
    process.exit(EXIT_CODES.ERROR);
  }

  const { next: currentNextTag, experimental: currentExperimentalTag } =
    await getDistTags();

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

  const tempBranch = `v${newVersion}-publish`;

  if (!newVersion) {
    logger.error('Error incrementing version.');
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log();
  if (dryRun) {
    logger.log('DRY RUN');
  }
  logger.log(`Current version: ${currentVersion}`);
  logger.log(`New version to release: ${newVersion}`);

  const shouldRelease = await confirmPrompt(
    `Release version ${newVersion} on tag ${tag}?`
  );

  if (!shouldRelease) {
    process.exit(EXIT_CODES.SUCCESS);
  }

  if (branch === MASTER_BRANCH && !dryRun) {
    logger.log(`Creating a temporary branch '${tempBranch}' for the release`);
    await exec(`git checkout -b ${tempBranch}`);
  }

  if (
    tag === TAG.LATEST &&
    !localVersion.includes(PRERELEASE_IDENTIFIER.NEXT)
  ) {
    logger.log();
    const proceedWithoutBetaRelease = await confirmPrompt(
      `The current changes have not yet been released in beta. It's recommended to release and test all changes on the ${TAG.NEXT} tag before releasing them to ${TAG.LATEST}. Are you sure you want to proceed?`,
      { defaultAnswer: false }
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
  if (isExperimental) {
    await exec(`yarn version --no-git-tag-version --new-version ${newVersion}`);
  } else {
    await exec(`yarn version --new-version ${newVersion}`);
  }
  logger.success('Version updated successfully');

  logger.log();
  await build();

  let otp = '';

  logger.log();
  if (!isDryRun) {
    const answer = await promptUser({
      name: 'otp',
      message: 'Enter your NPM one-time password:',
    });
    otp = answer.otp;
  } else {
    logger.log('Dry run: skipping one-time password entry');
  }

  try {
    await publish(tag, otp, isDryRun);
  } catch (e) {
    logger.error(
      'An error occurred while releasing the CLI. Correct the error and re-run `yarn build`.'
    );
    await cleanup(newVersion);
    process.exit(EXIT_CODES.ERROR);
  }

  const gitCommand = `git push --atomic origin ${tempBranch} v${newVersion}`;

  if (tag === TAG.LATEST) {
    try {
      await updateNextTag(newVersion, otp, isDryRun);
    } catch (e) {
      logger.error(
        `An error occured while updating the ${TAG.NEXT} tag. To finish this release, run the following commands:`
      );
      logger.log(`npm dist-tag add ${packageName}@${newVersion} ${TAG.NEXT}`);
      logger.log(gitCommand);
    }
  }

  if (isDryRun) {
    await cleanup(newVersion);
    logger.log();
    logger.log('Dry run: skipping push to Github');
    logger.success('Dry run release finished successfully');
    process.exit(EXIT_CODES.SUCCESS);
  }

  if (isExperimental) {
    logger.log();
    logger.log(`Experimental release: Skipping push to Github`);

    // Reset the version back to the local version
    await exec(
      `yarn version --no-git-tag-version --new-version ${localVersion}`
    );
  } else {
    logger.log();
    logger.log(`Pushing changes to Github...`);
    await exec(gitCommand);
    logger.log(`Changes pushed successfully`);
    open(
      `https://git.hubteam.com/HubSpot/hubspot-cli-private/compare/master...${tempBranch}`
    );
  }

  logger.log();
  logger.success(`HubSpot CLI version ${newVersion} published successfully`);
  logger.log(
    uiLink(
      'View on npm',
      'https://www.npmjs.com/package/@hubspot/cli?activeTab=versions'
    )
  );

  if (tag === TAG.LATEST) {
    logger.log();
    logger.log('Remember to create a new release on Github!');
    open('https://github.com/HubSpot/hubspot-cli/releases/new');

    // Sync to public repository
    // TODO Add this back after inbound
    // logger.log();
    // logger.log('Syncing to public repository...');
    // try {
    //   await syncToPublicRepo({ version: newVersion, dryRun: isDryRun });
    // } catch (e) {
    //   logger.error('Failed to sync to public repository:', e);
    //   logger.log('You can manually sync later by running:');
    //   logger.log(
    //     `yarn ts-node scripts/sync-to-public.ts --version ${newVersion}`
    //   );
    // }
  }
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
