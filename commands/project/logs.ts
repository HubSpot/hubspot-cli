import { Argv, ArgumentsCamelCase } from 'yargs';
import { getEnv } from '@hubspot/local-dev-lib/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import { getTableContents, getTableHeader } from '../../lib/ui/table.js';
import { logError } from '../../lib/errorHandlers/index.js';
import { uiLine } from '../../lib/ui/index.js';
import { projectLogsPrompt } from '../../lib/prompts/projectsLogsPrompt.js';
import { commands } from '../../lang/en.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { ProjectLogsManager } from '../../lib/projects/ProjectLogsManager.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';

function getPrivateAppsUrl(accountId: number): string {
  const baseUrl = getHubSpotWebsiteOrigin(
    getEnv(accountId) === 'qa' ? ENVIRONMENTS.QA : ENVIRONMENTS.PROD
  );

  return `${baseUrl}/private-apps/${accountId}`;
}

function logTable(
  tableHeader: string[],
  logsInfo: (string | number | undefined)[]
): void {
  uiLogger.log(commands.project.logs.logs.showingLogs);
  uiLogger.log(
    getTableContents([tableHeader, logsInfo], { border: { bodyLeft: '  ' } })
  );
}

function logPreamble(): void {
  if (ProjectLogsManager.isPublicFunction) {
    logTable(
      getTableHeader([
        commands.project.logs.table.accountHeader,
        commands.project.logs.table.functionHeader,
        commands.project.logs.table.endpointHeader,
      ]),
      [
        ProjectLogsManager.accountId,
        ProjectLogsManager.functionName,
        ProjectLogsManager.endpointName,
      ]
    );
    uiLogger.log(
      commands.project.logs.logs.hubspotLogsDirectLink(
        `${getPrivateAppsUrl(ProjectLogsManager.accountId!)}/${
          ProjectLogsManager.appId
        }/logs/serverlessGatewayExecution?path=${
          ProjectLogsManager.endpointName
        }`
      )
    );
  } else {
    logTable(
      getTableHeader([
        commands.project.logs.table.accountHeader,
        commands.project.logs.table.functionHeader,
      ]),
      [ProjectLogsManager.accountId, ProjectLogsManager.functionName]
    );
    uiLogger.log(
      commands.project.logs.logs.hubspotLogsDirectLink(
        `${getPrivateAppsUrl(ProjectLogsManager.accountId!)}/${
          ProjectLogsManager.appId
        }/logs/crm?serverlessFunction=${ProjectLogsManager.functionName}`
      )
    );
  }
  uiLogger.log('');
  uiLine();
}

const command = 'logs';
const describe = commands.project.logs.describe;

export type ProjectLogsArgs = CommonArgs & {
  function?: string;
  latest?: boolean;
  compact?: boolean;
  tail?: boolean;
  limit?: number;
};

async function handler(
  args: ArgumentsCamelCase<ProjectLogsArgs>
): Promise<void> {
  const { derivedAccountId } = args;

  trackCommandUsage('project-logs', undefined, derivedAccountId);

  try {
    await ProjectLogsManager.init(derivedAccountId);

    const { functionName } = await projectLogsPrompt({
      functionChoices: ProjectLogsManager.getFunctionNames(),
      promptOptions: args,
      projectName: ProjectLogsManager.projectName,
    });

    ProjectLogsManager.setFunction(functionName);

    logPreamble();
  } catch (e) {
    logError(e, {
      accountId: derivedAccountId,
      projectName: ProjectLogsManager.projectName,
    });
    return process.exit(EXIT_CODES.ERROR);
  }
  process.exit(EXIT_CODES.SUCCESS);
}

function projectLogsBuilder(yargs: Argv): Argv<ProjectLogsArgs> {
  yargs.options({
    function: {
      alias: 'function',
      describe: commands.project.logs.options.function.describe,
      requiresArg: true,
      type: 'string',
    },
    latest: {
      alias: 'l',
      describe: commands.project.logs.options.latest.describe,
      type: 'boolean',
    },
    compact: {
      describe: commands.project.logs.options.compact.describe,
      type: 'boolean',
    },
    tail: {
      alias: ['t', 'follow'],
      describe: commands.project.logs.options.tail.describe,
      type: 'boolean',
    },
    limit: {
      describe: commands.project.logs.options.limit.describe,
      type: 'number',
    },
  });

  yargs.conflicts('tail', 'limit');

  yargs.example([
    ['$0 project logs', commands.project.logs.examples.default],
    [
      '$0 project logs --function=my-function',
      commands.project.logs.examples.withOptions,
    ],
  ]);

  return yargs as Argv<ProjectLogsArgs>;
}

const builder = makeYargsBuilder<ProjectLogsArgs>(
  projectLogsBuilder,
  command,
  describe,
  { useGlobalOptions: true, useEnvironmentOptions: true }
);

const projectLogsCommand: YargsCommandModule<unknown, ProjectLogsArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default projectLogsCommand;
