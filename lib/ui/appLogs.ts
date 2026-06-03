import moment from 'moment';
import chalk from 'chalk';
import { Styles } from '@hubspot/local-dev-lib/logger';
import { AppLogDetails } from '@hubspot/local-dev-lib/types/AppLogs';
import { uiLogger } from './logger.js';
import { indent, uiLine } from './index.js';
import { commands } from '../../lang/en.js';
import { SYSTEM_TYPE_DISPLAY_NAMES, toTypeChoice } from '../app/logs.js';
import { getAppLogDetailsUrl, getAppLogsUrl } from '../app/urls.js';
import { renderTable } from '../../ui/render.js';

const SEPARATOR = ' - ';

function formatJsonBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

const LOG_STATUS_COLORS: { [key: string]: (status: string) => string } = {
  SUCCESS: Styles.success,
  ERROR: Styles.error,
};

type AppLogEntry = {
  id: string;
  createdAt: number;
  executionTimeMillis?: number;
  portalId?: number;
  traceId?: string;
  status: 'SUCCESS' | 'ERROR';
  errorType?: string;
  errorMessage?: string;
};

type AppLogsSearchResponse = {
  results: AppLogEntry[];
  hasMore: boolean;
  offset: number;
  total: number;
};

type OutputOptions = {
  compact?: boolean;
  tail?: boolean;
  accountId: number;
  appId: number;
  systemType: string;
  typeName: string;
};

function formatLogHeader(log: AppLogEntry, options: OutputOptions): string {
  const color = LOG_STATUS_COLORS[log.status] || ((s: string) => s);
  const timestamp = chalk.whiteBright(moment(log.createdAt).toISOString());
  const status = color(log.status);

  if (options.compact) {
    const parts = [timestamp, status];
    if (log.executionTimeMillis != null) {
      parts.push(`${log.executionTimeMillis}ms`);
    }
    parts.push(log.id);
    return parts.join(SEPARATOR);
  }

  return `${timestamp}${SEPARATOR}${status}`;
}

function formatLogDetails(log: AppLogEntry, options: OutputOptions): string {
  if (options.compact) {
    return '';
  }

  const lines: string[] = [];

  lines.push(
    `${indent(1)}${commands.app.subcommands.logs.outputMessages.logDetails.id}: ${log.id}`
  );

  if (log.executionTimeMillis != null) {
    lines.push(
      `${indent(1)}${commands.app.subcommands.logs.outputMessages.logDetails.duration}: ${log.executionTimeMillis}ms`
    );
  }

  if (log.portalId != null) {
    lines.push(
      `${indent(1)}${commands.app.subcommands.logs.outputMessages.logDetails.portal}: ${log.portalId}`
    );
  }

  if (log.traceId != null && log.traceId !== '') {
    lines.push(
      `${indent(1)}${commands.app.subcommands.logs.outputMessages.logDetails.trace}: ${log.traceId}`
    );
  }

  if (log.status === 'ERROR' && log.errorType) {
    lines.push(
      `${indent(1)}${commands.app.subcommands.logs.outputMessages.logDetails.error}: ${log.errorType}`
    );
    if (log.errorMessage) {
      lines.push(`${indent(2)}${log.errorMessage}`);
    }
  }

  const detailUrl = getAppLogDetailsUrl(
    options.accountId,
    options.appId,
    options.systemType,
    log.id
  );
  lines.push(
    `${indent(1)}${commands.app.subcommands.logs.outputMessages.logDetails.viewDetails(log.id, options.appId, toTypeChoice(options.systemType))}`
  );
  lines.push(
    `${indent(1)}${commands.app.subcommands.logs.outputMessages.logDetails.viewInUI(detailUrl)}`
  );

  return lines.join(`\n${indent(1)}`);
}

function formatLog(log: AppLogEntry, options: OutputOptions): string {
  const header = formatLogHeader(log, options);
  const details = formatLogDetails(log, options);

  return details ? `${header}\n${details}` : header;
}

export async function outputAppLogs(
  response: AppLogsSearchResponse,
  options: OutputOptions
): Promise<void> {
  const { results, total } = response;

  if (results.length === 0) {
    uiLogger.log(commands.app.subcommands.logs.errors.noLogs);
    return;
  }

  results.forEach(log => {
    uiLogger.log(formatLog(log, options));
    if (!options.compact) {
      uiLogger.log('');
    }
  });

  if (!options.compact && !options.tail) {
    uiLine();
    uiLogger.log('');

    const tableHeaders = [
      commands.app.subcommands.logs.outputMessages.tableHeaders.appId,
      commands.app.subcommands.logs.outputMessages.tableHeaders.type,
      commands.app.subcommands.logs.outputMessages.tableHeaders.logsFound,
    ];
    const tableData = [
      [options.appId.toString(), options.typeName, total.toString()],
    ];

    await renderTable(tableHeaders, tableData, true);
    uiLogger.log('');

    const listUrl = getAppLogsUrl(
      options.accountId,
      options.appId,
      options.systemType
    );
    uiLogger.log(
      commands.app.subcommands.logs.outputMessages.viewInHubSpot(listUrl)
    );
  }
}

type LogDetailsOutputOptions = {
  accountId: number;
  appId: number;
};

export function outputAppLogDetails(
  details: AppLogDetails,
  options: LogDetailsOutputOptions
): void {
  const status = details.errorType ? 'ERROR' : 'SUCCESS';
  const color = LOG_STATUS_COLORS[status] || ((s: string) => s);

  uiLogger.log(
    chalk.bold(
      commands.app.subcommands.logDetails.outputMessages.logDetailsHeader
    )
  );
  uiLogger.log('');

  uiLogger.log(
    `${commands.app.subcommands.logDetails.outputMessages.basicInfo.id}: ${details.id}`
  );
  uiLogger.log(
    `${commands.app.subcommands.logDetails.outputMessages.basicInfo.timestamp}: ${chalk.whiteBright(
      moment(details.requestExecutionTimestamp).toISOString()
    )}`
  );
  uiLogger.log(
    `${commands.app.subcommands.logDetails.outputMessages.basicInfo.status}: ${color(status)}`
  );

  if (details.duration != null) {
    uiLogger.log(
      `${commands.app.subcommands.logDetails.outputMessages.basicInfo.duration}: ${details.duration}ms`
    );
  }

  if (details.loggingSystemType) {
    const typeName =
      SYSTEM_TYPE_DISPLAY_NAMES[details.loggingSystemType] ||
      details.loggingSystemType;
    uiLogger.log(
      `${commands.app.subcommands.logDetails.outputMessages.basicInfo.systemType}: ${typeName}`
    );
  }

  const hasContextInfo =
    details.portalId ||
    details.traceId ||
    details.serverlessFunction ||
    details.location ||
    details.cardName;

  if (hasContextInfo) {
    uiLogger.log('');
    uiLogger.log(
      chalk.bold(
        commands.app.subcommands.logDetails.outputMessages.contextInfo.header
      )
    );

    if (details.portalId) {
      uiLogger.log(
        `${indent(1)}${commands.app.subcommands.logDetails.outputMessages.contextInfo.portalId}: ${details.portalId}`
      );
    }

    if (details.traceId) {
      uiLogger.log(
        `${indent(1)}${commands.app.subcommands.logDetails.outputMessages.contextInfo.traceId}: ${details.traceId}`
      );
    }

    if (details.serverlessFunction) {
      uiLogger.log(
        `${indent(1)}${commands.app.subcommands.logDetails.outputMessages.contextInfo.function}: ${details.serverlessFunction}`
      );
    }

    if (details.location) {
      uiLogger.log(
        `${indent(1)}${commands.app.subcommands.logDetails.outputMessages.contextInfo.location}: ${details.location}`
      );
    }

    if (details.cardName) {
      uiLogger.log(
        `${indent(1)}${commands.app.subcommands.logDetails.outputMessages.contextInfo.card}: ${details.cardName}`
      );
    }

    if (details.userId) {
      uiLogger.log(
        `${indent(1)}${commands.app.subcommands.logDetails.outputMessages.contextInfo.userId}: ${details.userId}`
      );
    }
  }

  if (details.requestBody || details.responseBody) {
    uiLogger.log('');
    uiLogger.log(
      chalk.bold(
        commands.app.subcommands.logDetails.outputMessages.requestResponse
          .header
      )
    );

    if (details.requestBody) {
      uiLogger.log(
        `${indent(1)}${commands.app.subcommands.logDetails.outputMessages.requestResponse.requestBody}:`
      );
      uiLogger.log(chalk.gray(formatJsonBody(details.requestBody)));
    }

    if (details.responseBody) {
      uiLogger.log(
        `${indent(1)}${commands.app.subcommands.logDetails.outputMessages.requestResponse.responseBody}:`
      );
      uiLogger.log(chalk.gray(formatJsonBody(details.responseBody)));
    }
  }

  if (details.errorType || details.errorMessage) {
    uiLogger.log('');
    uiLogger.log(
      chalk.bold(
        commands.app.subcommands.logDetails.outputMessages.errorInfo.header
      )
    );

    if (details.errorType) {
      uiLogger.log(
        `${indent(1)}${commands.app.subcommands.logDetails.outputMessages.errorInfo.errorType}: ${Styles.error(details.errorType)}`
      );
    }

    if (details.errorMessage) {
      uiLogger.log(
        `${indent(1)}${commands.app.subcommands.logDetails.outputMessages.errorInfo.errorMessage}: ${details.errorMessage}`
      );
    }
  }

  if (details.extraInfo && Object.keys(details.extraInfo).length > 0) {
    uiLogger.log('');
    uiLogger.log(
      chalk.bold(
        commands.app.subcommands.logDetails.outputMessages.additionalInfo.header
      )
    );
    Object.entries(details.extraInfo).forEach(([key, value]) => {
      uiLogger.log(`${indent(1)}${key}: ${value}`);
    });
  }

  uiLogger.log('');
  uiLine();
  uiLogger.log('');

  const detailUrl = getAppLogDetailsUrl(
    options.accountId,
    options.appId,
    details.loggingSystemType,
    details.id
  );
  uiLogger.log(
    commands.app.subcommands.logDetails.outputMessages.viewInHubSpot(detailUrl)
  );
}
