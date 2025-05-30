import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { i18n } from '../../../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { HsProfileFile } from '@hubspot/project-parsing-lib/src/lib/types';
import {
  getProjectConfig,
  validateProjectConfig,
} from '../../../lib/projects/config';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import {
  uiBetaTag,
  uiCommandReference,
  uiLink,
  uiLine,
  uiAccountDescription,
} from '../../../lib/ui';
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

const command = 'dev';
const describe = uiBetaTag(
  i18n(`commands.project.subcommands.dev.describe`),
  false
);

async function handler(
  args: ArgumentsCamelCase<ProjectDevArgs>
): Promise<void> {
  const { derivedAccountId, providedAccountId } = args;

  const { projectConfig, projectDir } = await getProjectConfig();
  validateProjectConfig(projectConfig, projectDir);

  if (!projectDir) {
    logger.error(
      i18n(`commands.project.subcommands.dev.errors.noProjectConfig`, {
        accountId: derivedAccountId,
        authCommand: uiCommandReference('hs auth'),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  let targetAccountId = providedAccountId;

  let profile: HsProfileFile | undefined;

  if (!targetAccountId && useV3Api(projectConfig.platformVersion)) {
    if (args.profile) {
      logProfileHeader(args.profile);

      profile = loadProfile(projectConfig, projectDir, args.profile);

      if (!profile) {
        uiLine();
        process.exit(EXIT_CODES.ERROR);
      }

      targetAccountId = profile.accountId;

      logProfileFooter(profile);
    } else {
      // A profile must be specified if this project has profiles configured
      await exitIfUsingProfiles(projectConfig, projectDir);
    }
  }

  if (!targetAccountId) {
    // The user is not using profiles, so we can use the derived accountId
    targetAccountId = derivedAccountId;
  }

  trackCommandUsage('project-dev', {}, targetAccountId);

  const accountConfig = getAccountConfig(targetAccountId);

  uiBetaTag(i18n(`commands.project.subcommands.dev.logs.betaMessage`));

  logger.log(
    uiLink(
      i18n(`commands.project.subcommands.dev.logs.learnMoreLocalDevServer`),
      'https://developers.hubspot.com/docs/platform/project-cli-commands#start-a-local-development-server'
    )
  );

  if (!accountConfig) {
    logger.error(
      i18n(`commands.project.subcommands.dev.errors.noAccount`, {
        accountId: uiAccountDescription(targetAccountId),
        authCommand: uiCommandReference('hs auth'),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  if (useV3Api(projectConfig.platformVersion)) {
    await unifiedProjectDevFlow(
      args,
      accountConfig,
      projectConfig,
      projectDir,
      profile
    );
  } else {
    await deprecatedProjectDevFlow(
      args,
      accountConfig,
      projectConfig,
      projectDir
    );
  }
}

function projectDevBuilder(yargs: Argv): Argv<ProjectDevArgs> {
  yargs.option('profile', {
    type: 'string',
    alias: 'p',
    description: i18n(`commands.project.subcommands.dev.options.profile`),
    hidden: true,
  });

  yargs.example([
    [
      '$0 project dev',
      i18n(`commands.project.subcommands.dev.examples.default`),
    ],
  ]);

  yargs.conflicts('profile', 'account');

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
