import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import path from 'path';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { i18n } from '../../../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import {
  loadHsProfileFile,
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

export const command = 'dev';
export const describe = uiBetaTag(
  i18n(`commands.project.subcommands.dev.describe`),
  false
);

export async function handler(
  args: ArgumentsCamelCase<ProjectDevArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  if (!args.profile) {
    trackCommandUsage('project-dev', {}, derivedAccountId);
  }

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

  const shouldUseV3Api = useV3Api(projectConfig.platformVersion);

  let profileConfig: HsProfileFile | undefined;

  if (args.profile && shouldUseV3Api) {
    uiLine();
    uiBetaTag(
      i18n('commands.project.subcommands.dev.logs.usingProfile', {
        profileFilename: getHsProfileFilename(args.profile),
      })
    );

    try {
      const profile = await loadHsProfileFile(
        path.join(projectDir, projectConfig.srcDir),
        args.profile
      );

      if (!profile) {
        logger.error(
          i18n('commands.project.subcommands.dev.errors.profileNotFound', {
            profileFilename: getHsProfileFilename(args.profile),
          })
        );
        uiLine();
        process.exit(EXIT_CODES.ERROR);
      }
      if (!profile.accountId) {
        logger.error(
          i18n('commands.project.subcommands.dev.errors.noAccountIdInProfile', {
            profileFilename: getHsProfileFilename(args.profile),
          })
        );
        uiLine();
        process.exit(EXIT_CODES.ERROR);
      }

      profileConfig = profile;
    } catch (e) {
      logger.error(
        i18n('commands.project.subcommands.dev.errors.profileNotFound', {
          profileFilename: getHsProfileFilename(args.profile),
        })
      );
      uiLine();
      process.exit(EXIT_CODES.ERROR);
    }

    if (profileConfig) {
      logger.log(
        i18n('commands.project.subcommands.dev.logs.profileTargetAccount', {
          account: uiAccountDescription(profileConfig.accountId),
        })
      );
    }
    logger.log('');
    uiLine();

    trackCommandUsage('project-dev', {}, profileConfig?.accountId);
  }

  const accountConfig = getAccountConfig(
    profileConfig?.accountId || derivedAccountId
  );

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

  if (shouldUseV3Api) {
    await unifiedProjectDevFlow(
      args,
      accountConfig,
      projectConfig,
      projectDir,
      profileConfig
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
