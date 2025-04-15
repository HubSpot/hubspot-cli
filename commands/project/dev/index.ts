import { ArgumentsCamelCase, Argv, CommandModule } from 'yargs';
import { trackCommandUsage } from '../../../lib/usageTracking';
import { i18n } from '../../../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getProjectConfig, validateProjectConfig } from '../../../lib/projects';
import { EXIT_CODES } from '../../../lib/enums/exitCodes';
import { uiBetaTag, uiCommandReference, uiLink } from '../../../lib/ui';
import { ProjectDevArgs } from '../../../types/Yargs';
import { deprecatedProjectDevFlow } from './deprecatedFlow';
import { unifiedProjectDevFlow } from './unifiedFlow';
import { useV3Api } from '../../../lib/projects/buildAndDeploy';
import { makeYargsBuilder } from '../../../lib/yargsUtils';

const i18nKey = 'commands.project.subcommands.dev';

export const command = 'dev';
export const describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

export async function handler(args: ArgumentsCamelCase<ProjectDevArgs>) {
  const { derivedAccountId } = args;
  const accountConfig = getAccountConfig(derivedAccountId);

  trackCommandUsage('project-dev', {}, derivedAccountId);

  const { projectConfig, projectDir } = await getProjectConfig();

  uiBetaTag(i18n(`${i18nKey}.logs.betaMessage`));

  logger.log(
    uiLink(
      i18n(`${i18nKey}.logs.learnMoreLocalDevServer`),
      'https://developers.hubspot.com/docs/platform/project-cli-commands#start-a-local-development-server'
    )
  );

  if (!projectConfig || !projectDir) {
    logger.error(
      i18n(`${i18nKey}.errors.noProjectConfig`, {
        accountId: derivedAccountId,
        authCommand: uiCommandReference('hs auth'),
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  if (!accountConfig) {
    logger.error(i18n(`${i18nKey}.errors.noAccount`));
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

function projectDevBuilder(yargs: Argv): Argv<ProjectDevArgs> {
  yargs.example([['$0 project dev', i18n(`${i18nKey}.examples.default`)]]);

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
