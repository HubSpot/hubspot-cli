import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { getStateValue } from '@hubspot/local-dev-lib/config/state';
import { STATE_FLAGS } from '@hubspot/local-dev-lib/constants/config';
import { commands } from '../../lang/en.js';
import { debugError } from '../errorHandlers/index.js';
import { shouldShowHint, showHint, type Hint } from '../hints/hints.js';
import { trackMcpPromotionShown } from '../usageTracking.js';
import { MCP_CLIENTS, MCP_SERVER_NAME } from './clients.js';

const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function configContainsMcpServer(value: unknown): boolean {
  if (typeof value === 'string') {
    return value === MCP_SERVER_NAME;
  }

  if (Array.isArray(value)) {
    return value.some(configContainsMcpServer);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(([key, childValue]) => {
    return key === MCP_SERVER_NAME || configContainsMcpServer(childValue);
  });
}

function textConfigContainsMcpServer(configContent: string): boolean {
  return configContent.includes(MCP_SERVER_NAME);
}

function jsonConfigContainsMcpServer(configContent: string): boolean {
  const parsedConfig = JSON.parse(configContent);
  return configContainsMcpServer(parsedConfig);
}

export function detectConfiguredMcpClients(): string[] {
  const homeDirectory = os.homedir();

  return MCP_CLIENTS.reduce<string[]>((clients, client) => {
    try {
      const configPath = path.join(
        homeDirectory,
        ...client.detection.pathSegments
      );
      if (!fs.existsSync(configPath)) {
        return clients;
      }

      const configContent = fs.readFileSync(configPath, 'utf8');
      const hasMcpServer =
        client.detection.type === 'json'
          ? jsonConfigContainsMcpServer(configContent)
          : textConfigContainsMcpServer(configContent);

      if (hasMcpServer) {
        clients.push(client.id);
      }
    } catch (e) {
      debugError(e);
      return clients;
    }

    return clients;
  }, []);
}

function isMcpPromotionApplicable(): boolean {
  if (process.env.HUBSPOT_MCP_AI_AGENT) {
    return false;
  }

  const mcpTotalToolCalls = getStateValue(STATE_FLAGS.MCP_TOTAL_TOOL_CALLS);
  if (typeof mcpTotalToolCalls === 'number' && mcpTotalToolCalls > 0) {
    return false;
  }

  return detectConfiguredMcpClients().length === 0;
}

const MCP_PROMOTION_HINT: Hint = {
  lastShownFlag: STATE_FLAGS.MCP_PROMOTION_LAST_SHOWN_AT,
  cooldownMs: ONE_WEEK_IN_MS,
  message: commands.mcp.promotion.activeNudge,
  isApplicable: isMcpPromotionApplicable,
};

export async function shouldShowMcpPromotion(): Promise<boolean> {
  try {
    return shouldShowHint(MCP_PROMOTION_HINT);
  } catch (e) {
    debugError(e);
    return false;
  }
}

export async function showMcpPromotionNudge(
  commandName: string
): Promise<void> {
  try {
    if (!showHint(MCP_PROMOTION_HINT)) {
      return;
    }

    await trackMcpPromotionShown(commandName || undefined);
  } catch (e) {
    debugError(e);
  }
}
