import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getAllHsProfiles,
  getHsProfileFilename,
  loadHsProfileFile,
} from '@hubspot/project-parsing-lib';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { getProjectConfig } from '../../../lib/projects/config';
import { uiBetaTag } from '../../../lib/ui';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { YargsCommandModule, CommonArgs } from '../../../types/Yargs';
import { makeYargsBuilder } from '../../../lib/yargsUtils';
import { commands } from '../../../lang/en';
import {
  promptUser,
  listPrompt,
  confirmPrompt,
} from '../../../lib/prompts/promptUtils';

const command = 'add [name]';
const describe = uiBetaTag(commands.project.profile.add.describe, false);

type ProjectProfileAddArgs = CommonArgs & {
  name?: string;
  targetAccount?: number;
};

async function handler(
  args: ArgumentsCamelCase<ProjectProfileAddArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('project-profile-add', undefined, derivedAccountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  if (!projectConfig || !projectDir) {
    logger.error('No project config found');
    process.exit(EXIT_CODES.ERROR);
  }

  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);
  let profileName = args.name;

  const checkIfProfileExists = (profileName: string) => {
    try {
      const filename = getHsProfileFilename({
        projectProfile: profileName,
      });
      return fs.existsSync(path.join(projectSourceDir, filename));
    } catch (err) {
      return false;
    }
  };

  if (profileName && checkIfProfileExists(profileName)) {
    logger.error(
      `Profile ${chalk.bold(
        getHsProfileFilename({
          projectProfile: profileName,
        })
      )} already exists. Please choose a different name.`
    );
    logger.log('');
    profileName = undefined;
  }

  if (!profileName) {
    const promptResponse = await promptUser<{ name: string }>({
      type: 'input',
      name: 'name',
      message: '[name] Enter a name for the new project profile: ',
      validate: input => {
        if (input.trim() === '') {
          return 'Profile name cannot be empty';
        }
        if (checkIfProfileExists(input.trim())) {
          return 'Profile already exists. Use a different name and try again.';
        }
        return true;
      },
    });

    profileName = promptResponse.name;
  }

  let targetAccount = args.targetAccount;

  if (!targetAccount) {
    const promptResponse = await promptUser<{ targetAccount: number }>({
      type: 'input',
      name: 'targetAccount',
      message:
        '[--target-account] Enter the target account ID for this profile: ',
      validate: input => {
        if (input.trim() === '') {
          return 'Target account ID cannot be empty';
        }
        if (isNaN(Number(input.trim()))) {
          return 'Target account ID must be a number';
        }
        return true;
      },
    });

    targetAccount = promptResponse.targetAccount;
  }

  const profileFileContent = {
    accountId: Number(targetAccount),
    variables: {},
  };

  const existingProfiles = await getAllHsProfiles(projectSourceDir);
  let profileToCopyVariablesFrom: string | undefined;

  if (existingProfiles.length == 1) {
    logger.log('');
    logger.log(
      `Found an existing project profile. We can copy the configured variables into your new profile file.`
    );
    const shouldCopyVariables = await confirmPrompt('Copy profile variables?', {
      defaultAnswer: true,
    });

    if (shouldCopyVariables) {
      profileToCopyVariablesFrom = existingProfiles[0];
    }
  } else if (existingProfiles.length > 1) {
    logger.log('');
    logger.log(
      `Found existing project profiles. We can copy the configured variables from one of them into your new profile file.`
    );
    const emptyChoice = {
      name: 'None (do not copy any variables)',
      value: undefined,
    };

    const promptResponse = await listPrompt(
      'Select a profile to copy variables from',
      {
        choices: [
          ...existingProfiles.map(profile => ({
            name: getHsProfileFilename({
              projectProfile: profile,
            }),
            value: profile,
          })),
          emptyChoice,
        ],
      }
    );

    if (promptResponse) {
      profileToCopyVariablesFrom = promptResponse;
    }
  }

  if (profileToCopyVariablesFrom) {
    try {
      const profileToCopyFileContent = await loadHsProfileFile(
        projectSourceDir,
        {
          projectProfile: profileToCopyVariablesFrom,
        }
      );

      if (profileToCopyFileContent?.variables) {
        profileFileContent.variables = profileToCopyFileContent.variables;
      }
    } catch (err) {
      logger.error('Failed to load profile file to copy from', err);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  const filename = getHsProfileFilename({
    projectProfile: profileName,
  });

  try {
    fs.writeFileSync(
      path.join(projectSourceDir, filename),
      JSON.stringify(profileFileContent, null, 2),
      'utf8'
    );
  } catch (err) {
    logger.error('Failed to create profile file', err);
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log('');
  logger.log(
    `Successfully created ${chalk.bold(
      getHsProfileFilename({
        projectProfile: profileName,
      })
    )} profile in your project source directory!`
  );
  process.exit(EXIT_CODES.SUCCESS);
}

function projectProfileAddBuilder(yargs: Argv): Argv<ProjectProfileAddArgs> {
  yargs.positional('name', {
    describe: commands.project.profile.add.positionals.name,
    type: 'string',
  });
  yargs.option('target-account', {
    describe: commands.project.profile.add.options.targetAccount,
    type: 'number',
  });

  yargs.example([
    ['$0 project profile add qa', commands.project.profile.add.example],
  ]);

  return yargs as Argv<ProjectProfileAddArgs>;
}

const builder = makeYargsBuilder<ProjectProfileAddArgs>(
  projectProfileAddBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const projectProfileAddCommand: YargsCommandModule<
  unknown,
  ProjectProfileAddArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default projectProfileAddCommand;
