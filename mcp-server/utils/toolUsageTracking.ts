import { trackUsage } from '@hubspot/local-dev-lib/trackUsage';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  EventClass,
  getNodeVersionData,
  getPlatform,
} from '../../lib/usageTracking.js';
import { getAccountId, isTrackingAllowed } from '@hubspot/local-dev-lib/config';

export async function trackToolUsage(
  toolName: string,
  meta?: {
    [key: string]: string;
  }
): Promise<void> {
  if (!isTrackingAllowed()) {
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

  const accountId = getAccountId() || undefined;
  try {
    logger.info('Tracking tool usage');
    await trackUsage(
      'cli-interaction',
      EventClass.INTERACTION,
      usageTrackingEvent,
      accountId
    );
  } catch (error) {}
}
