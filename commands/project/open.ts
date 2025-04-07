import { Argv, ArgumentsCamelCase } from 'yargs';
import open from 'open';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  addTestingOptions,
} from '../../lib/commonOpts';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getProjectConfig, ensureProjectExists } from '../../lib/projects';
import { getProjectDetailUrl } from '../../lib/projects/urls';
import { projectNamePrompt } from '../../lib/prompts/projectNamePrompt';
import { uiBetaTag } from '../../lib/ui';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  TestingArgs,
} from '../../types/Yargs';

const i18nKey = 'commands.project.subcommands.open';

export const command = 'open';
export const describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

type ProjectOpenArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  TestingArgs & { project?: string };

export async function handler(args: ArgumentsCamelCase<ProjectOpenArgs>) {
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
    const namePromptResponse = await projectNamePrompt(derivedAccountId);
    projectName = namePromptResponse.projectName;
  }

  const url = getProjectDetailUrl(projectName!, derivedAccountId)!;
  open(url, { url: true });
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

module.exports = {
  command,
  describe,
  handler,
  builder,
};
