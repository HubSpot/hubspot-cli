import { Argv, ArgumentsCamelCase } from 'yargs';
import open from 'open';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { getProjectConfig } from '../../lib/projects/config.js';
import { ensureProjectExists } from '../../lib/projects/ensureProjectExists.js';
import { getProjectDetailUrl } from '../../lib/projects/urls.js';
import { projectNamePrompt } from '../../lib/prompts/projectNamePrompt.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  TestingArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

const command = 'open';
const describe = commands.project.open.describe;

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
  uiLogger.success(commands.project.open.success(projectName!));
  process.exit(EXIT_CODES.SUCCESS);
}

function projectOpenBuilder(yargs: Argv): Argv<ProjectOpenArgs> {
  yargs.options({
    project: {
      describe: commands.project.open.options.project.describe,
      type: 'string',
    },
  });

  yargs.example([['$0 project open', commands.project.open.examples.default]]);

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
