import {
  EventClass,
  getExecutionEnvironmentMeta,
} from '../../lib/usageTracking.js';
import { getConfig } from '@hubspot/local-dev-lib/config';
import { discoverAccountTargets } from '../../lib/accountTargetDiscovery.js';
import { sendUsageEvent } from '../../lib/api/usageTracking.js';

export async function trackToolUsage(
  toolName: string,
  meta?: {
    [key: string]: string;
  }
): Promise<void> {
  let config;
  try {
    config = getConfig();
  } catch {
    // No config file exists yet; skip tracking
    return;
  }
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

  let accountId: number | undefined;
  try {
    const { recommended } = await discoverAccountTargets();
    accountId = recommended?.accountId;
  } catch {
    // Account discovery failed; continue without account ID
  }
  try {
    await sendUsageEvent({
      eventName: 'cli-interaction',
      eventClass: EventClass.INTERACTION,
      meta: usageTrackingEvent,
      accountId,
    });
  } catch (_error) {}
}
