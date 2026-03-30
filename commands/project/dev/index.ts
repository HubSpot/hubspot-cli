import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';
import {
  getAllHsProfiles,
  HsProfileFile,
} from '@hubspot/project-parsing-lib/profiles';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../lib/projects/config.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { uiLine } from '../../../lib/ui/index.js';
import { ProjectDevArgs } from '../../../types/Yargs.js';
import { deprecatedProjectDevFlow } from './deprecatedFlow.js';
import { unifiedProjectDevFlow } from './unifiedFlow.js';
import { isV2Project } from '../../../lib/projects/platformVersion.js';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { loadProfile } from '../../../lib/projects/projectProfiles.js';
import { commands } from '../../../lang/en.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import { PromptExitError } from '../../../lib/errors/PromptExitError.js';
import path from 'path';
import { listPrompt } from '../../../lib/prompts/promptUtils.js';

const command = 'dev';
const describe = commands.project.dev.describe;

function validateAccountFlags(
  testingAccount: string | number | undefined,
  projectAccount: string | number | undefined,
  userProvidedAccount: string | number | undefined,
  useV2: boolean
) {
  // Legacy projects do not support targetTestingAccount and targetProjectAccount
  if (testingAccount && projectAccount && !useV2) {
    uiLogger.error(commands.project.dev.errors.unsupportedAccountFlagLegacy);
    process.exit(EXIT_CODES.ERROR);
  }

  if (userProvidedAccount && useV2) {
    uiLogger.error(commands.project.dev.errors.unsupportedAccountFlagV2);
    process.exit(EXIT_CODES.ERROR);
  }
}

async function handler(
  args: ArgumentsCamelCase<ProjectDevArgs>
): Promise<void> {
  const {
    derivedAccountId,
    userProvidedAccount,
    testingAccount,
    projectAccount,
  } = args;

  const { projectConfig, projectDir } = await getProjectConfig();

  try {
    validateProjectConfig(projectConfig, projectDir);
  } catch (error) {
    logError(error);
    process.exit(EXIT_CODES.ERROR);
  }

  const useV2Projects = isV2Project(projectConfig.platformVersion);

  if (!projectDir) {
    uiLogger.error(commands.project.dev.errors.noProjectConfig);
    process.exit(EXIT_CODES.ERROR);
  }

  validateAccountFlags(
    testingAccount,
    projectAccount,
    userProvidedAccount,
    useV2Projects
  );

  uiLogger.log(commands.project.dev.logs.header);
  if (useV2Projects) {
    uiLogger.log(commands.project.dev.logs.learnMoreMessageV2);
  } else {
    uiLogger.log(commands.project.dev.logs.learnMoreMessageLegacy);
  }

  let targetProjectAccountId: number | undefined | null;
  let profile: HsProfileFile | undefined;

  // Using the new --projectAccount flag
  if (projectAccount) {
    targetProjectAccountId =
      getConfigAccountIfExists(projectAccount)?.accountId;
    if (targetProjectAccountId) {
      uiLogger.log('');
      uiLogger.log(
        commands.project.dev.logs.projectAccountFlagExplanation(
          targetProjectAccountId
        )
      );
    }
    // Using the legacy --account flag
  } else if (userProvidedAccount && derivedAccountId) {
    targetProjectAccountId = derivedAccountId;
  }

  // Determine profile name: from flag or prompt
  if (!targetProjectAccountId && isV2Project(projectConfig.platformVersion)) {
    let profileName = args.profile;

    if (!profileName) {
      const existingProfiles = await getAllHsProfiles(
        path.join(projectDir, projectConfig.srcDir)
      );

      if (existingProfiles.length !== 0) {
        profileName = await listPrompt<string>(
          commands.project.dev.prompts.selectProfile,
          {
            choices: existingProfiles,
          }
        );
      }
    }

    if (profileName) {
      try {
        profile = loadProfile(projectConfig, projectDir, profileName);
        targetProjectAccountId = profile.accountId;

        uiLogger.log('');
        uiLogger.log(
          commands.project.dev.logs.profileProjectAccountExplanation(
            targetProjectAccountId,
            profileName
          )
        );
      } catch (error) {
        logError(error);
        uiLine();
        process.exit(EXIT_CODES.ERROR);
      }
    }
  }

  if (!targetProjectAccountId) {
    // The user is not using profile or account flags, so we can use the derived accountId
    targetProjectAccountId = derivedAccountId;

    if (useV2Projects) {
      uiLogger.log('');
      uiLogger.log(
        commands.project.dev.logs.defaultProjectAccountExplanation(
          targetProjectAccountId
        )
      );
    }
  }

  trackCommandUsage('project-dev', {}, targetProjectAccountId);

  try {
    if (isV2Project(projectConfig.platformVersion)) {
      const targetTestingAccountId = testingAccount
        ? getConfigAccountIfExists(testingAccount)?.accountId
        : undefined;

      await unifiedProjectDevFlow({
        args,
        targetProjectAccountId,
        providedTargetTestingAccountId: targetTestingAccountId,
        projectConfig,
        projectDir,
        profileConfig: profile,
      });
    } else {
      await deprecatedProjectDevFlow({
        args,
        accountId: targetProjectAccountId,
        projectConfig,
        projectDir,
      });
    }
  } catch (e) {
    if (e instanceof PromptExitError) {
      process.exit(e.exitCode);
    }
    logError(e);
    process.exit(EXIT_CODES.ERROR);
  }
}

function projectDevBuilder(yargs: Argv): Argv<ProjectDevArgs> {
  yargs.option('profile', {
    type: 'string',
    alias: 'p',
    description: commands.project.dev.options.profile,
    hidden: true,
  });

  yargs.options('testing-account', {
    type: 'string',
    description: commands.project.dev.options.testingAccount,
    implies: ['project-account'],
  });

  yargs.options('project-account', {
    type: 'string',
    description: commands.project.dev.options.projectAccount,
    implies: ['testingAccount'],
  });

  yargs.option('account', {
    alias: 'a',
    describe: '',
    type: 'string',
    description: commands.project.dev.options.account,
  });

  yargs.example([['$0 project dev', commands.project.dev.examples.default]]);

  yargs.conflicts('profile', 'account');
  yargs.conflicts('profile', 'testing-account');
  yargs.conflicts('profile', 'project-account');

  return yargs as Argv<ProjectDevArgs>;
}

export const builder = makeYargsBuilder<ProjectDevArgs>(
  projectDevBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useEnvironmentOptions: true,
  }
);

const projectDevCommand: CommandModule<unknown, ProjectDevArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default projectDevCommand;
