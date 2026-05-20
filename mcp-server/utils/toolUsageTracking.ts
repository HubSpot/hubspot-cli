import {
  EventClass,
  getExecutionEnvironmentMeta,
} from '../../lib/usageTracking.js';
import {
  getConfig,
  getConfigDefaultAccountIfExists,
} from '@hubspot/local-dev-lib/config';
import { sendUsageEvent } from '../../lib/api/usageTracking.js';

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
    command: toolName,
    type: process.env.HUBSPOT_MCP_AI_AGENT,
    ...getExecutionEnvironmentMeta(),
    ...meta,
  };

  const accountId = getConfigDefaultAccountIfExists()?.accountId || undefined;
  try {
    await sendUsageEvent({
      eventName: 'cli-interaction',
      eventClass: EventClass.INTERACTION,
      meta: usageTrackingEvent,
      accountId,
    });
  } catch (_error) {}
}
