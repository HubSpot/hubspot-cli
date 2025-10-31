import { trackUsage } from '@hubspot/local-dev-lib/trackUsage';
import {
  isTrackingAllowed,
  getAccountConfig,
} from '@hubspot/local-dev-lib/config';
import { API_KEY_AUTH_METHOD } from '@hubspot/local-dev-lib/constants/auth';
import { uiLogger } from './ui/logger.js';
import { pkg } from './jsonLoader.js';
import { debugError } from './errorHandlers/index.js';

const version = pkg.version;

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

export const EventClass = {
  USAGE: 'USAGE',
  INTERACTION: 'INTERACTION',
  VIEW: 'VIEW',
  ACTIVATION: 'ACTIVATION',
};

export function getNodeVersionData(): {
  nodeVersion: string;
  nodeMajorVersion: string;
} {
  return {
    nodeVersion: process.version,
    nodeMajorVersion: (process.version || '').split('.')[0],
  };
}

export function getPlatform(): string {
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
  if (!isTrackingAllowed()) {
    return;
  }

  uiLogger.debug(`Attempting to track usage of "${command}" command`);
  let authType = 'unknown';

  if (accountId) {
    const accountConfig = getAccountConfig(accountId);
    authType =
      accountConfig && accountConfig.authType
        ? accountConfig.authType
        : API_KEY_AUTH_METHOD.value;
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
  if (!isTrackingAllowed()) {
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
  meta: Meta = {},
  accountId?: number
): Promise<void> {
  if (!isTrackingAllowed()) {
    return;
  }
  uiLogger.debug(`Attempting to track metadata usage of "${command}" command`);
  let authType = 'unknown';
  if (accountId) {
    const accountConfig = getAccountConfig(accountId);
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
  meta?: Meta;
}): Promise<void> {
  try {
    if (!isTrackingAllowed()) {
      return;
    }

    const usageTrackingEvent = {
      action,
      os: getPlatform(),
      ...getNodeVersionData(),
      version,
      command,
      authType,
      ...meta,
    };

    if (process.env.HUBSPOT_MCP_AI_AGENT) {
      try {
        await trackUsage(
          'cli-interaction',
          EventClass.INTERACTION,
          {
            ...usageTrackingEvent,
            action: 'cli-mcp-server',
            type: process.env.HUBSPOT_MCP_AI_AGENT,
          },
          accountId
        );
        uiLogger.debug('Sent AI usage tracking command event:', {
          ...usageTrackingEvent,
          action: 'cli-mcp-server',
          type: process.env.HUBSPOT_MCP_AI_AGENT,
        });
      } catch (error) {
        debugError(error);
      }
    }

    try {
      uiLogger.debug('Sent usage tracking command event:', usageTrackingEvent);
      return trackUsage(
        'cli-interaction',
        EventClass.INTERACTION,
        usageTrackingEvent,
        accountId
      );
    } catch (error) {
      debugError(error);
    }
  } catch (e) {
    debugError(e);
  }
}
