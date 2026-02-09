import updateNotifier from 'update-notifier';
import {
  isCliGloballyInstalled,
  canCliBeAutoUpgraded,
  getLatestCliVersion,
  getCliUpgradeInfo,
  installCliVersion,
} from '../cliUpgradeUtils.js';
import {
  isGloballyInstalled,
  getLatestPackageVersion,
  executeInstall,
  isInstalledGloballyWithNPM,
} from '../npm/npmCli.js';
import { pkg } from '../jsonLoader.js';

vi.mock('../npm/npmCli');
vi.mock('update-notifier');
vi.mock('../jsonLoader.js', () => ({
  pkg: {
    name: '@hubspot/cli',
    version: '7.11.2',
  },
}));

const mockedIsGloballyInstalled = vi.mocked(isGloballyInstalled);
const mockedGetLatestPackageVersion = vi.mocked(getLatestPackageVersion);
const mockedExecuteInstall = vi.mocked(executeInstall);
const mockedUpdateNotifier = vi.mocked(updateNotifier);
const mockedIsInstalledGloballyWithNPM = vi.mocked(isInstalledGloballyWithNPM);

describe('lib/cliUpgradeUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isCliGloballyInstalled()', () => {
    it('should return true when hs is globally installed', async () => {
      mockedIsGloballyInstalled.mockResolvedValueOnce(true);

      const result = await isCliGloballyInstalled();

      expect(result).toBe(true);
      expect(mockedIsGloballyInstalled).toHaveBeenCalledTimes(1);
      expect(mockedIsGloballyInstalled).toHaveBeenCalledWith('hs');
    });

    it('should return false when hs is not globally installed', async () => {
      mockedIsGloballyInstalled.mockResolvedValueOnce(false);

      const result = await isCliGloballyInstalled();

      expect(result).toBe(false);
      expect(mockedIsGloballyInstalled).toHaveBeenCalledTimes(1);
      expect(mockedIsGloballyInstalled).toHaveBeenCalledWith('hs');
    });
  });

  describe('canCliBeAutoUpgraded()', () => {
    it('should return true when package is installed globally via npm', async () => {
      mockedIsInstalledGloballyWithNPM.mockResolvedValueOnce(true);

      const result = await canCliBeAutoUpgraded();

      expect(result).toBe(true);
      expect(mockedIsInstalledGloballyWithNPM).toHaveBeenCalledTimes(1);
      expect(mockedIsInstalledGloballyWithNPM).toHaveBeenCalledWith(pkg.name);
    });

    it('should return false when package is not installed globally via npm', async () => {
      mockedIsInstalledGloballyWithNPM.mockResolvedValueOnce(false);

      const result = await canCliBeAutoUpgraded();

      expect(result).toBe(false);
      expect(mockedIsInstalledGloballyWithNPM).toHaveBeenCalledTimes(1);
      expect(mockedIsInstalledGloballyWithNPM).toHaveBeenCalledWith(pkg.name);
    });
  });

  describe('getLatestCliVersion()', () => {
    it('should return the latest CLI version', async () => {
      const latest = '7.12.0';
      const next = '7.12.0-beta.1';
      mockedGetLatestPackageVersion.mockResolvedValueOnce({ latest, next });

      const result = await getLatestCliVersion();

      expect(result).toEqual({ latest, next });
      expect(mockedGetLatestPackageVersion).toHaveBeenCalledTimes(1);
      expect(mockedGetLatestPackageVersion).toHaveBeenCalledWith(pkg.name);
    });

    it('should throw errors from getLatestPackageVersion', async () => {
      const errorMessage = 'Failed to get version';
      mockedGetLatestPackageVersion.mockRejectedValueOnce(
        new Error(errorMessage)
      );

      await expect(getLatestCliVersion()).rejects.toThrow(errorMessage);
      expect(mockedGetLatestPackageVersion).toHaveBeenCalledWith(pkg.name);
    });
  });

  describe('getCliUpgradeInfo()', () => {
    it('should return upgrade info when update is available', () => {
      const mockNotifier = {
        update: {
          current: '7.11.2',
          latest: '7.12.0',
          type: 'minor',
        },
      };
      mockedUpdateNotifier.mockReturnValue(
        mockNotifier as ReturnType<typeof updateNotifier>
      );

      const result = getCliUpgradeInfo();

      expect(result).toMatchObject({
        current: '7.11.2',
        latest: '7.12.0',
        type: 'minor',
      });
      expect(mockedUpdateNotifier).toHaveBeenCalledWith({
        pkg,
        distTag: 'latest',
        shouldNotifyInNpmScript: true,
      });
    });

    it('should return cached info on subsequent calls', () => {
      const mockNotifier = {
        update: {
          current: '7.11.2',
          latest: '7.12.0',
          type: 'minor',
        },
      };
      mockedUpdateNotifier.mockReturnValue(
        mockNotifier as ReturnType<typeof updateNotifier>
      );

      const firstCall = getCliUpgradeInfo();
      const secondCall = getCliUpgradeInfo();

      expect(firstCall).toEqual(secondCall);
      expect(firstCall.current).toBe('7.11.2');
      expect(firstCall.latest).toBe('7.12.0');
      expect(firstCall.type).toBe('minor');
    });
  });

  describe('installCliVersion()', () => {
    it('should install latest version by default', async () => {
      mockedExecuteInstall.mockResolvedValueOnce(undefined);

      await installCliVersion();

      expect(mockedExecuteInstall).toHaveBeenCalledTimes(1);
      expect(mockedExecuteInstall).toHaveBeenCalledWith(
        [`${pkg.name}@latest`],
        '-g'
      );
    });

    it('should install a specific version when provided', async () => {
      const version = '7.12.0';
      mockedExecuteInstall.mockResolvedValueOnce(undefined);

      await installCliVersion(version);

      expect(mockedExecuteInstall).toHaveBeenCalledTimes(1);
      expect(mockedExecuteInstall).toHaveBeenCalledWith(
        [`${pkg.name}@${version}`],
        '-g'
      );
    });

    it('should throw errors from executeInstall', async () => {
      const errorMessage = 'Installation failed';
      mockedExecuteInstall.mockRejectedValueOnce(new Error(errorMessage));

      await expect(installCliVersion()).rejects.toThrow(errorMessage);
      expect(mockedExecuteInstall).toHaveBeenCalledWith(
        [`${pkg.name}@latest`],
        '-g'
      );
    });
  });
});
