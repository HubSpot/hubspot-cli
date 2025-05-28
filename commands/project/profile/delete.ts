import fs from 'fs';
import path from 'path';
import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  getAllHsProfiles,
  getHsProfileFilename,
  loadHsProfileFile,
} from '@hubspot/project-parsing-lib';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import { deleteProject } from '@hubspot/local-dev-lib/api/projects';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { getProjectConfig } from '../../../lib/projects/config';
import { uiBetaTag } from '../../../lib/ui';
import { uiLogger } from '../../../lib/ui/logger';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { YargsCommandModule, CommonArgs } from '../../../types/Yargs';
import { makeYargsBuilder } from '../../../lib/yargsUtils';
import { commands } from '../../../lang/en';
import { confirmPrompt, listPrompt } from '../../../lib/prompts/promptUtils';
import { fileExists } from '../../../lib/validation';
import { debugError } from '../../../lib/errorHandlers';

const command = 'delete [name]';
const describe = uiBetaTag(commands.project.profile.delete.describe, false);

type ProjectProfileDeleteArgs = CommonArgs & {
  name?: string;
};

async function handler(
  args: ArgumentsCamelCase<ProjectProfileDeleteArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('project-profile-delete', undefined, derivedAccountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  if (!projectConfig || !projectDir) {
    uiLogger.error(commands.project.profile.delete.errors.noProjectConfig);
    process.exit(EXIT_CODES.ERROR);
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
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    const existingProfiles = await getAllHsProfiles(projectSourceDir);

    if (existingProfiles.length === 0) {
      uiLogger.error(commands.project.profile.delete.errors.noProfilesFound);
      process.exit(EXIT_CODES.ERROR);
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
    process.exit(EXIT_CODES.ERROR);
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

    if (projectExists) {
      const confirmResponse = await confirmPrompt(
        commands.project.profile.delete.prompts.deleteProjectPrompt(
          targetAccountId
        ),
        {
          defaultAnswer: false,
        }
      );

      if (confirmResponse) {
        await deleteProject(targetAccountId, projectConfig.name);
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
      uiLogger.log('');
    }
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
    process.exit(EXIT_CODES.ERROR);
  }

  uiLogger.log(
    commands.project.profile.delete.logs.profileDeleted(profileFilename)
  );
  process.exit(EXIT_CODES.SUCCESS);
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
  handler,
  builder,
};

export default projectProfileDeleteCommand;
