import moment from 'moment';
import {
  AppLogEntry as ApiAppLogEntry,
  LogSearchQuery,
  SearchLogsRequest,
  SystemType,
} from '@hubspot/local-dev-lib/types/AppLogs';
import {
  getAppLogDetails,
  searchAppLogs,
} from '@hubspot/local-dev-lib/api/appLogs';
import { outputAppLogDetails, outputAppLogs } from '../ui/appLogs.js';
import { uiLogger } from '../ui/logger.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { handleExit, handleKeypress } from '../process.js';
import { commands } from '../../lang/en.js';

export const SYSTEM_TYPE_DISPLAY_NAMES: { [key: string]: string } = {
  WEBHOOKS: 'Webhooks',
  API_CALL: 'API Call',
  SERVERLESS_EXECUTION: 'Serverless Function',
  CRM_EXTENSIBILITY_CARD: 'CRM Card',
  CRM_LEGACY_CARD: 'CRM Legacy Card',
  EXTENSION_LOG: 'Extension Log',
  EXTENSION_RENDER: 'Extension Render',
  APP_SETTINGS: 'App Settings',
  PROXY_EXECUTION: 'Proxy Execution',
  SERVERLESS_GATEWAY_EXECUTION: 'Serverless Gateway Execution',
  ACCEPTANCE_TEST: 'Acceptance Test',
  OAUTH_AUTHORIZATION: 'OAuth Authorization',
};

export const SYSTEM_TYPE_CHOICES = Object.keys(SYSTEM_TYPE_DISPLAY_NAMES).map(
  toTypeChoice
);

export function parseSinceTime(sinceInput: string): {
  startTime: number;
  endTime: number;
} {
  const now = moment();
  const relativeTimePattern = /^(\d+)([mhd])$/;
  const match = sinceInput.match(relativeTimePattern);

  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];

    let startTime: moment.Moment;
    switch (unit) {
      case 'm':
        startTime = now.clone().subtract(value, 'minutes');
        break;
      case 'h':
        startTime = now.clone().subtract(value, 'hours');
        break;
      case 'd':
        startTime = now.clone().subtract(value, 'days');
        break;
      default:
        throw new Error(`Invalid time unit: ${unit}`);
    }

    return {
      startTime: startTime.valueOf(),
      endTime: now.valueOf(),
    };
  }

  const isoTime = moment(sinceInput);
  if (isoTime.isValid()) {
    return {
      startTime: isoTime.valueOf(),
      endTime: now.valueOf(),
    };
  }

  throw new Error(`Invalid time format: ${sinceInput}`);
}

export function transformApiLogEntry(apiLog: ApiAppLogEntry): {
  id: string;
  createdAt: number;
  executionTimeMillis?: number;
  portalId?: number;
  traceId?: string;
  status: 'SUCCESS' | 'ERROR';
  errorType?: string;
  errorMessage?: string;
} {
  return {
    id: apiLog.id,
    createdAt: apiLog.requestExecutionTimestamp,
    executionTimeMillis: apiLog.duration,
    portalId: apiLog.portalId,
    traceId: apiLog.traceId,
    status: apiLog.errorType ? 'ERROR' : 'SUCCESS',
    errorType: apiLog.errorType,
    errorMessage: apiLog.errorMessage as string | undefined,
  };
}

export type AppLogsOptions = {
  since?: string;
  compact?: boolean;
  json?: boolean;
  limit?: number;
  errorsOnly?: boolean;
};

const TAIL_DELAY = 5000;

export function toTypeChoice(systemType: string): string {
  return systemType.toLowerCase().replaceAll('_', '-');
}

export function toSystemType(choice: string): string {
  return choice.toUpperCase().replaceAll('-', '_');
}

export function getTypeChoices(): { name: string; value: string }[] {
  return Object.entries(SYSTEM_TYPE_DISPLAY_NAMES).map(([key, name]) => ({
    name,
    value: key,
  }));
}

function buildTransformedResponse(data: {
  results: ApiAppLogEntry[];
  paging?: { next?: { after?: string } };
}) {
  return {
    results: data.results.map(transformApiLogEntry),
    hasMore: !!data.paging?.next,
    offset: 0,
    total: data.results.length,
  };
}

export const handleLogsRequest = async (
  accountId: number,
  appId: number,
  systemType: string,
  options: AppLogsOptions
): Promise<void> => {
  const { since, compact, json, limit, errorsOnly } = options;
  const resolvedLimit = limit ?? 50;

  let timeRange: { startTime: number; endTime: number } | undefined;
  if (since) {
    timeRange = parseSinceTime(since);
  }

  const query: LogSearchQuery = {
    loggingSystemType: systemType as SystemType,
    limit: resolvedLimit,
    offset: 0,
    errorTypes: errorsOnly ? ['*'] : [],
    resultsOrder: 'DESC',
    ...timeRange,
  };

  const requestBody: SearchLogsRequest = {
    query,
    limit: resolvedLimit,
  };

  const { data } = await searchAppLogs(accountId, appId, requestBody);

  if (json) {
    uiLogger.json(data);
  } else {
    await outputAppLogs(buildTransformedResponse(data), {
      compact: !!compact,
      accountId,
      appId,
      systemType,
      typeName: SYSTEM_TYPE_DISPLAY_NAMES[systemType],
    });
  }
};

export const tailAppLogs = async (
  accountId: number,
  appId: number,
  systemType: string,
  options: AppLogsOptions
): Promise<void> => {
  const { compact, since, errorsOnly } = options;
  let currentAfter: string | undefined;
  let currentStartTime: number | undefined;

  if (since) {
    currentStartTime = parseSinceTime(since).startTime;
  }

  return new Promise<void>(resolve => {
    function cleanup(): void {
      SpinniesManager.remove('tailLogs');
      SpinniesManager.remove('stopMessage');
    }

    let resolved = false;
    // eslint-disable-next-line prefer-const -- assigned after onTerminate is defined due to circular reference
    let removeExitListeners: (() => void) | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const onTerminate = async () => {
      if (resolved) return;
      resolved = true;
      removeExitListeners?.();
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      cleanup();
      resolve();
    };

    removeExitListeners = handleExit(onTerminate);
    handleKeypress(key => {
      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        onTerminate();
      }
    });

    async function tail(): Promise<void> {
      try {
        const query: LogSearchQuery = {
          loggingSystemType: systemType as SystemType,
          limit: 50,
          offset: 0,
          errorTypes: errorsOnly ? ['*'] : [],
          resultsOrder: 'ASC',
          ...(currentStartTime !== undefined && {
            startTime: currentStartTime,
          }),
        };

        const requestBody: SearchLogsRequest = {
          query,
          limit: 50,
          ...(currentAfter && { after: currentAfter }),
        };

        const { data } = await searchAppLogs(accountId, appId, requestBody);

        if (data.results && data.results.length > 0) {
          await outputAppLogs(buildTransformedResponse(data), {
            compact: !!compact,
            tail: true,
            accountId,
            appId,
            systemType,
            typeName: SYSTEM_TYPE_DISPLAY_NAMES[systemType],
          });

          if (data.paging?.next?.after) {
            currentAfter = data.paging.next.after;
          } else {
            const lastResult = data.results[data.results.length - 1];
            currentStartTime = lastResult.requestExecutionTimestamp + 1;
            currentAfter = undefined;
          }
        }

        timeoutHandle = setTimeout(() => {
          tail();
        }, TAIL_DELAY);
      } catch (e) {
        await onTerminate();
        throw e;
      }
    }

    const tailCopy = commands.app.subcommands.logs.outputMessages.tailMessages;
    SpinniesManager.add('tailLogs', {
      text: tailCopy.following(appId),
    });
    SpinniesManager.add('stopMessage', {
      text: tailCopy.stop,
      status: 'non-spinnable',
    });

    void tail();
  });
};

export type LogDetailsOptions = {
  json?: boolean;
};

export const handleLogDetailsRequest = async (
  accountId: number,
  appId: number,
  logId: string,
  systemType: SystemType,
  options: LogDetailsOptions
): Promise<void> => {
  const { json } = options;

  const { data } = await getAppLogDetails(accountId, appId, systemType, logId);

  if (json) {
    uiLogger.json(data);
  } else {
    outputAppLogDetails(data.log, {
      accountId,
      appId,
    });
  }
};
