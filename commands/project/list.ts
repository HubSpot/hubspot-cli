import { ArgumentsCamelCase, Argv } from 'yargs';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  YargsCommandModule,
} from '../../types/Yargs.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { fetchProjects } from '@hubspot/local-dev-lib/api/projects';
import { logError } from '../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { getTableContents, getTableHeader } from '../../lib/ui/table.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { commands } from '../../lang/en.js';

const command = ['list', 'ls'];
const describe = commands.project.list.describe;

type ProjectListArgs = CommonArgs & ConfigArgs & AccountArgs;

async function getProjectData(accountId: number): Promise<Project[]> {
  try {
    const { data: projects } = await fetchProjects(accountId);
    return projects.results;
  } catch (e) {
    logError(e);
    process.exit(EXIT_CODES.ERROR);
  }
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
  const { derivedAccountId } = args;

  trackCommandUsage('projects-list', undefined, derivedAccountId);

  const projectData = await getProjectData(derivedAccountId);

  if (projectData.length === 0) {
    uiLogger.error(
      commands.project.list.errors.noProjectsFound(derivedAccountId)
    );
    process.exit(EXIT_CODES.ERROR);
  }
  const projectListData = formatProjectsAsTableRows(projectData);

  projectListData.unshift(
    getTableHeader([
      commands.project.list.labels.name,
      commands.project.list.labels.platformVersion,
    ])
  );

  uiLogger.log(commands.project.list.projects);
  uiLogger.log(
    getTableContents(projectListData, { border: { bodyLeft: '  ' } })
  );
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
  handler,
  builder,
};

export default projectListCommand;
