import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  getStateValue,
  setStateValue,
} from '@hubspot/local-dev-lib/config/state';
import { commands } from '../../../lang/en.js';
import { debugError } from '../../errorHandlers/index.js';
import { uiLogger } from '../../ui/logger.js';
import { trackMcpPromotionShown } from '../../usageTracking.js';
import {
  detectConfiguredMcpClients,
  shouldShowMcpPromotion,
  showMcpPromotionNudge,
} from '../promotion.js';

vi.mock('fs-extra');
vi.mock('os');
vi.mock('path');
vi.mock('@hubspot/local-dev-lib/config/state');
vi.mock('../../errorHandlers/index.js', () => ({
  debugError: vi.fn(),
}));
vi.mock('../../usageTracking.js', () => ({
  trackMcpPromotionShown: vi.fn().mockResolvedValue(undefined),
}));

const mockedFs = vi.mocked(fs);
const mockedGetStateValue = vi.mocked(getStateValue);
const mockedSetStateValue = vi.mocked(setStateValue);
const mockedDebugError = vi.mocked(debugError);
const mockedTrackMcpPromotionShown = vi.mocked(trackMcpPromotionShown);
const mockedUiLogger = vi.mocked(uiLogger);

describe('lib/mcp/promotion', () => {
  const now = new Date('2026-06-16T21:00:00.000Z');
  const originalStdoutIsTTY = process.stdout.isTTY;

  function setStdoutIsTTY(isTTY: boolean): void {
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: isTTY,
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    setStdoutIsTTY(true);
    vi.mocked(os.homedir).mockReturnValue('/home/user');
    vi.mocked(path.join).mockImplementation((...parts) => parts.join('/'));
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.readFileSync.mockReturnValue('{}');
    mockedGetStateValue.mockImplementation(key => {
      if (key === 'mcpTotalToolCalls') {
        return 0;
      }
      if (key === 'mcpPromotionLastShownAt') {
        return undefined;
      }
      return undefined;
    });
    mockedSetStateValue.mockReturnValue(undefined);
    delete process.env.CI;
    delete process.env.HUBSPOT_MCP_AI_AGENT;
  });

  afterEach(() => {
    delete process.env.CI;
    delete process.env.HUBSPOT_MCP_AI_AGENT;
    vi.useRealTimers();
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: originalStdoutIsTTY,
    });
  });

  it('detects Dev MCP in a supported client config', () => {
    mockedFs.existsSync.mockImplementation(filePath =>
      String(filePath).includes('.cursor/mcp.json')
    );
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({ mcpServers: { HubSpotDev: { command: 'hs' } } })
    );

    const result = detectConfiguredMcpClients();

    expect(result).toEqual(['cursor']);
  });

  it('suppresses when Dev MCP is already detected in a supported client config', async () => {
    mockedFs.existsSync.mockImplementation(filePath =>
      String(filePath).includes('.cursor/mcp.json')
    );
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({ mcpServers: { HubSpotDev: { command: 'hs' } } })
    );

    await expect(shouldShowMcpPromotion()).resolves.toBe(false);
  });

  it('suppresses after Dev MCP has been used', async () => {
    mockedGetStateValue.mockImplementation(key =>
      key === 'mcpTotalToolCalls' ? 1 : undefined
    );

    await expect(shouldShowMcpPromotion()).resolves.toBe(false);
  });

  it('suppresses MCP-originated commands', async () => {
    process.env.HUBSPOT_MCP_AI_AGENT = 'cursor';

    await expect(shouldShowMcpPromotion()).resolves.toBe(false);
  });

  it('suppresses CI and non-TTY output paths', async () => {
    process.env.CI = 'true';
    await expect(shouldShowMcpPromotion()).resolves.toBe(false);

    delete process.env.CI;
    setStdoutIsTTY(false);
    await expect(shouldShowMcpPromotion()).resolves.toBe(false);
  });

  it('handles state read failures without showing a promotion', async () => {
    mockedGetStateValue.mockImplementation(() => {
      throw new Error('state unavailable');
    });

    await expect(shouldShowMcpPromotion()).resolves.toBe(false);
  });

  it('handles state write failures without disrupting the caller', async () => {
    const error = new Error('state write failed');
    mockedSetStateValue.mockImplementation(() => {
      throw error;
    });

    await expect(
      showMcpPromotionNudge('test-command')
    ).resolves.toBeUndefined();
    expect(mockedUiLogger.info).not.toHaveBeenCalled();
    expect(mockedTrackMcpPromotionShown).not.toHaveBeenCalled();
    expect(mockedDebugError).toHaveBeenCalledWith(error);
  });

  it('applies cooldown behavior globally', async () => {
    mockedGetStateValue.mockImplementation(key => {
      if (key === 'mcpTotalToolCalls') {
        return 0;
      }
      if (key === 'mcpPromotionLastShownAt') {
        return '2026-06-15T21:00:00.000Z';
      }
      return undefined;
    });

    await expect(shouldShowMcpPromotion()).resolves.toBe(false);
  });

  it('allows promotion after the global cooldown expires', async () => {
    mockedGetStateValue.mockImplementation(key => {
      if (key === 'mcpTotalToolCalls') {
        return 0;
      }
      if (key === 'mcpPromotionLastShownAt') {
        return '2026-06-01T21:00:00.000Z';
      }
      return undefined;
    });

    await expect(shouldShowMcpPromotion()).resolves.toBe(true);
  });

  it('records cooldown state, prints shared copy, and tracks shown promotions', async () => {
    await showMcpPromotionNudge('upgrade');

    expect(mockedSetStateValue).toHaveBeenCalledWith(
      'mcpPromotionLastShownAt',
      now.toISOString()
    );
    expect(mockedUiLogger.info).toHaveBeenCalledWith(
      commands.mcp.promotion.activeNudge
    );
    expect(commands.mcp.promotion.activeNudge).toContain('hs mcp setup');
    expect(commands.mcp.promotion.activeNudge).not.toContain('mcp start');
    expect(mockedTrackMcpPromotionShown).toHaveBeenCalledWith('upgrade');
  });

  it('tracks shown promotions with the given command name', async () => {
    await showMcpPromotionNudge('account auth');

    expect(mockedTrackMcpPromotionShown).toHaveBeenCalledWith('account auth');
  });
});
