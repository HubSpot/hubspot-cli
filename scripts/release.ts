import { exec } from 'child_process';
import { name as packageName } from '../package.json';
import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';

import { EXIT_CODES } from '../lib/enums/exitCodes';

const MAIN_BRANCH = 'improved-release-script';
const VERSION_INCREMENTS = ['patch', 'minor', 'major'] as const;
const TAGS = ['latest', 'next', 'experimental'] as const;

type ReleaseArguments = {
  versionIncrement: typeof VERSION_INCREMENTS[number];
  tag: typeof TAGS[number];
};

type DistTags = {
  latest: string;
  next: string;
  experimental: string;
};

function isMainBranch(): Promise<boolean> {
  return new Promise(resolve => {
    exec('git rev-parse --abbrev-ref HEAD', (error, stdout) => {
      if (error) {
        logger.error(`An error occured while checking the branch: ${error}`);
        process.exit(EXIT_CODES.ERROR);
      }

      const branch = stdout.trim();
      resolve(branch === MAIN_BRANCH);
    });
  });
}

function getDistTags(): Promise<DistTags> {
  return new Promise(resolve => {
    exec(`npm view ${packageName} dist-tags --json`, async (error, stdout) => {
      if (error) {
        logger.error(
          `AN error occured while fetching current dist tags: ${error}`
        );
        process.exit(EXIT_CODES.ERROR);
      }

      const distTags = stdout.trim();
      const json = await JSON.parse(distTags);
      resolve(json);
    });
  });
}

async function handler({
  versionIncrement,
  tag,
}: ArgumentsCamelCase<ReleaseArguments>): Promise<void> {
  const onCorrectBranch = await isMainBranch();

  if (!onCorrectBranch) {
    logger.error('New release can only be published on main branch');
    process.exit(EXIT_CODES.ERROR);
  }

  const distTags = await getDistTags();
  console.log(distTags);
}

async function builder(yargs: Argv): Promise<Argv> {
  return yargs.options({
    versionIncrement: {
      alias: 'v',
      demandOption: true,
      describe: 'SemVer increment type for the next release',
      choices: VERSION_INCREMENTS,
    },
    tag: {
      alias: 't',
      demandOption: true,
      describe: 'Tag for the next release',
      choices: TAGS,
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
