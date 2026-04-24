import { Arguments } from 'yargs';
import { autoUpdateCLI } from '../autoUpdateMiddleware.js';
import { isConfigFlagEnabled } from '@hubspot/local-dev-lib/config';
import {
  getCliUpgradeInfo,
  isCliGloballyInstalled,
} from '../../cliUpgradeUtils.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../cliUpgradeUtils.js');
vi.mock('../../../ui/render.js', () => ({
  renderInline: vi.fn(),
}));

const mockedIsConfigFlagEnabled = vi.mocked(isConfigFlagEnabled);
const mockedGetCliUpgradeInfo = vi.mocked(getCliUpgradeInfo);
const mockedIsCliGloballyInstalled = vi.mocked(isCliGloballyInstalled);

describe('lib/middleware/autoUpdateMiddleware', () => {
  let originalStdoutIsTTY: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    originalStdoutIsTTY = process.stdout.isTTY;
    process.stdout.isTTY = true;
    delete process.env.SKIP_HUBSPOT_CLI_AUTO_UPDATES;
    mockedIsConfigFlagEnabled.mockReturnValue(false);
    mockedIsCliGloballyInstalled.mockResolvedValue(true);
  });

  afterEach(() => {
    process.stdout.isTTY = originalStdoutIsTTY;
    delete process.env.SKIP_HUBSPOT_CLI_AUTO_UPDATES;
  });

  describe('Pre-release version handling', () => {
    it('should not show update notification for pre-release versions when auto-updates disabled', async () => {
      mockedIsConfigFlagEnabled.mockReturnValue(false);
      mockedGetCliUpgradeInfo.mockReturnValue({
        current: '8.4.0-beta.0',
        latest: '8.3.0',
        type: 'minor',
      });

      const argv = { _: ['project', 'upload'] } as Arguments<{
        useEnv?: boolean;
      }>;

      const { renderInline } = await import('../../../ui/render.js');

      await autoUpdateCLI(argv);

      expect(renderInline).not.toHaveBeenCalled();
    });

    it('should not show update notification for pre-release versions when auto-updates enabled', async () => {
      mockedIsConfigFlagEnabled.mockReturnValue(true);
      mockedGetCliUpgradeInfo.mockReturnValue({
        current: '8.4.0-beta.0',
        latest: '8.3.0',
        type: 'minor',
      });

      const argv = { _: ['project', 'upload'] } as Arguments<{
        useEnv?: boolean;
      }>;

      const { renderInline } = await import('../../../ui/render.js');

      await autoUpdateCLI(argv);

      expect(renderInline).not.toHaveBeenCalled();
    });

    it('should not show update notification for alpha versions', async () => {
      mockedIsConfigFlagEnabled.mockReturnValue(false);
      mockedGetCliUpgradeInfo.mockReturnValue({
        current: '9.0.0-alpha.1',
        latest: '8.3.0',
        type: 'major',
      });

      const argv = { _: ['project', 'upload'] } as Arguments<{
        useEnv?: boolean;
      }>;

      const { renderInline } = await import('../../../ui/render.js');

      await autoUpdateCLI(argv);

      expect(renderInline).not.toHaveBeenCalled();
    });

    it('should not show update notification for rc versions', async () => {
      mockedIsConfigFlagEnabled.mockReturnValue(false);
      mockedGetCliUpgradeInfo.mockReturnValue({
        current: '8.4.0-rc.1',
        latest: '8.3.0',
        type: 'minor',
      });

      const argv = { _: ['project', 'upload'] } as Arguments<{
        useEnv?: boolean;
      }>;

      const { renderInline } = await import('../../../ui/render.js');

      await autoUpdateCLI(argv);

      expect(renderInline).not.toHaveBeenCalled();
    });
  });

  describe('Stable version handling', () => {
    it('should show update notification for stable versions when update is available', async () => {
      mockedIsConfigFlagEnabled.mockReturnValue(false);
      mockedGetCliUpgradeInfo.mockReturnValue({
        current: '8.3.0',
        latest: '8.4.0',
        type: 'minor',
      });

      const argv = { _: ['project', 'upload'] } as Arguments<{
        useEnv?: boolean;
      }>;

      const { renderInline } = await import('../../../ui/render.js');

      await autoUpdateCLI(argv);

      expect(renderInline).toHaveBeenCalledTimes(1);
    });

    it('should not show update notification when current equals latest', async () => {
      mockedIsConfigFlagEnabled.mockReturnValue(false);
      mockedGetCliUpgradeInfo.mockReturnValue({
        current: '8.4.0',
        latest: '8.4.0',
        type: 'latest',
      });

      const argv = { _: ['project', 'upload'] } as Arguments<{
        useEnv?: boolean;
      }>;

      const { renderInline } = await import('../../../ui/render.js');

      await autoUpdateCLI(argv);

      expect(renderInline).not.toHaveBeenCalled();
    });

    it('should not show update notification when type is "latest"', async () => {
      mockedIsConfigFlagEnabled.mockReturnValue(false);
      mockedGetCliUpgradeInfo.mockReturnValue({
        current: '8.4.0',
        latest: '8.4.0',
        type: 'latest',
      });

      const argv = { _: ['project', 'upload'] } as Arguments<{
        useEnv?: boolean;
      }>;

      const { renderInline } = await import('../../../ui/render.js');

      await autoUpdateCLI(argv);

      expect(renderInline).not.toHaveBeenCalled();
    });
  });

  describe('Environment variable handling', () => {
    it('should still show manual notifications when SKIP_HUBSPOT_CLI_AUTO_UPDATES is set for stable versions', async () => {
      process.env.SKIP_HUBSPOT_CLI_AUTO_UPDATES = 'true';
      mockedIsConfigFlagEnabled.mockReturnValue(false);
      mockedGetCliUpgradeInfo.mockReturnValue({
        current: '8.3.0',
        latest: '8.4.0',
        type: 'minor',
      });

      const argv = { _: ['project', 'upload'] } as Arguments<{
        useEnv?: boolean;
      }>;

      const { renderInline } = await import('../../../ui/render.js');

      await autoUpdateCLI(argv);

      expect(renderInline).toHaveBeenCalledTimes(1);
    });

    it('should not show notifications when SKIP_HUBSPOT_CLI_AUTO_UPDATES is set for pre-release versions', async () => {
      process.env.SKIP_HUBSPOT_CLI_AUTO_UPDATES = 'true';
      mockedIsConfigFlagEnabled.mockReturnValue(false);
      mockedGetCliUpgradeInfo.mockReturnValue({
        current: '8.4.0-beta.0',
        latest: '8.3.0',
        type: 'minor',
      });

      const argv = { _: ['project', 'upload'] } as Arguments<{
        useEnv?: boolean;
      }>;

      const { renderInline } = await import('../../../ui/render.js');

      await autoUpdateCLI(argv);

      expect(renderInline).not.toHaveBeenCalled();
    });
  });

  describe('TTY handling', () => {
    it('should not show notifications when stdout is not TTY', async () => {
      process.stdout.isTTY = false;
      mockedIsConfigFlagEnabled.mockReturnValue(false);
      mockedGetCliUpgradeInfo.mockReturnValue({
        current: '8.3.0',
        latest: '8.4.0',
        type: 'minor',
      });

      const argv = { _: ['project', 'upload'] } as Arguments<{
        useEnv?: boolean;
      }>;

      const { renderInline } = await import('../../../ui/render.js');

      await autoUpdateCLI(argv);

      expect(renderInline).not.toHaveBeenCalled();
    });
  });
});
