import path from 'path';
import fs from 'fs';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { getAccountId, getConfigAccounts } from '@hubspot/local-dev-lib/config';
import { HsProfileFile } from '@hubspot/project-parsing-lib/src/lib/types';
import { getAccountIdentifier } from '@hubspot/local-dev-lib/config/getAccountIdentifier';
import {
  getAllHsProfiles,
  getHsProfileFilename,
  loadHsProfileFile,
} from '@hubspot/project-parsing-lib';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { getProjectConfig } from '../../../lib/projects/config';
import { uiBetaTag, uiAccountDescription } from '../../../lib/ui';
import { uiLogger } from '../../../lib/ui/logger';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { YargsCommandModule, CommonArgs } from '../../../types/Yargs';
import { makeYargsBuilder } from '../../../lib/yargsUtils';
import { commands } from '../../../lang/en';
import {
  promptUser,
  listPrompt,
  confirmPrompt,
} from '../../../lib/prompts/promptUtils';
import { fileExists } from '../../../lib/validation';
import { debugError } from '../../../lib/errorHandlers';

const command = 'add [name]';
const describe = uiBetaTag(commands.project.profile.add.describe, false);
const verboseDescribe = uiBetaTag(
  commands.project.profile.add.verboseDescribe,
  false
);

type ProjectProfileAddArgs = CommonArgs & {
  name?: string;
  targetAccount?: number;
};

async function selectProfileToCopyVariablesFrom(
  existingProfiles: string[]
): Promise<string | undefined> {
  let profileToCopyVariablesFrom: string | undefined;

  if (existingProfiles.length == 1) {
    uiLogger.log('');
    uiLogger.log(
      commands.project.profile.add.logs.copyExistingProfile(
        getHsProfileFilename(existingProfiles[0])
      )
    );
    const shouldCopyVariables = await confirmPrompt('Copy profile variables?', {
      defaultAnswer: true,
    });

    if (shouldCopyVariables) {
      profileToCopyVariablesFrom = existingProfiles[0];
    }
  } else if (existingProfiles.length > 1) {
    uiLogger.log('');
    uiLogger.log(commands.project.profile.add.logs.copyExistingProfiles);
    const emptyChoice = {
      name: commands.project.profile.add.prompts.copyExistingProfilePromptEmpty,
      value: undefined,
    };

    const promptResponse = await listPrompt(
      commands.project.profile.add.prompts.copyExistingProfilePrompt,
      {
        choices: [
          ...existingProfiles.map(profile => ({
            name: getHsProfileFilename(profile),
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

  return profileToCopyVariablesFrom;
}

async function handler(
  args: ArgumentsCamelCase<ProjectProfileAddArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('project-profile-add', undefined, derivedAccountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  if (!projectConfig || !projectDir) {
    uiLogger.error(commands.project.profile.add.errors.noProjectConfig);
    process.exit(EXIT_CODES.ERROR);
  }

  const projectSourceDir = path.join(projectDir, projectConfig.srcDir);
  let profileName = args.name;
  let targetAccountId = args.targetAccount;

  function checkIfProfileExists(profileName: string): boolean {
    return fileExists(
      path.join(projectSourceDir, getHsProfileFilename(profileName))
    );
  }

  function isValidProfileName(profileName: string): string | true {
    const trimmedProfileName = profileName.trim();

    if (trimmedProfileName === '') {
      return commands.project.profile.add.prompts.emptyName;
    }
    if (!/^[a-zA-Z0-9]+$/.test(trimmedProfileName)) {
      return commands.project.profile.add.prompts.invalidProfileName;
    }
    if (checkIfProfileExists(trimmedProfileName)) {
      return commands.project.profile.add.errors.profileExists(
        trimmedProfileName
      );
    }
    return true;
  }

  if (profileName) {
    if (checkIfProfileExists(profileName)) {
      uiLogger.error(
        commands.project.profile.add.errors.profileExists(
          getHsProfileFilename(profileName)
        )
      );
      uiLogger.log('');
      profileName = undefined;
    } else {
      const validationResult = isValidProfileName(profileName);
      if (validationResult !== true) {
        uiLogger.error(validationResult);
        uiLogger.log('');
        profileName = undefined;
      }
    }
  }

  if (!profileName) {
    const promptResponse = await promptUser<{ name: string }>({
      type: 'input',
      name: 'name',
      message: commands.project.profile.add.prompts.namePrompt,
      validate: isValidProfileName,
    });

    profileName = promptResponse.name;
  }

  if (targetAccountId) {
    const accountId = getAccountId(targetAccountId);
    if (accountId) {
      targetAccountId = accountId;
    } else {
      uiLogger.error(commands.project.profile.add.errors.invalidTargetAccount);
      uiLogger.log('');
      targetAccountId = undefined;
    }
  }

  if (!targetAccountId) {
    const configuredAccounts = getConfigAccounts();

    if (!configuredAccounts || !configuredAccounts.length) {
      uiLogger.error(commands.project.profile.add.errors.noAccountsConfigured);
      process.exit(EXIT_CODES.ERROR);
    }

    const promptResponse = await listPrompt(
      commands.project.profile.add.prompts.targetAccountPrompt,
      {
        choices: configuredAccounts.map(account => {
          const accountId = getAccountIdentifier(account);
          return {
            name: uiAccountDescription(accountId),
            value: accountId,
          };
        }),
      }
    );

    if (promptResponse) {
      targetAccountId = promptResponse;
    }
  }

  const existingProfiles = await getAllHsProfiles(projectSourceDir);
  let existingTargetAccountIdSelected = false;

  for (const profile of existingProfiles) {
    try {
      const loadedProfile = loadHsProfileFile(projectSourceDir, profile);
      if (loadedProfile?.accountId === targetAccountId) {
        existingTargetAccountIdSelected = true;
        break;
      }
    } catch (err) {
      // Skip profiles that can't be loaded
      debugError(err);
    }
  }

  if (existingTargetAccountIdSelected) {
    uiLogger.log('');
    uiLogger.warn(
      commands.project.profile.add.warnings.duplicateTargetAccount(
        targetAccountId!
      )
    );
  }

  const profileFileContent: HsProfileFile = {
    accountId: targetAccountId!,
    variables: {},
  };

  const profileToCopyVariablesFrom =
    await selectProfileToCopyVariablesFrom(existingProfiles);

  if (profileToCopyVariablesFrom) {
    try {
      const profileToCopyFileContent = loadHsProfileFile(
        projectSourceDir,
        profileToCopyVariablesFrom
      );

      if (profileToCopyFileContent?.variables) {
        profileFileContent.variables = profileToCopyFileContent.variables;
      }
    } catch (err) {
      uiLogger.error(
        commands.project.profile.add.errors.failedToLoadProfile(
          profileToCopyVariablesFrom
        )
      );
    }
  }

  const profileFilename = getHsProfileFilename(profileName);

  try {
    fs.writeFileSync(
      path.join(projectSourceDir, profileFilename),
      JSON.stringify(profileFileContent, null, 2),
      'utf8'
    );
  } catch (err) {
    uiLogger.error(commands.project.profile.add.errors.failedToCreateProfile);
    process.exit(EXIT_CODES.ERROR);
  }

  uiLogger.log('');
  uiLogger.log(commands.project.profile.add.logs.profileAdded(profileFilename));
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
  verboseDescribe,
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
