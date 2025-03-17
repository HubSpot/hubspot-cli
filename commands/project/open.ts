import open from 'open';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getProjectDetailUrl } from '../../lib/projects/urls';
import { projectNamePrompt } from '../../lib/prompts/projectNamePrompt';
import { uiBetaTag } from '../../lib/ui';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { getProjectConfig, ensureProjectExists } from '../../lib/projects';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { hasUnifiedAppsAccess } from '../../lib/hasFeature';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../../types/Yargs';
import {
  addConfigOptions,
  addAccountOptions,
  addTestingOptions,
  addUseEnvironmentOptions,
} from '../../lib/commonOpts';

const i18nKey = 'commands.project.subcommands.open';

export const command = 'open';
export const describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

type ProjectOpenArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs & { project?: string };

export async function handler(
  args: ArgumentsCamelCase<ProjectOpenArgs>
): Promise<void> {
  const { project, derivedAccountId } = args;

  trackCommandUsage('project-open', undefined, derivedAccountId);

  const { projectConfig } = await getProjectConfig();

  let projectName = project;

  if (projectName) {
    const { projectExists } = await ensureProjectExists(
      derivedAccountId,
      projectName,
      {
        allowCreate: false,
      }
    );

    if (!projectExists) {
      process.exit(EXIT_CODES.ERROR);
    }
  } else if (!projectName && projectConfig) {
    projectName = projectConfig.name;
  } else if (!projectName && !projectConfig) {
    const namePrompt = await projectNamePrompt(derivedAccountId);

    if (!namePrompt.projectName) {
      process.exit(EXIT_CODES.ERROR);
    }
    projectName = namePrompt.projectName;
  }

  const useV2Urls = await hasUnifiedAppsAccess(derivedAccountId);

  const url = getProjectDetailUrl(projectName!, derivedAccountId, useV2Urls);
  open(url!, { url: true });
  logger.success(i18n(`${i18nKey}.success`, { projectName: projectName! }));
  process.exit(EXIT_CODES.SUCCESS);
}

export function builder(yargs: Argv): Argv<ProjectOpenArgs> {
  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);
  addTestingOptions(yargs);

  yargs.options({
    project: {
      describe: i18n(`${i18nKey}.options.project.describe`),
      type: 'string',
    },
  });

  yargs.example([['$0 project open', i18n(`${i18nKey}.examples.default`)]]);

  return yargs as Argv<ProjectOpenArgs>;
}
