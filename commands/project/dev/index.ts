import path from 'path';
import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { i18n } from '../../../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import {
  getAllHsProfiles,
  getHsProfileFilename,
} from '@hubspot/project-parsing-lib';
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
import { loadProfile } from '../../../lib/projectProfiles';

export const command = 'dev';
export const describe = uiBetaTag(
  i18n(`commands.project.subcommands.dev.describe`),
  false
);

export async function handler(
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

  const isUsingV3Api = useV3Api(projectConfig.platformVersion);
  let targetAccountId = providedAccountId;

  if (!args.profile && isUsingV3Api) {
  }

  let profile: HsProfileFile | undefined;

  if (!targetAccountId && isUsingV3Api) {
    if (args.profile) {
      uiLine();
      uiBetaTag(
        i18n('commands.project.subcommands.dev.logs.usingProfile', {
          profileFilename: getHsProfileFilename(args.profile),
        })
      );
      logger.log('');

      profile = await loadProfile(projectConfig, projectDir, args.profile);

      if (!profile) {
        uiLine();
        process.exit(EXIT_CODES.ERROR);
      }

      targetAccountId = profile.accountId;

      logger.log(
        i18n('commands.project.subcommands.dev.logs.profileTargetAccount', {
          account: uiAccountDescription(targetAccountId),
        })
      );

      uiLine();
      logger.log('');
    } else {
      // Check if the project has any profiles configured
      const existingProfiles = await getAllHsProfiles(
        path.join(projectDir!, projectConfig.srcDir)
      );

      if (existingProfiles.length > 0) {
        logger.error(
          i18n('commands.project.subcommands.upload.errors.noProfileSpecified')
        );
        process.exit(EXIT_CODES.ERROR);
      }
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
    logger.error(i18n(`commands.project.subcommands.dev.errors.noAccount`));
    process.exit(EXIT_CODES.ERROR);
  }

  if (isUsingV3Api) {
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
