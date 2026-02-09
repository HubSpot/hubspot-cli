import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import upgradeCommand, { UpgradeArgs } from '../upgrade.js';
import { trackCommandUsage } from '../../lib/usageTracking.js';
import {
  canCliBeAutoUpgraded,
  getLatestCliVersion,
  installCliVersion,
} from '../../lib/cliUpgradeUtils.js';
import { confirmPrompt } from '../../lib/prompts/promptUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';
import { pkg } from '../../lib/jsonLoader.js';
import SpinniesManager from '../../lib/ui/SpinniesManager.js';
import { debugError } from '../../lib/errorHandlers/index.js';
import { commands } from '../../lang/en.js';
import { Mock } from 'vitest';
import { isConfigFlagEnabled } from '@hubspot/local-dev-lib/config';

vi.mock('../../lib/usageTracking');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../lib/cliUpgradeUtils');
vi.mock('../../lib/prompts/promptUtils');
vi.mock('../../lib/ui/logger.js');
vi.mock('../../lib/jsonLoader.js');
vi.mock('../../lib/ui/SpinniesManager');
vi.mock('../../lib/errorHandlers/index.js');

const mockedTrackCommandUsage = vi.mocked(trackCommandUsage);
const mockedCanCliBeAutoUpgraded = vi.mocked(canCliBeAutoUpgraded);
const mockedGetLatestCliVersion = vi.mocked(getLatestCliVersion);
const mockedInstallCliVersion = vi.mocked(installCliVersion);
const mockedConfirmPrompt = vi.mocked(confirmPrompt);
const mockedDebugError = vi.mocked(debugError);
const mockedIsConfigFlagEnabled = vi.mocked(isConfigFlagEnabled);

const optionSpy = vi
  .spyOn(yargs as Argv, 'option')
  .mockReturnValue(yargs as Argv);
const positionalSpy = vi
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);

describe('commands/upgrade', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: Mock<typeof process.exit>;
  const accountId = 123456;
  const currentVersion = '7.11.2';
  const latestVersion = '7.12.0';

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error Doesn't match the actual signature because then the linter complains about unused variables
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    vi.mocked(pkg).version = currentVersion;
    vi.mocked(SpinniesManager.init).mockReturnValue(undefined);
    vi.mocked(SpinniesManager.add).mockReturnValue(undefined);
    vi.mocked(SpinniesManager.succeed).mockReturnValue(undefined);
    vi.mocked(SpinniesManager.fail).mockReturnValue(undefined);
    // Default mock for isConfigFlagEnabled - can be overridden in individual tests
    mockedIsConfigFlagEnabled.mockReturnValue(false);
    // Reset mock implementations to ensure clean state
    mockedGetLatestCliVersion.mockReset();
    mockedCanCliBeAutoUpgraded.mockReset();
    mockedInstallCliVersion.mockReset();
    mockedConfirmPrompt.mockReset();
  });

  describe('command', () => {
    it('should have the proper command names', () => {
      expect(upgradeCommand.command).toEqual([
        'upgrade [version]',
        'update [version]',
      ]);
    });
  });

  describe('describe', () => {
    it('should have a description', () => {
      expect(upgradeCommand.describe).toBeDefined();
      expect(upgradeCommand.describe).toContain('Install');
    });
  });

  describe('builder', () => {
    it('should apply the correct options', async () => {
      await upgradeCommand.builder(yargs as Argv);

      expect(positionalSpy).toHaveBeenCalledWith('[version]', {
        describe: commands.upgrade.options.version,
        type: 'string',
      });

      expect(optionSpy).toHaveBeenCalledWith('force', {
        alias: 'f',
        describe: commands.upgrade.options.force,
        type: 'boolean',
        default: false,
      });

      expect(optionSpy).toHaveBeenCalledWith('beta', {
        alias: 'next',
        describe: commands.upgrade.options.beta,
        type: 'boolean',
        default: false,
      });
    });
  });

  describe('handler', () => {
    it('should track the command usage', async () => {
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: '7.12.0-beta.1',
      });
      mockedCanCliBeAutoUpgraded.mockResolvedValueOnce(false);

      await upgradeCommand.handler({
        derivedAccountId: accountId,
      } as ArgumentsCamelCase<UpgradeArgs>);

      expect(mockedTrackCommandUsage).toHaveBeenCalledTimes(1);
      expect(mockedTrackCommandUsage).toHaveBeenCalledWith(
        'upgrade',
        {},
        accountId
      );
    });

    it('should exit successfully when already on latest version', async () => {
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: currentVersion,
        next: '7.11.2-beta.1',
      });

      await upgradeCommand.handler({} as ArgumentsCamelCase<UpgradeArgs>);

      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.upgrade.alreadyLatest(currentVersion)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      expect(mockedInstallCliVersion).not.toHaveBeenCalled();
    });

    it('should exit successfully when already on requested version', async () => {
      const requestedVersion = currentVersion;
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: '7.12.0-beta.1',
      });

      await upgradeCommand.handler({
        version: requestedVersion,
      } as ArgumentsCamelCase<UpgradeArgs>);

      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.upgrade.alreadyOnVersion(currentVersion)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      expect(mockedInstallCliVersion).not.toHaveBeenCalled();
    });

    it('should show message when CLI is not globally installed', async () => {
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: '7.12.0-beta.1',
      });
      mockedCanCliBeAutoUpgraded.mockResolvedValueOnce(false);

      await upgradeCommand.handler({} as ArgumentsCamelCase<UpgradeArgs>);

      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.upgrade.autoUpgradeNotAvailable(latestVersion)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      expect(mockedInstallCliVersion).not.toHaveBeenCalled();
    });

    it('should cancel upgrade when user declines confirmation', async () => {
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: '7.12.0-beta.1',
      });
      mockedCanCliBeAutoUpgraded.mockResolvedValueOnce(true);
      mockedConfirmPrompt.mockResolvedValueOnce(false);

      await upgradeCommand.handler({} as ArgumentsCamelCase<UpgradeArgs>);

      expect(mockedConfirmPrompt).toHaveBeenCalledWith(
        commands.upgrade.confirmPrompt(currentVersion, latestVersion),
        { defaultAnswer: true }
      );
      expect(uiLogger.log).toHaveBeenCalledWith(commands.upgrade.cancelled);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      expect(mockedInstallCliVersion).not.toHaveBeenCalled();
    });

    it('should upgrade successfully when user confirms', async () => {
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: '7.12.0-beta.1',
      });
      mockedCanCliBeAutoUpgraded.mockResolvedValueOnce(true);
      mockedConfirmPrompt.mockResolvedValueOnce(true);
      mockedInstallCliVersion.mockResolvedValueOnce(undefined);

      await upgradeCommand.handler({} as ArgumentsCamelCase<UpgradeArgs>);

      expect(mockedConfirmPrompt).toHaveBeenCalled();
      expect(SpinniesManager.add).toHaveBeenCalledWith('upgrade', {
        text: commands.upgrade.installing(latestVersion),
      });
      expect(mockedInstallCliVersion).toHaveBeenCalledWith(latestVersion);
      expect(SpinniesManager.succeed).toHaveBeenCalledWith('upgrade', {
        text: commands.upgrade.success(latestVersion),
      });
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should upgrade without confirmation when --force is used', async () => {
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: '7.12.0-beta.1',
      });
      mockedCanCliBeAutoUpgraded.mockResolvedValueOnce(true);
      mockedInstallCliVersion.mockResolvedValueOnce(undefined);

      await upgradeCommand.handler({
        force: true,
      } as ArgumentsCamelCase<UpgradeArgs>);

      expect(mockedConfirmPrompt).not.toHaveBeenCalled();
      expect(mockedInstallCliVersion).toHaveBeenCalledWith(latestVersion);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should install specific version when provided', async () => {
      const specificVersion = '7.10.0';
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: '7.12.0',
      });
      mockedCanCliBeAutoUpgraded.mockResolvedValueOnce(true);
      mockedConfirmPrompt.mockResolvedValueOnce(true);
      mockedInstallCliVersion.mockResolvedValueOnce(undefined);

      await upgradeCommand.handler({
        version: specificVersion,
      } as ArgumentsCamelCase<UpgradeArgs>);

      expect(mockedInstallCliVersion).toHaveBeenCalledWith(specificVersion);
      expect(SpinniesManager.add).toHaveBeenCalledWith('upgrade', {
        text: commands.upgrade.installing(specificVersion),
      });
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should handle installation errors', async () => {
      const error = new Error('Installation failed');
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: '7.12.0-beta.1',
      });
      mockedCanCliBeAutoUpgraded.mockResolvedValueOnce(true);
      mockedConfirmPrompt.mockResolvedValueOnce(true);
      mockedInstallCliVersion.mockRejectedValueOnce(error);

      await upgradeCommand.handler({} as ArgumentsCamelCase<UpgradeArgs>);

      expect(mockedDebugError).toHaveBeenCalledWith(error);
      expect(SpinniesManager.fail).toHaveBeenCalledWith('upgrade', {
        text: commands.upgrade.errors.installFailed,
      });
      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.upgrade.errors.generic
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should install beta version when --beta flag is used', async () => {
      const betaVersion = '7.13.0-beta.1';
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: betaVersion,
      });
      mockedCanCliBeAutoUpgraded.mockResolvedValueOnce(true);
      mockedConfirmPrompt.mockResolvedValueOnce(true);
      mockedInstallCliVersion.mockResolvedValueOnce(undefined);

      await upgradeCommand.handler({
        beta: true,
      } as ArgumentsCamelCase<UpgradeArgs>);

      expect(mockedGetLatestCliVersion).toHaveBeenCalled();
      expect(mockedInstallCliVersion).toHaveBeenCalledWith(betaVersion);
      expect(SpinniesManager.add).toHaveBeenCalledWith('upgrade', {
        text: commands.upgrade.installing(betaVersion),
      });
      expect(SpinniesManager.succeed).toHaveBeenCalledWith('upgrade', {
        text: commands.upgrade.success(betaVersion),
      });
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should error when beta is requested but next version is not available', async () => {
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: null,
      });
      mockedIsConfigFlagEnabled.mockReturnValue(false);

      await upgradeCommand.handler({
        beta: true,
      } as ArgumentsCamelCase<UpgradeArgs>);

      expect(mockedGetLatestCliVersion).toHaveBeenCalled();
      expect(uiLogger.error).toHaveBeenCalledWith(
        commands.upgrade.errors.unableToDetermineLatestVersion
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockedInstallCliVersion).not.toHaveBeenCalled();
      expect(mockedCanCliBeAutoUpgraded).not.toHaveBeenCalled();
    });

    it('should show already on latest beta version message', async () => {
      const betaVersion = '7.12.0-beta.1';
      vi.mocked(pkg).version = betaVersion;
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: betaVersion,
      });

      await upgradeCommand.handler({
        beta: true,
      } as ArgumentsCamelCase<UpgradeArgs>);

      expect(uiLogger.log).toHaveBeenCalledWith(
        commands.upgrade.alreadyLatest(betaVersion, true)
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      expect(mockedInstallCliVersion).not.toHaveBeenCalled();
    });

    it('should not show auto-upgrade message when beta flag is used', async () => {
      const betaVersion = '7.12.0-beta.1';
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: betaVersion,
      });
      mockedCanCliBeAutoUpgraded.mockResolvedValueOnce(true);
      mockedConfirmPrompt.mockResolvedValueOnce(true);
      mockedInstallCliVersion.mockResolvedValueOnce(undefined);
      mockedIsConfigFlagEnabled.mockReturnValue(false);

      await upgradeCommand.handler({
        beta: true,
      } as ArgumentsCamelCase<UpgradeArgs>);

      // Verify the auto-upgrade message was not logged
      const logCalls = vi.mocked(uiLogger.log).mock.calls;
      const autoUpgradeMessageCall = logCalls.find(call =>
        call[0]?.includes('automatic updates')
      );
      expect(autoUpgradeMessageCall).toBeUndefined();
      // Should succeed even though auto-updates are disabled when beta is used
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
      expect(mockedInstallCliVersion).toHaveBeenCalledWith(betaVersion);
    });

    it('should upgrade to beta without confirmation when --force and --beta are used', async () => {
      const betaVersion = '7.12.0-beta.1';
      mockedGetLatestCliVersion.mockResolvedValueOnce({
        latest: latestVersion,
        next: betaVersion,
      });
      mockedCanCliBeAutoUpgraded.mockResolvedValueOnce(true);
      mockedInstallCliVersion.mockResolvedValueOnce(undefined);

      await upgradeCommand.handler({
        force: true,
        beta: true,
      } as ArgumentsCamelCase<UpgradeArgs>);

      expect(mockedConfirmPrompt).not.toHaveBeenCalled();
      expect(mockedInstallCliVersion).toHaveBeenCalledWith(betaVersion);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });
  });
});
