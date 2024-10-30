import { exec } from 'child_process';
import yargs, { Arguments, Argv } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';

import { EXIT_CODES } from '../lib/enums/exitCodes';

const MAIN_BRANCH = 'improved-release-script';

function isMainBranch(): Promise<boolean> {
  return new Promise(resolve => {
    exec('git rev-parse --abbrev-ref HEAD', (error, stdout) => {
      if (error) {
        logger.error('An error occured while checking the branch');
        process.exit(EXIT_CODES.ERROR);
      }

      const branch = stdout.trim();
      resolve(branch === MAIN_BRANCH);
    });
  });
}

async function handler({ versionIncrement, tag }: Arguments): Promise<void> {
  const onCorrectBranch = await isMainBranch();

  if (!onCorrectBranch) {
    logger.error('New release can only be published on main branch');
    process.exit(EXIT_CODES.ERROR);
  }
}

async function builder(yargs: Argv) {
  yargs.options({
    versionIncrement: {
      alias: 'v',
      requiresArg: true,
      describe: 'SemVer increment type for the next release',
      choices: ['patch', 'minor', 'major'] as const,
    },
    tag: {
      alias: 't',
      requiresArg: true,
      describe: 'Tag for the next release',
      choices: ['latest', 'next', 'experimental'] as const,
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
