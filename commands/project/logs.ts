import { Argv, ArgumentsCamelCase } from 'yargs';
import { getEnv } from '@hubspot/local-dev-lib/config';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { ENVIRONMENTS } from '@hubspot/local-dev-lib/constants/environments';
import { logger } from '@hubspot/local-dev-lib/logger';
import { trackCommandUsage } from '../../lib/usageTracking';
import { getTableContents, getTableHeader } from '../../lib/ui/table';
import { logError } from '../../lib/errorHandlers/';
import { uiBetaTag, uiLine, uiLink } from '../../lib/ui';
import { projectLogsPrompt } from '../../lib/prompts/projectsLogsPrompt';
import { i18n } from '../../lib/lang';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import { ProjectLogsManager } from '../../lib/projects/ProjectLogsManager';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const i18nKey = 'commands.project.subcommands.logs';

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
  logger.log(i18n(`${i18nKey}.logs.showingLogs`));
  logger.log(
    getTableContents([tableHeader, logsInfo], { border: { bodyLeft: '  ' } })
  );
}

function logPreamble(): void {
  if (ProjectLogsManager.isPublicFunction) {
    logTable(
      getTableHeader([
        i18n(`${i18nKey}.table.accountHeader`),
        i18n(`${i18nKey}.table.functionHeader`),
        i18n(`${i18nKey}.table.endpointHeader`),
      ]),
      [
        ProjectLogsManager.accountId,
        ProjectLogsManager.functionName,
        ProjectLogsManager.endpointName,
      ]
    );
    logger.log(
      uiLink(
        i18n(`${i18nKey}.logs.hubspotLogsDirectLink`),
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
        i18n(`${i18nKey}.table.accountHeader`),
        i18n(`${i18nKey}.table.functionHeader`),
      ]),
      [ProjectLogsManager.accountId, ProjectLogsManager.functionName]
    );
    logger.log(
      uiLink(
        i18n(`${i18nKey}.logs.hubspotLogsDirectLink`),
        `${getPrivateAppsUrl(ProjectLogsManager.accountId!)}/${
          ProjectLogsManager.appId
        }/logs/crm?serverlessFunction=${ProjectLogsManager.functionName}`
      )
    );
  }
  logger.log();
  uiLine();
}

const command = 'logs';
const describe = uiBetaTag(i18n(`${i18nKey}.describe`), false);

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
      describe: i18n(`${i18nKey}.options.function.describe`),
      requiresArg: true,
      type: 'string',
    },
    latest: {
      alias: 'l',
      describe: i18n(`${i18nKey}.options.latest.describe`),
      type: 'boolean',
    },
    compact: {
      describe: i18n(`${i18nKey}.options.compact.describe`),
      type: 'boolean',
    },
    tail: {
      alias: ['t', 'follow'],
      describe: i18n(`${i18nKey}.options.tail.describe`),
      type: 'boolean',
    },
    limit: {
      describe: i18n(`${i18nKey}.options.limit.describe`),
      type: 'number',
    },
  });

  yargs.conflicts('tail', 'limit');

  yargs.example([
    ['$0 project logs', i18n(`${i18nKey}.examples.default`)],
    [
      '$0 project logs --function=my-function',
      i18n(`${i18nKey}.examples.withOptions`),
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
