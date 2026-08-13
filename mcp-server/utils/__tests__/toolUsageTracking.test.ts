import {
  getConfig,
  getConfigFilePath,
  getGlobalConfigFilePath,
} from '@hubspot/local-dev-lib/config';
import { sendUsageEvent } from '../../../lib/api/usageTracking.js';
import { trackToolUsage } from '../toolUsageTracking.js';
import { discoverAccountTargets } from '../../../lib/accountTargetDiscovery.js';
import type { AccountTargetCandidate } from '../../../types/AccountTargets.js';
import { Mock } from 'vitest';

vi.unmock('../toolUsageTracking.js');
vi.unmock('../../../lib/usageTracking.js');

vi.mock('../../../lib/api/usageTracking.js');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../lib/accountTargetDiscovery.js');

const mockedGetConfig = getConfig as Mock;
const mockedDiscoverAccountTargets = vi.mocked(discoverAccountTargets);
const mockedGetConfigFilePath = getConfigFilePath as Mock;
const mockedGetGlobalConfigFilePath = getGlobalConfigFilePath as Mock;
const mockedSendUsageEvent = sendUsageEvent as Mock;

describe('mcp-server/utils/toolUsageTracking', () => {
  beforeEach(() => {
    mockedGetConfig.mockReturnValue({ allowUsageTracking: true });
    mockedDiscoverAccountTargets.mockResolvedValue({
      candidates: [],
      recommended: { accountId: 456 } as AccountTargetCandidate,
    });
    mockedGetConfigFilePath.mockReturnValue('/some/local/hubspot.config.yml');
    mockedGetGlobalConfigFilePath.mockReturnValue(
      '/Users/test/.hubspot/config.yml'
    );
    delete process.env.HUBSPOT_MCP_AI_AGENT;
  });

  afterEach(() => {
    delete process.env.HUBSPOT_MCP_AI_AGENT;
  });

  it('should not track when tracking is disabled via config', async () => {
    mockedGetConfig.mockReturnValue({ allowUsageTracking: false });

    await trackToolUsage('test-tool');

    expect(mockedSendUsageEvent).not.toHaveBeenCalled();
  });

  it('should send event with tool name and agent type', async () => {
    process.env.HUBSPOT_MCP_AI_AGENT = 'cursor';

    await trackToolUsage('test-tool');

    expect(mockedSendUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'cli-interaction',
        eventClass: 'INTERACTION',
        accountId: 456,
        meta: expect.objectContaining({
          action: 'cli-mcp-tool-invocation',
          command: 'test-tool',
          type: 'cursor',
        }),
      })
    );
  });

  it('should include auto-tracking metadata fields', async () => {
    await trackToolUsage('test-tool');

    expect(mockedSendUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          configType: 'local',
          executionSource: 'user',
        }),
      })
    );
  });

  it('should use undefined accountId when no default account exists', async () => {
    mockedDiscoverAccountTargets.mockResolvedValue({
      candidates: [],
      recommended: undefined,
    });

    await trackToolUsage('test-tool');

    expect(mockedSendUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: undefined,
      })
    );
  });
});
