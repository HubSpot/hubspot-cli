import { Argv, ArgumentsCamelCase } from 'yargs';
import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';
import { HsProfileFile } from '@hubspot/project-parsing-lib/profiles';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../lib/projects/config.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { uiLine } from '../../../lib/ui/index.js';
import { ProjectDevArgs, YargsCommandModule } from '../../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../../lib/yargs/makeWrappedYargsHandler.js';
import { unifiedProjectDevFlow } from './unifiedFlow.js';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import { makeYargsBuilder } from '../../../lib/yargsUtils.js';
import { loadAndValidateProfile } from '../../../lib/projects/projectProfiles.js';
import { commands } from '../../../lang/en.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { logError } from '../../../lib/errorHandlers/index.js';
import { projectProfilePrompt } from '../../../lib/prompts/projectProfilePrompt.js';
import { isPromptExitError } from '../../../lib/errors/PromptExitError.js';
import { LOCAL_DEV_DEFAULT_PORT } from '../../../lib/constants.js';

const command = 'dev';
const describe = commands.project.dev.describe;

async function handler(
  args: ArgumentsCamelCase<ProjectDevArgs>
): Promise<void> {
  const {
    derivedAccountId,
    testingAccount,
    projectAccount,
    profile: profileOption,
    exit,
    addUsageMetadata,
  } = args;

  const { projectConfig, projectDir } = await getProjectConfig();

  try {
    validateProjectConfig(projectConfig, projectDir);
  } catch (error) {
    logError(error);
    return exit(EXIT_CODES.ERROR);
  }

  if (!projectDir) {
    uiLogger.error(commands.project.dev.errors.noProjectConfig);
    return exit(EXIT_CODES.ERROR);
  }

  if (isLegacyProject(projectConfig.platformVersion)) {
    uiLogger.error(
      commands.project.dev.errors.unsupportedPlatformVersion(
        projectConfig.platformVersion
      )
    );
    return exit(EXIT_CODES.ERROR);
  }

  uiLogger.log(commands.project.dev.logs.header);
  uiLogger.log(commands.project.dev.logs.learnMoreMessageV2);

  let targetProjectAccountId: number | undefined | null;
  let profile: HsProfileFile | undefined;

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
  }

  if (!targetProjectAccountId) {
    const profileName = await projectProfilePrompt(
      projectDir,
      projectConfig,
      profileOption
    );

    if (profileName) {
      try {
        profile = await loadAndValidateProfile(
          projectConfig,
          projectDir,
          profileName
        );
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
        return exit(EXIT_CODES.ERROR);
      }
    }
  }

  if (!targetProjectAccountId) {
    targetProjectAccountId = derivedAccountId;

    uiLogger.log('');
    uiLogger.log(
      commands.project.dev.logs.defaultProjectAccountExplanation(
        targetProjectAccountId
      )
    );
  }

  addUsageMetadata({ accountId: targetProjectAccountId ?? undefined });

  try {
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
  } catch (e) {
    if (isPromptExitError(e)) {
      throw e;
    }
    logError(e);
    return exit(EXIT_CODES.ERROR);
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

  yargs.option('port', {
    type: 'number',
    description: commands.project.dev.options.port,
    default: LOCAL_DEV_DEFAULT_PORT,
  });

  yargs.example([['$0 project dev', commands.project.dev.examples.default]]);

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

const projectDevCommand: YargsCommandModule<unknown, ProjectDevArgs> = {
  command,
  describe,
  handler: makeWrappedYargsHandler('project-dev', handler),
  builder,
};

export default projectDevCommand;
