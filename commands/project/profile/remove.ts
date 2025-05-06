import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getAllHsProfiles,
  getHsProfileFilename,
} from '@hubspot/project-parsing-lib';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { getProjectConfig } from '../../../lib/projects/config';
import { uiBetaTag } from '../../../lib/ui';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { YargsCommandModule, CommonArgs } from '../../../types/Yargs';
import { makeYargsBuilder } from '../../../lib/yargsUtils';
import { commands } from '../../../lang/en';
import { listPrompt } from '../../../lib/prompts/promptUtils';

const command = 'remove [name]';
const describe = uiBetaTag(commands.project.profile.remove.describe, false);

type ProjectProfileRemoveArgs = CommonArgs & {
  name?: string;
};

async function handler(
  args: ArgumentsCamelCase<ProjectProfileRemoveArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('project-profile-remove', undefined, derivedAccountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  if (!projectConfig || !projectDir) {
    logger.error('No project config found');
    process.exit(EXIT_CODES.ERROR);
  }

  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);
  let profileFilename: string | undefined = undefined;

  const profileExists = (profileName: string) => {
    try {
      const filename = getHsProfileFilename({
        projectProfile: profileName,
      });
      return fs.existsSync(path.join(projectSourceDir, filename));
    } catch (err) {
      return false;
    }
  };

  if (args.name) {
    if (profileExists(args.name)) {
      profileFilename = getHsProfileFilename({
        projectProfile: args.name,
      });
    } else {
      logger.error(
        `No profile with filename ${chalk.bold(
          getHsProfileFilename({
            projectProfile: args.name,
          })
        )} found in your project source directory.`
      );
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    const existingProfiles = await getAllHsProfiles(projectSourceDir);

    const promptResponse = await listPrompt('Select a profile to remove', {
      choices: existingProfiles.map(profile =>
        getHsProfileFilename({
          projectProfile: profile,
        })
      ),
    });

    if (promptResponse) {
      profileFilename = promptResponse;
    }
    logger.log('');
  }

  if (!profileFilename) {
    logger.error('No profile filename found');
    process.exit(EXIT_CODES.ERROR);
  }

  try {
    fs.unlinkSync(path.join(projectSourceDir, profileFilename));
  } catch (err) {
    logger.error('Failed to remove profile file', err);
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log(
    `Successfully removed the ${chalk.bold(profileFilename)} profile from your project source directory!`
  );

  process.exit(EXIT_CODES.SUCCESS);
}

function projectProfileRemoveBuilder(
  yargs: Argv
): Argv<ProjectProfileRemoveArgs> {
  yargs.positional('name', {
    describe: commands.project.profile.remove.positionals.name,
    type: 'string',
  });

  yargs.example([
    ['$0 project profile remove qa', commands.project.profile.remove.example],
  ]);

  return yargs as Argv<ProjectProfileRemoveArgs>;
}

const builder = makeYargsBuilder<ProjectProfileRemoveArgs>(
  projectProfileRemoveBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const projectProfileRemoveCommand: YargsCommandModule<
  unknown,
  ProjectProfileRemoveArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default projectProfileRemoveCommand;
