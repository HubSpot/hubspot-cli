import { Argv, ArgumentsCamelCase } from 'yargs';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { makeYargsHandlerWithUsageTracking } from '../../lib/yargs/makeYargsHandlerWithUsageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { fetchProjects } from '@hubspot/local-dev-lib/api/projects';
import { logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';
import { renderTable } from '../../ui/render.js';

const command = ['list', 'ls'];
const describe = commands.project.list.describe;

type ProjectListArgs = CommonArgs & ConfigArgs & AccountArgs;

async function getProjectData(accountId: number): Promise<Project[]> {
  const { data: projects } = await fetchProjects(accountId);
  return projects.results;
}

function formatProjectsAsTableRows(projects: Project[]): string[][] {
  const projectListData: string[][] = [];
  projects.forEach(project => {
    projectListData.push([
      project.name,
      project.latestBuild ? project.latestBuild.platformVersion : '',
    ]);
  });
  return projectListData;
}

async function handler(
  args: ArgumentsCamelCase<ProjectListArgs>
): Promise<void> {
  const { derivedAccountId, exit } = args;

  let projectData: Project[];
  try {
    projectData = await getProjectData(derivedAccountId);
  } catch (e) {
    logError(e);
    return exit(EXIT_CODES.ERROR);
  }

  if (projectData.length === 0) {
    uiLogger.error(
      commands.project.list.errors.noProjectsFound(derivedAccountId)
    );
    return exit(EXIT_CODES.ERROR);
  }
  const projectListData = formatProjectsAsTableRows(projectData);

  const tableHeader = [
    commands.project.list.labels.name,
    commands.project.list.labels.platformVersion,
  ];

  uiLogger.log(commands.project.list.projects);
  renderTable(tableHeader, projectListData);
}

function projectListBuilder(yargs: Argv): Argv<ProjectListArgs> {
  yargs.example([['$0 project list']]);

  return yargs as Argv<ProjectListArgs>;
}

const builder = makeYargsBuilder<ProjectListArgs>(
  projectListBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
  }
);

const projectListCommand: YargsCommandModule<unknown, ProjectListArgs> = {
  command,
  describe,
  handler: makeYargsHandlerWithUsageTracking('projects-list', handler),
  builder,
};

export default projectListCommand;
