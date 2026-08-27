import { EventEmitter } from 'events';
import fs from 'fs';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import SpinniesManager from '../../ui/SpinniesManager.js';
import { lib } from '../../../lang/en.js';

vi.mock('fs');
vi.mock('child_process');
vi.mock('module');
vi.mock('../../ui/SpinniesManager.js', () => ({
  default: {
    init: vi.fn(),
    add: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  },
}));

const mockedFs = vi.mocked(fs);
const mockedSpawn = vi.mocked(spawn);
const mockedCreateRequire = vi.mocked(createRequire);
const mockedSpinnies = vi.mocked(SpinniesManager);

const CURRENT_VERSION = '7.0.7';
const mockStart = vi.fn();

function makeMockProcess(exitCode: number | null = 0, error?: Error) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: null;
    stderr: null;
  };
  if (error) {
    setTimeout(() => proc.emit('error', error), 0);
  } else {
    setTimeout(() => proc.emit('close', exitCode), 0);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return proc as any;
}

describe('lib/cms/serverlessDevRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateRequire.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.fn().mockReturnValue({ start: mockStart }) as unknown as any
    );
    // Default: node_modules dir does not exist (no old install to clear)
    mockedFs.existsSync.mockReturnValue(false);
  });

  describe('startServerlessDevRuntime', () => {
    describe('when already installed at the correct version', () => {
      beforeEach(() => {
        mockedFs.existsSync.mockImplementation((p: fs.PathLike) =>
          String(p).endsWith('package.json')
        );
        mockedFs.readFileSync.mockReturnValue(
          JSON.stringify({ version: CURRENT_VERSION })
        );
      });

      it('skips npm install', async () => {
        const { startServerlessDevRuntime } =
          await import('../serverlessDevRuntime.js');
        await startServerlessDevRuntime({});
        expect(mockedSpawn).not.toHaveBeenCalled();
      });

      it('shows no spinner', async () => {
        const { startServerlessDevRuntime } =
          await import('../serverlessDevRuntime.js');
        await startServerlessDevRuntime({});
        expect(mockedSpinnies.add).not.toHaveBeenCalled();
      });

      it('calls start with the provided options', async () => {
        const { startServerlessDevRuntime } =
          await import('../serverlessDevRuntime.js');
        const options = { accountId: 123, path: './my.functions' };
        await startServerlessDevRuntime(options);
        expect(mockStart).toHaveBeenCalledWith(options);
      });
    });

    describe('when not yet installed', () => {
      beforeEach(() => {
        mockedFs.existsSync.mockReturnValue(false);
        mockedSpawn.mockReturnValue(makeMockProcess(0));
      });

      it('runs npm install with the correct package and flags', async () => {
        const { startServerlessDevRuntime } =
          await import('../serverlessDevRuntime.js');
        await startServerlessDevRuntime({});
        expect(mockedSpawn).toHaveBeenCalledWith(
          'npm',
          [
            'install',
            `@hubspot/serverless-dev-runtime@${CURRENT_VERSION}`,
            '--production',
            '--no-save',
            '--loglevel=error',
          ],
          expect.objectContaining({ stdio: 'ignore' })
        );
      });

      it('shows install spinner and marks it succeeded', async () => {
        const { startServerlessDevRuntime } =
          await import('../serverlessDevRuntime.js');
        await startServerlessDevRuntime({});
        expect(mockedSpinnies.add).toHaveBeenCalledWith(
          'serverless-runtime-install',
          expect.objectContaining({
            text: lib.cms.serverlessDevRuntime.installStarted(CURRENT_VERSION),
          })
        );
        expect(mockedSpinnies.succeed).toHaveBeenCalledWith(
          'serverless-runtime-install',
          expect.objectContaining({
            text: lib.cms.serverlessDevRuntime.installSucceeded,
          })
        );
      });

      it('calls start with the provided options after install', async () => {
        const { startServerlessDevRuntime } =
          await import('../serverlessDevRuntime.js');
        const options = { accountId: 456, port: '5432' };
        await startServerlessDevRuntime(options);
        expect(mockStart).toHaveBeenCalledWith(options);
      });
    });

    describe('when installed at a different version', () => {
      beforeEach(() => {
        mockedFs.existsSync.mockImplementation((p: fs.PathLike) =>
          String(p).endsWith('package.json')
        );
        mockedFs.readFileSync.mockReturnValue(
          JSON.stringify({ version: '6.0.0' })
        );
        mockedSpawn.mockReturnValue(makeMockProcess(0));
      });

      it('reinstalls', async () => {
        const { startServerlessDevRuntime } =
          await import('../serverlessDevRuntime.js');
        await startServerlessDevRuntime({});
        expect(mockedSpawn).toHaveBeenCalled();
      });
    });

    describe('when npm install exits with a non-zero code', () => {
      beforeEach(() => {
        mockedFs.existsSync.mockReturnValue(false);
        mockedSpawn.mockReturnValue(makeMockProcess(1));
      });

      it('marks the spinner failed and throws', async () => {
        const { startServerlessDevRuntime } =
          await import('../serverlessDevRuntime.js');
        await expect(startServerlessDevRuntime({})).rejects.toThrow(
          lib.cms.serverlessDevRuntime.installFailed
        );
        expect(mockedSpinnies.fail).toHaveBeenCalledWith(
          'serverless-runtime-install',
          expect.objectContaining({
            text: lib.cms.serverlessDevRuntime.installFailed,
          })
        );
      });

      it('does not call start', async () => {
        const { startServerlessDevRuntime } =
          await import('../serverlessDevRuntime.js');
        await expect(startServerlessDevRuntime({})).rejects.toThrow();
        expect(mockStart).not.toHaveBeenCalled();
      });
    });

    describe('when npm spawn emits an error event', () => {
      beforeEach(() => {
        mockedFs.existsSync.mockReturnValue(false);
        mockedSpawn.mockReturnValue(
          makeMockProcess(null, new Error('spawn ENOENT'))
        );
      });

      it('marks the spinner failed and throws the spawn error', async () => {
        const { startServerlessDevRuntime } =
          await import('../serverlessDevRuntime.js');
        await expect(startServerlessDevRuntime({})).rejects.toThrow(
          'spawn ENOENT'
        );
        expect(mockedSpinnies.fail).toHaveBeenCalled();
      });

      it('does not call start', async () => {
        const { startServerlessDevRuntime } =
          await import('../serverlessDevRuntime.js');
        await expect(startServerlessDevRuntime({})).rejects.toThrow();
        expect(mockStart).not.toHaveBeenCalled();
      });
    });

    describe('when the cached package.json is unreadable', () => {
      beforeEach(() => {
        mockedFs.existsSync.mockImplementation((p: fs.PathLike) =>
          String(p).endsWith('package.json')
        );
        mockedFs.readFileSync.mockImplementation(() => {
          throw new Error('EACCES');
        });
        mockedSpawn.mockReturnValue(makeMockProcess(0));
      });

      it('falls back to reinstalling', async () => {
        const { startServerlessDevRuntime } =
          await import('../serverlessDevRuntime.js');
        await startServerlessDevRuntime({});
        expect(mockedSpawn).toHaveBeenCalled();
      });
    });
  });
});
