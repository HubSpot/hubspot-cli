import { trackUsage } from '@hubspot/local-dev-lib/trackUsage';
import {
  EventClass,
  getNodeVersionData,
  getPlatform,
} from '../../lib/usageTracking.js';
import {
  getConfig,
  getConfigDefaultAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { uiLogger } from '../../lib/ui/logger.js';

export async function trackToolUsage(
  toolName: string,
  meta?: {
    [key: string]: string;
  }
): Promise<void> {
  const config = getConfig();
  if (config?.allowUsageTracking === false) {
    return;
  }

  const usageTrackingEvent = {
    action: 'cli-mcp-tool-invocation',
    os: getPlatform(),
    ...getNodeVersionData(),
    command: toolName,
    type: process.env.HUBSPOT_MCP_AI_AGENT,
    ...meta,
  };

  const accountId = getConfigDefaultAccountIfExists()?.accountId || undefined;
  try {
    uiLogger.info('Tracking tool usage');
    await trackUsage(
      'cli-interaction',
      EventClass.INTERACTION,
      usageTrackingEvent,
      accountId
    );
  } catch (error) {}
}
