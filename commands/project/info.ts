import { ArgumentsCamelCase, Argv } from 'yargs';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
  JSONOutputArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeWrappedYargsHandler } from '../../lib/yargs/makeWrappedYargsHandler.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { debugError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';
import { getProjectConfig } from '../../lib/projects/config.js';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import {
  getProjectInfo,
  logProjectInfo,
} from '../../lib/projects/projectInfo.js';
import {
  ProjectInfoJsonOutput,
  ProjectInfoSchema,
} from '../../lib/jsonOutput.js';

const command = 'info';
const describe = commands.project.info.describe;
const verboseDescribe = commands.project.info.verboseDescribe;

export type ProjectInfoArgs = CommonArgs &
  ConfigArgs &
  AccountArgs &
  EnvironmentArgs &
  JSONOutputArgs<ProjectInfoJsonOutput>;

async function handler(
  args: ArgumentsCamelCase<ProjectInfoArgs>
): Promise<void> {
  const { derivedAccountId, formatOutputAsJson, exit, addJsonOutput } = args;

  const { projectConfig } = await getProjectConfig();

  if (!projectConfig) {
    uiLogger.error(commands.project.info.errors.noProjectConfig);
    return exit(EXIT_CODES.ERROR);
  }

  if (isLegacyProject(projectConfig.platformVersion)) {
    uiLogger.error(
      commands.project.info.errors.unsupportedPlatformVersion(
        projectConfig.platformVersion
      )
    );
    return exit(EXIT_CODES.ERROR);
  }

  const projectName = projectConfig.name;

  let project: Project;
  try {
    const response = await fetchProject(derivedAccountId, projectName);
    project = response.data;
  } catch (error) {
    debugError(error);
    uiLogger.error(
      commands.project.info.errors.projectNotFound(
        projectName,
        derivedAccountId
      )
    );
    return exit(EXIT_CODES.ERROR);
  }

  const deployedBuild = project.deployedBuild;
  if (!deployedBuild) {
    uiLogger.error(commands.project.info.errors.noDeployedBuild);
    return exit(EXIT_CODES.ERROR);
  }

  const projectInfo = await getProjectInfo(
    project,
    projectConfig.platformVersion,
    derivedAccountId
  );

  addJsonOutput(projectInfo);

  if (!formatOutputAsJson) {
    logProjectInfo(projectInfo);
  }
}

function projectInfoBuilder(yargs: Argv): Argv<ProjectInfoArgs> {
  yargs.example([
    ['$0 project info', commands.project.info.examples.default],
    ['$0 project info --json', commands.project.info.examples.json],
  ]);

  return yargs as Argv<ProjectInfoArgs>;
}

const builder = makeYargsBuilder<ProjectInfoArgs>(
  projectInfoBuilder,
  command,
  verboseDescribe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
    useJSONOutputOptions: true,
  }
);

const projectInfoCommand: YargsCommandModule<unknown, ProjectInfoArgs> = {
  command,
  describe,
  handler: makeWrappedYargsHandler('project-info', handler, {
    jsonOutputSchema: ProjectInfoSchema,
  }),
  builder,
};

export default projectInfoCommand;
