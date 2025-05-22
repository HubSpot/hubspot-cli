import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { uiLogger } from '../../../lib/ui/logger';
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
import { getAccountId } from '@hubspot/local-dev-lib/config';

const command = 'dev';
const describe = uiBetaTag(commands.project.dev.describe, false);

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

  // If either targetTestingAccount or targetProjectAccount is provided, the other must be provided
  if (
    (testingAccount && !projectAccount) ||
    (projectAccount && !testingAccount)
  ) {
    uiLogger.error(commands.project.dev.errors.invalidAccountFlags);
    process.exit(EXIT_CODES.ERROR);
  }

  // Legacy projects do not support targetTestingAccount and targetProjectAccount
  if (testingAccount && projectAccount && !useV3) {
    uiLogger.error(commands.project.dev.errors.unsupportedAccountFlags);
    process.exit(EXIT_CODES.ERROR);
  }

  let targetProjectAccountId =
    providedAccountId || getAccountId(projectAccount);

  let profile: HsProfileFile | undefined;

  if (!targetProjectAccountId && useV3) {
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
    // The user is not using profiles or any of the account flags, so we can use the derived accountId
    targetProjectAccountId = derivedAccountId;
  }

  const targetTestingAccountId =
    getAccountId(testingAccount) || targetProjectAccountId;

  trackCommandUsage('project-dev', {}, targetProjectAccountId);

  uiBetaTag(commands.project.dev.logs.betaMessage);

  uiLogger.log(commands.project.dev.logs.learnMoreLocalDevServer);

  if (useV3) {
    await unifiedProjectDevFlow({
      args,
      initialTargetProjectAccountId: targetProjectAccountId,
      initialTargetTestingAccountId: targetTestingAccountId,
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

  yargs.options('targetTestingAccount', {
    type: 'string',
    description: commands.project.dev.options.targetTestingAccount,
    hidden: true,
  });

  yargs.options('targetProjectAccount', {
    type: 'string',
    description: commands.project.dev.options.targetProjectAccount,
    hidden: true,
  });

  yargs.example([['$0 project dev', commands.project.dev.examples.default]]);

  yargs.conflicts('profile', 'account');
  yargs.conflicts('targetTestingAccount', 'account');
  yargs.conflicts('targetProjectAccount', 'account');
  yargs.conflicts('targetTestingAccount', 'profile');
  yargs.conflicts('targetProjectAccount', 'profile');

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
