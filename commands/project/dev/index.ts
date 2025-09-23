import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { getAccountId } from '@hubspot/local-dev-lib/config';
import { HsProfileFile } from '@hubspot/project-parsing-lib/src/lib/types.js';
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
import {
  loadProfile,
  exitIfUsingProfiles,
} from '../../../lib/projectProfiles.js';
import { commands } from '../../../lang/en.js';
import { uiLogger } from '../../../lib/ui/logger.js';

const command = 'dev';
const describe = commands.project.dev.describe;

function validateAccountFlags(
  testingAccount: string | number | undefined,
  projectAccount: string | number | undefined,
  userProvidedAccount: string | number | undefined,
  useV3: boolean
) {
  // Legacy projects do not support targetTestingAccount and targetProjectAccount
  if (testingAccount && projectAccount && !useV3) {
    uiLogger.error(commands.project.dev.errors.unsupportedAccountFlagLegacy);
    process.exit(EXIT_CODES.ERROR);
  }

  if (userProvidedAccount && useV3) {
    uiLogger.error(commands.project.dev.errors.unsupportedAccountFlagV3);
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
  validateProjectConfig(projectConfig, projectDir);

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
    uiLogger.log(commands.project.dev.logs.learnMoreMessageV3);
  } else {
    uiLogger.log(commands.project.dev.logs.learnMoreMessageLegacy);
  }

  let targetProjectAccountId: number | undefined | null;
  let profile: HsProfileFile | undefined;

  // Using the new --projectAccount flag
  if (projectAccount) {
    targetProjectAccountId = getAccountId(projectAccount);
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

  if (!targetProjectAccountId && isV2Project(projectConfig.platformVersion)) {
    if (args.profile) {
      profile = loadProfile(projectConfig, projectDir, args.profile);

      if (!profile) {
        uiLine();
        process.exit(EXIT_CODES.ERROR);
      }

      targetProjectAccountId = profile.accountId;

      uiLogger.log('');
      uiLogger.log(
        commands.project.dev.logs.profileProjectAccountExplanation(
          targetProjectAccountId,
          args.profile
        )
      );
    } else {
      // A profile must be specified if this project has profiles configured
      await exitIfUsingProfiles(projectConfig, projectDir);
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

  if (isV2Project(projectConfig.platformVersion)) {
    const targetTestingAccountId =
      (testingAccount && getAccountId(testingAccount)) || undefined;

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
    hidden: true,
    implies: ['project-account'],
  });

  yargs.options('project-account', {
    type: 'string',
    description: commands.project.dev.options.projectAccount,
    hidden: true,
    implies: ['testingAccount'],
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
    useAccountOptions: true,
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
