import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { getAccountId } from '@hubspot/local-dev-lib/config';
import { HsProfileFile } from '@hubspot/project-parsing-lib/src/lib/types';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../lib/projects/config';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { uiBetaTag, uiLine } from '../../../lib/ui';
import { ProjectDevArgs } from '../../../types/Yargs';
import { deprecatedProjectDevFlow } from './deprecatedFlow';
import { unifiedProjectDevFlow } from './unifiedFlow';
import { useV3Api } from '../../../lib/projects/buildAndDeploy';
import { makeYargsBuilder } from '../../../lib/yargsUtils';
import {
  loadProfile,
  logProfileFooter,
  logProfileHeader,
  exitIfUsingProfiles,
} from '../../../lib/projectProfiles';
import { commands } from '../../../lang/en';
import { uiLogger } from '../../../lib/ui/logger';

const command = 'dev';
const describe = uiBetaTag(commands.project.dev.describe, false);

function validateAccountFlags(
  testingAccount: string | number | undefined,
  projectAccount: string | number | undefined,
  providedAccountId: string | number | undefined,
  useV3: boolean
) {
  // Legacy projects do not support targetTestingAccount and targetProjectAccount
  if (testingAccount && projectAccount && !useV3) {
    uiLogger.error(commands.project.dev.errors.unsupportedAccountFlagLegacy);
    process.exit(EXIT_CODES.ERROR);
  }

  if (providedAccountId && useV3) {
    uiLogger.error(commands.project.dev.errors.unsupportedAccountFlagV3);
    process.exit(EXIT_CODES.ERROR);
  }
}

async function handler(
  args: ArgumentsCamelCase<ProjectDevArgs>
): Promise<void> {
  const {
    derivedAccountId,
    providedAccountId,
    testingAccount,
    projectAccount,
  } = args;

  const { projectConfig, projectDir } = await getProjectConfig();
  validateProjectConfig(projectConfig, projectDir);

  const useV3 = useV3Api(projectConfig.platformVersion);

  if (!projectDir) {
    uiLogger.error(commands.project.dev.errors.noProjectConfig);
    process.exit(EXIT_CODES.ERROR);
  }

  validateAccountFlags(
    testingAccount,
    projectAccount,
    providedAccountId,
    useV3
  );

  let targetProjectAccountId =
    (projectAccount && getAccountId(projectAccount)) ||
    (providedAccountId && derivedAccountId);

  let profile: HsProfileFile | undefined;

  if (!targetProjectAccountId && useV3Api(projectConfig.platformVersion)) {
    if (args.profile) {
      logProfileHeader(args.profile);

      profile = loadProfile(projectConfig, projectDir, args.profile);

      if (!profile) {
        uiLine();
        process.exit(EXIT_CODES.ERROR);
      }

      targetProjectAccountId = profile.accountId;

      logProfileFooter(profile);
    } else {
      // A profile must be specified if this project has profiles configured
      await exitIfUsingProfiles(projectConfig, projectDir);
    }
  }

  if (!targetProjectAccountId) {
    // The user is not using profile or account flags, so we can use the derived accountId
    targetProjectAccountId = derivedAccountId;
  }

  trackCommandUsage('project-dev', {}, targetProjectAccountId);

  uiBetaTag(commands.project.dev.logs.betaMessage);

  uiLogger.log(commands.project.dev.logs.learnMoreLocalDevServer);

  if (useV3Api(projectConfig.platformVersion)) {
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

  yargs.options('testingAccount', {
    type: 'string',
    description: commands.project.dev.options.testingAccount,
    hidden: true,
    implies: ['projectAccount'],
  });

  yargs.options('projectAccount', {
    type: 'string',
    description: commands.project.dev.options.projectAccount,
    hidden: true,
    implies: ['testingAccount'],
  });

  yargs.example([['$0 project dev', commands.project.dev.examples.default]]);

  yargs.conflicts('profile', 'account');
  yargs.conflicts('profile', 'testingAccount');
  yargs.conflicts('profile', 'projectAccount');

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
