import { trackUsage } from '@hubspot/local-dev-lib/trackUsage';
import {
  getConfig,
  getConfigAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { API_KEY_AUTH_METHOD } from '@hubspot/local-dev-lib/constants/auth';
import { logger } from '@hubspot/local-dev-lib/logger';
import { version } from '../package.json';
import { debugError } from './errorHandlers';

type Meta = {
  action?: string; // "The specific action taken in the CLI"
  os?: string; // "The user's OS"
  nodeVersion?: string; // "The user's version of node.js"
  nodeMajorVersion?: string; // "The user's major version of node.js"
  version?: string; // "The user's version of the CLI"
  command?: string; //  "The specific command that the user ran in this interaction"
  authType?: string; // "The configured auth type the user has for the CLI"
  step?: string; // "The specific step in the process"
  assetType?: string; // "The  asset type"
  mode?: string; // "The CMS publish mode (draft or publish)"
  type?: string | number; // "The upload type"
  file?: boolean; // "Whether or not the 'file' flag was used"
  successful?: boolean; // "Whether or not the CLI interaction was successful"
};

const EventClass = {
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

export async function trackCommandUsage(
  command: string,
  meta: Meta = {},
  accountId?: number
): Promise<void> {
  const config = getConfig();

  if (!config.allowUsageTracking) {
    return;
  }
  logger.debug('Attempting to track usage of "%s" command', command);
  let authType = 'unknown';
  if (accountId) {
    const account = getConfigAccountIfExists(accountId);
    authType =
      account && account.authType
        ? account.authType
        : API_KEY_AUTH_METHOD.value;
  }
  setImmediate(async () => {
    const usageTrackingEvent = {
      action: 'cli-command',
      os: getPlatform(),
      ...getNodeVersionData(),
      version,
      command,
      authType,
      ...meta,
    };
    try {
      await trackUsage(
        'cli-interaction',
        EventClass.INTERACTION,
        usageTrackingEvent,
        accountId
      );
      logger.debug('Sent usage tracking command event: %o', usageTrackingEvent);
    } catch (e) {
      debugError(e);
    }
  });
}

export async function trackHelpUsage(command: string): Promise<void> {
  const config = getConfig();

  if (!config.allowUsageTracking) {
    return;
  }
  try {
    if (command) {
      logger.debug('Tracking help usage of "%s" sub-command', command);
    } else {
      logger.debug('Tracking help usage of main command');
    }
    await trackUsage('cli-interaction', EventClass.INTERACTION, {
      action: 'cli-help',
      os: getPlatform(),
      ...getNodeVersionData(),
      version,
      command,
    });
  } catch (e) {
    debugError(e);
  }
}

export async function trackConvertFieldsUsage(command: string): Promise<void> {
  const config = getConfig();

  if (!config.allowUsageTracking) {
    return;
  }
  try {
    logger.debug('Attempting to track usage of "%s" command', command);
    await trackUsage('cli-interaction', EventClass.INTERACTION, {
      action: 'cli-process-fields',
      os: getPlatform(),
      ...getNodeVersionData(),
      version,
      command,
    });
  } catch (e) {
    debugError(e);
  }
}

export async function trackAuthAction(
  command: string,
  authType: string,
  step: string,
  accountId?: number
): Promise<void> {
  const config = getConfig();

  if (!config.allowUsageTracking) {
    return;
  }
  const usageTrackingEvent = {
    action: 'cli-auth',
    os: getPlatform(),
    ...getNodeVersionData(),
    version,
    command,
    authType,
    step,
  };
  try {
    await trackUsage(
      'cli-interaction',
      EventClass.INTERACTION,
      usageTrackingEvent,
      accountId
    );

    logger.debug('Sent usage tracking command event: %o', usageTrackingEvent);
  } catch (e) {
    debugError(e);
  }
}

export async function trackCommandMetadataUsage(
  command: string,
  meta: Meta = {},
  accountId?: number
): Promise<void> {
  const config = getConfig();

  if (!config.allowUsageTracking) {
    return;
  }
  logger.debug('Attempting to track metadata usage of "%s" command', command);
  let authType = 'unknown';
  if (accountId) {
    const account = getConfigAccountIfExists(accountId);
    authType =
      account && account.authType
        ? account.authType
        : API_KEY_AUTH_METHOD.value;
  }
  setImmediate(async () => {
    const usageTrackingEvent = {
      action: 'cli-command-metadata',
      os: getPlatform(),
      ...getNodeVersionData(),
      version,
      command,
      authType,
      ...meta,
    };
    try {
      await trackUsage(
        'cli-interaction',
        EventClass.INTERACTION,
        usageTrackingEvent,
        accountId
      );
      logger.debug('Sent usage tracking command event: %o', usageTrackingEvent);
    } catch (e) {
      debugError(e);
    }
  });
}
