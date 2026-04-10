import fs from 'fs';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getAllHsProfiles,
  getHsProfileFilename,
  loadHsProfileFile,
} from '@hubspot/project-parsing-lib/profiles';
import {
  fetchProject,
  deleteProject,
} from '@hubspot/local-dev-lib/api/projects';
import { getConfigAccountById } from '@hubspot/local-dev-lib/config';
import { getProjectConfig } from '../../../lib/projects/config.js';
import { isV2Project } from '../../../lib/projects/platformVersion.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { YargsCommandModule, CommonArgs } from '../../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { commands } from '../../../lang/en.js';
import { confirmPrompt, listPrompt } from '../../../lib/prompts/promptUtils.js';
import { fileExists } from '../../../lib/validation.js';
import { debugError } from '../../../lib/errorHandlers/index.js';
import {
  isDeveloperTestAccount,
  isSandbox,
} from '../../../lib/accountTypes.js';

const command = 'delete [name]';
const describe = commands.project.profile.delete.describe;

type ProjectProfileDeleteArgs = CommonArgs & {
  name?: string;
};

async function handler(
  args: ArgumentsCamelCase<ProjectProfileDeleteArgs>
): Promise<void> {
  const { exit } = args;

  const { projectConfig, projectDir } = await getProjectConfig();

  if (!projectConfig || !projectDir) {
    uiLogger.error(commands.project.profile.delete.errors.noProjectConfig);
    return exit(EXIT_CODES.ERROR);
  }

  if (!isV2Project(projectConfig.platformVersion)) {
    uiLogger.error(
      commands.project.profile.delete.errors.unsupportedPlatformVersion
    );
    return exit(EXIT_CODES.ERROR);
  }

  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);
  let profileName: string | undefined = undefined;

  if (args.name) {
    profileName = args.name;
    const profileFilename = getHsProfileFilename(profileName);

    if (!fileExists(path.join(projectSourceDir, profileFilename))) {
      uiLogger.error(
        commands.project.profile.delete.errors.noProfileFound(profileFilename)
      );
      return exit(EXIT_CODES.ERROR);
    }
  } else {
    const existingProfiles = await getAllHsProfiles(projectSourceDir);

    if (existingProfiles.length === 0) {
      uiLogger.error(commands.project.profile.delete.errors.noProfilesFound);
      return exit(EXIT_CODES.ERROR);
    }

    const promptResponse = await listPrompt(
      commands.project.profile.delete.prompts.deleteProfilePrompt,
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
    uiLogger.log('');
  }

  // This should never happen
  if (!profileName) {
    return exit(EXIT_CODES.ERROR);
  }

  let targetAccountId: number | undefined;

  try {
    const profileToDelete = loadHsProfileFile(projectSourceDir, profileName);

    targetAccountId = profileToDelete?.accountId;
  } catch (err) {
    uiLogger.debug(
      commands.project.profile.delete.debug.failedToLoadProfile(profileName)
    );
  }

  const profileFilename = getHsProfileFilename(profileName);

  try {
    fs.unlinkSync(path.join(projectSourceDir, profileFilename));
  } catch (err) {
    uiLogger.error(
      commands.project.profile.delete.errors.failedToDeleteProfile(
        profileFilename
      )
    );
    return exit(EXIT_CODES.ERROR);
  }

  uiLogger.log(
    commands.project.profile.delete.logs.profileDeleted(profileFilename)
  );

  if (targetAccountId) {
    let projectExists = false;
    try {
      const fetchProjectResponse = await fetchProject(
        targetAccountId,
        projectConfig.name
      );
      projectExists = !!fetchProjectResponse.data;
    } catch (err) {
      debugError(err);
    }

    const targetAccountConfig = getConfigAccountById(targetAccountId);

    if (
      projectExists &&
      targetAccountConfig &&
      (isDeveloperTestAccount(targetAccountConfig) ||
        isSandbox(targetAccountConfig))
    ) {
      uiLogger.log('');

      const confirmResponse = await confirmPrompt(
        commands.project.profile.delete.prompts.deleteProjectPrompt(
          targetAccountId
        ),
        {
          defaultAnswer: false,
        }
      );

      if (confirmResponse) {
        try {
          await deleteProject(targetAccountId, projectConfig.name);
        } catch (err) {
          debugError(err);
          uiLogger.error(
            commands.project.profile.delete.errors.failedToDeleteProject(
              targetAccountId
            )
          );
          return exit(EXIT_CODES.ERROR);
        }

        uiLogger.log(
          commands.project.profile.delete.logs.deletedProject(targetAccountId)
        );
      } else {
        uiLogger.log(
          commands.project.profile.delete.logs.didNotDeleteProject(
            targetAccountId
          )
        );
      }
    }
  }

  return exit(EXIT_CODES.SUCCESS);
}

function projectProfileDeleteBuilder(
  yargs: Argv
): Argv<ProjectProfileDeleteArgs> {
  yargs.positional('name', {
    describe: commands.project.profile.delete.positionals.name,
    type: 'string',
  });

  yargs.example([
    ['$0 project profile delete qa', commands.project.profile.delete.example],
  ]);

  return yargs as Argv<ProjectProfileDeleteArgs>;
}

const builder = makeYargsBuilder<ProjectProfileDeleteArgs>(
  projectProfileDeleteBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const projectProfileDeleteCommand: YargsCommandModule<
  unknown,
  ProjectProfileDeleteArgs
> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('project-profile-delete', handler),
  builder,
};

export default projectProfileDeleteCommand;
