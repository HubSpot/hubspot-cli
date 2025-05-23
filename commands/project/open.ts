import { Argv, ArgumentsCamelCase } from 'yargs';
import open from 'open';
import { trackCommandUsage } from '../../lib/usageTracking';
import { i18n } from '../../lib/lang';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getProjectConfig } from '../../lib/projects/config';
import { ensureProjectExists } from '../../lib/projects/ensureProjectExists';
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
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const command = 'open';
const describe = uiBetaTag(
  i18n(`commands.project.subcommands.open.describe`),
  false
);

type ProjectOpenArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  TestingArgs & { project?: string };

async function handler(
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
    const namePromptResponse = await projectNamePrompt(derivedAccountId);
    projectName = namePromptResponse.projectName;
  }

  const url = getProjectDetailUrl(projectName!, derivedAccountId)!;
  open(url, { url: true });
  logger.success(
    i18n(`commands.project.subcommands.open.success`, {
      projectName: projectName!,
    })
  );
  process.exit(EXIT_CODES.SUCCESS);
}

function projectOpenBuilder(yargs: Argv): Argv<ProjectOpenArgs> {
  yargs.options({
    project: {
      describe: i18n(
        `commands.project.subcommands.open.options.project.describe`
      ),
      type: 'string',
    },
  });

  yargs.example([
    [
      '$0 project open',
      i18n(`commands.project.subcommands.open.examples.default`),
    ],
  ]);

  return yargs as Argv<ProjectOpenArgs>;
}

const builder = makeYargsBuilder<ProjectOpenArgs>(
  projectOpenBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
    useTestingOptions: true,
  }
);

const projectOpenCommand: YargsCommandModule<unknown, ProjectOpenArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default projectOpenCommand;
