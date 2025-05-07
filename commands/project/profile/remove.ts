import fs from 'fs';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  getAllHsProfiles,
  getHsProfileFilename,
  loadHsProfileFile,
} from '@hubspot/project-parsing-lib';
import { deleteProject } from '@hubspot/local-dev-lib/api/projects';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { getProjectConfig } from '../../../lib/projects/config';
import { uiBetaTag } from '../../../lib/ui';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { YargsCommandModule, CommonArgs } from '../../../types/Yargs';
import { makeYargsBuilder } from '../../../lib/yargsUtils';
import { commands } from '../../../lang/en';
import { confirmPrompt, listPrompt } from '../../../lib/prompts/promptUtils';
import { fileExists } from '../../../lib/validation';
import { ensureProjectExists } from '../../../lib/projects/ensureProjectExists';

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
    logger.error(commands.project.profile.remove.errors.noProjectConfig);
    process.exit(EXIT_CODES.ERROR);
  }

  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);
  let profileName: string | undefined = undefined;

  if (args.name) {
    profileName = args.name;
    const profileFilename = getHsProfileFilename(profileName);

    if (!fileExists(path.join(projectSourceDir, profileFilename))) {
      logger.error(
        commands.project.profile.remove.errors.noProfileFound(profileFilename)
      );
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    const existingProfiles = await getAllHsProfiles(projectSourceDir);

    const promptResponse = await listPrompt(
      commands.project.profile.remove.prompts.removeProfilePrompt,
      {
        choices: existingProfiles.map(profile => ({
          name: getHsProfileFilename(profile),
          value: profile,
        })),
      }
    );

    if (promptResponse) {
      profileName = promptResponse;
    }
    logger.log('');
  }

  // This should never happen
  if (!profileName) {
    process.exit(EXIT_CODES.ERROR);
  }

  let targetAccountId: number | undefined;

  try {
    const profileToRemove = await loadHsProfileFile(
      projectSourceDir,
      profileName
    );

    targetAccountId = profileToRemove?.accountId;
  } catch (err) {
    logger.debug(
      commands.project.profile.remove.debug.failedToLoadProfile(profileName)
    );
  }

  if (targetAccountId) {
    const { projectExists } = await ensureProjectExists(
      targetAccountId,
      projectConfig.name,
      {
        allowCreate: false,
      }
    );

    if (projectExists) {
      const confirmResponse = await confirmPrompt(
        commands.project.profile.remove.prompts.removeProjectPrompt(
          targetAccountId
        ),
        {
          defaultAnswer: false,
        }
      );

      if (confirmResponse) {
        await deleteProject(targetAccountId, projectConfig.name);
        logger.log(
          commands.project.profile.remove.logs.removedProject(targetAccountId)
        );
      } else {
        logger.log(
          commands.project.profile.remove.logs.didNotRemoveProject(
            targetAccountId
          )
        );
      }
      logger.log('');
    }
  }

  const profileFilename = getHsProfileFilename(profileName);

  try {
    fs.unlinkSync(path.join(projectSourceDir, profileFilename));
  } catch (err) {
    logger.error(
      commands.project.profile.remove.errors.failedToRemoveProfile(
        profileFilename
      )
    );
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log(
    commands.project.profile.remove.logs.profileRemoved(profileFilename)
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
