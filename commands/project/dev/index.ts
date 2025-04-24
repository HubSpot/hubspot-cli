import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { i18n } from '../../../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getProjectConfig, validateProjectConfig } from '../../../lib/projects';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { uiBetaTag, uiCommandReference, uiLink } from '../../../lib/ui';

import { ArgumentsCamelCase, Argv } from 'yargs';
import { ProjectDevArgs } from '../../../types/Yargs';
import { deprecatedProjectDevFlow } from './deprecatedFlow';
import { unifiedProjectDevFlow } from './unifiedFlow';
import { useV3Api } from '../../../lib/projects/buildAndDeploy';

export const command = 'dev';
export const describe = uiBetaTag(
  i18n(`commands.project.subcommands.dev.describe`),
  false
);

export async function handler(args: ArgumentsCamelCase<ProjectDevArgs>) {
  const { derivedAccountId } = args;
  const accountConfig = getAccountConfig(derivedAccountId);

  trackCommandUsage('project-dev', {}, derivedAccountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  uiBetaTag(i18n(`commands.project.subcommands.dev.logs.betaMessage`));

  logger.log(
    uiLink(
      i18n(`commands.project.subcommands.dev.logs.learnMoreLocalDevServer`),
      'https://developers.hubspot.com/docs/platform/project-cli-commands#start-a-local-development-server'
    )
  );

  if (!projectConfig || !projectDir) {
    logger.error(
      i18n(`commands.project.subcommands.dev.errors.noProjectConfig`, {
        accountId: derivedAccountId,
        authCommand: uiCommandReference('hs auth'),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  if (!accountConfig) {
    logger.error(i18n(`commands.project.subcommands.dev.errors.noAccount`));
    process.exit(EXIT_CODES.ERROR);
  }

  validateProjectConfig(projectConfig, projectDir);

  if (useV3Api(projectConfig.platformVersion)) {
    await unifiedProjectDevFlow(args, accountConfig, projectConfig, projectDir);
  } else {
    await deprecatedProjectDevFlow(
      args,
      accountConfig,
      projectConfig,
      projectDir
    );
  }
}

export function builder(yargs: Argv): Argv<ProjectDevArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  yargs.example([
    [
      '$0 project dev',
      i18n(`commands.project.subcommands.dev.examples.default`),
    ],
  ]);

  return yargs as Argv<ProjectDevArgs>;
}
