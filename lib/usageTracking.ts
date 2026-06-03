import {
  getConfig,
  getConfigAccountById,
  getConfigFilePath,
  getGlobalConfigFilePath,
} from '@hubspot/local-dev-lib/config';
import {
  API_KEY_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
} from '@hubspot/local-dev-lib/constants/auth';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { uiLogger } from './ui/logger.js';
import { pkg } from './jsonLoader.js';
import { debugError } from './errorHandlers/index.js';
import { isUsageTrackingDisableFlagSet } from './middleware/usageTrackingMiddleware.js';
import {
  sendUsageEvent,
  type UsageTrackingMeta,
  type ConfigType,
  type ExecutionSource,
  type UsageTrackingRequest,
} from './api/usageTracking.js';

export type {
  UsageTrackingMeta,
  ConfigType,
  ExecutionSource,
} from './api/usageTracking.js';

const version = pkg.version;
const usageTrackingDiabled =
  'Usage tracking is disabled via the --disable-usage-tracking flag, not sending usage events';

export const EventClass = {
  USAGE: 'USAGE',
  INTERACTION: 'INTERACTION',
  VIEW: 'VIEW',
  ACTIVATION: 'ACTIVATION',
};

function getNodeVersionData(): {
  nodeVersion: string;
  nodeMajorVersion: string;
} {
  return {
    nodeVersion: process.version,
    nodeMajorVersion: (process.version || '').split('.')[0],
  };
}

function getPlatform(): string {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      return process.platform;
  }
}

function getConfigType(): ConfigType | undefined {
  try {
    return getConfigFilePath() === getGlobalConfigFilePath()
      ? 'global'
      : 'local';
  } catch (_e) {
    return undefined;
  }
}

function getExecutionSource(): ExecutionSource {
  if (process.env.HUBSPOT_MCP_AI_AGENT) {
    return 'mcp';
  }
  if (process.env.CI) {
    return 'ci';
  }
  return 'user';
}

export function getExecutionEnvironmentMeta(): {
  os: string;
  nodeVersion: string;
  nodeMajorVersion: string;
  version: string;
  configType?: ConfigType;
  executionSource: ExecutionSource;
} {
  return {
    os: getPlatform(),
    ...getNodeVersionData(),
    version,
    configType: getConfigType(),
    executionSource: getExecutionSource(),
  };
}

async function getUsageTrackingUserId(
  accountId?: number
): Promise<number | undefined> {
  if (!accountId) {
    return undefined;
  }

  try {
    const accountConfig = getConfigAccountById(accountId);
    if (accountConfig.authType !== PERSONAL_ACCESS_KEY_AUTH_METHOD.value) {
      return undefined;
    }

    const accessToken = await getAccessToken(
      accountConfig.personalAccessKey,
      accountConfig.env,
      accountConfig.accountId
    );

    return typeof accessToken.userId === 'number'
      ? accessToken.userId
      : undefined;
  } catch (_e) {
    return undefined;
  }
}

export async function trackCommandUsage(
  command: string,
  meta: UsageTrackingMeta = {},
  accountId?: number
): Promise<void> {
  if (isUsageTrackingDisableFlagSet()) {
    uiLogger.debug(usageTrackingDiabled);
    return;
  }

  try {
    const config = getConfig();
    if (config?.allowUsageTracking === false) {
      return;
    }
  } catch (e) {}

  uiLogger.debug(`Attempting to track usage of "${command}" command`);
  let authType = 'unknown';

  if (accountId) {
    try {
      const accountConfig = getConfigAccountById(accountId);
      authType =
        accountConfig && accountConfig.authType
          ? accountConfig.authType
          : API_KEY_AUTH_METHOD.value;
    } catch (e) {}
  }

  return trackCliInteraction({
    action: 'cli-command',
    command,
    authType,
    meta,
    accountId,
  });
}

export async function trackHelpUsage(command: string): Promise<void> {
  if (isUsageTrackingDisableFlagSet()) {
    uiLogger.debug(usageTrackingDiabled);
    return;
  }

  const config = getConfig();
  if (config?.allowUsageTracking === false) {
    return;
  }
  if (command) {
    uiLogger.debug(`Tracking help usage of "${command}" sub-command`);
  } else {
    uiLogger.debug('Tracking help usage of main command');
  }

  return trackCliInteraction({
    action: 'cli-help',
    command,
  });
}

export async function trackConvertFieldsUsage(command: string): Promise<void> {
  return trackCliInteraction({
    action: 'cli-process-fields',
    command,
  });
}

export async function trackAuthAction(
  command: string,
  authType: string,
  step: string,
  accountId?: number
): Promise<void> {
  return trackCliInteraction({
    action: 'cli-auth',
    command,
    authType,
    accountId,
    meta: {
      step,
    },
  });
}

export async function trackCommandMetadataUsage(
  command: string,
  meta: UsageTrackingMeta = {},
  accountId?: number
): Promise<void> {
  if (isUsageTrackingDisableFlagSet()) {
    uiLogger.debug(usageTrackingDiabled);
    return;
  }

  const config = getConfig();
  if (config?.allowUsageTracking === false) {
    return;
  }
  uiLogger.debug(`Attempting to track metadata usage of "${command}" command`);
  let authType = 'unknown';
  if (accountId) {
    const accountConfig = getConfigAccountById(accountId);
    authType =
      accountConfig && accountConfig.authType
        ? accountConfig.authType
        : API_KEY_AUTH_METHOD.value;
  }

  return trackCliInteraction({
    action: 'cli-command-metadata',
    command,
    authType,
    accountId,
    meta,
  });
}

async function trackCliInteraction({
  action,
  accountId,
  command,
  authType,
  meta = {},
}: {
  action: string;
  accountId?: number;
  command?: string;
  authType?: string;
  meta?: UsageTrackingMeta;
}): Promise<void> {
  try {
    const config = getConfig();
    if (config?.allowUsageTracking === false) {
      return;
    }

    if (isUsageTrackingDisableFlagSet()) {
      uiLogger.debug(usageTrackingDiabled);
      return;
    }

    const usageTrackingEvent = {
      action,
      command,
      authType,
      ...getExecutionEnvironmentMeta(),
      ...meta,
    };

    try {
      const userId = await getUsageTrackingUserId(accountId);
      const request: UsageTrackingRequest = {
        eventName: 'cli-interaction',
        eventClass: EventClass.INTERACTION,
        meta: usageTrackingEvent,
        accountId,
      };

      if (userId !== undefined) {
        request.userId = userId;
      }

      uiLogger.debug('Sent usage tracking command event:', usageTrackingEvent);
      await sendUsageEvent(request);
    } catch (error) {
      debugError(error);
    }
  } catch (e) {
    debugError(e);
  }
}
