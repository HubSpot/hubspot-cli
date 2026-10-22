import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { Mock } from 'vitest';
import {
  cancelStagedBuild,
  deleteFileFromBuild,
  provisionBuild,
  queueBuild,
  uploadFileToBuild,
} from '@hubspot/local-dev-lib/api/projects';
import { isAllowedExtension } from '@hubspot/local-dev-lib/path';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { commands } from '../../../lang/en.js';
import { logError } from '../../errorHandlers/index.js';
import { PROJECT_ERROR_TYPES } from '../../constants.js';
import { uiLogger } from '../../ui/logger.js';
import { ProjectConfig } from '../../../types/Projects.js';

vi.mock('chokidar');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/path');
vi.mock('@hubspot/local-dev-lib/ignoreRules');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('../../errorHandlers/index.js');

type CreateWatcher = typeof import('../watch.js').createWatcher;
type BuildHandler = (
  accountId: number,
  projectName: string,
  buildId: number
) => Promise<void> | void;
type TerminationHandler = (error?: unknown) => void;
type WatcherHandler = (filePath?: string) => void | Promise<void>;

const mockedChokidarWatch = vi.mocked(chokidar.watch);
const mockedCancelStagedBuild = vi.mocked(cancelStagedBuild);
const mockedDeleteFileFromBuild = vi.mocked(deleteFileFromBuild);
const mockedProvisionBuild = vi.mocked(provisionBuild);
const mockedQueueBuild = vi.mocked(queueBuild);
const mockedUploadFileToBuild = vi.mocked(uploadFileToBuild);
const mockedIsAllowedExtension = vi.mocked(isAllowedExtension);
const mockedShouldIgnoreFile = vi.mocked(shouldIgnoreFile);
const mockedIsSpecifiedError = vi.mocked(isSpecifiedError);
const mockedLogError = vi.mocked(logError);
const mockedUiLogger = vi.mocked(uiLogger);

const ACCOUNT_ID = 123;
const PROJECT_DIR = path.join('/test', 'project');
const BUILD_ID = 7;
const DEBOUNCE_MS = 2000;

const mockProjectConfig: ProjectConfig = {
  name: 'my-project',
  srcDir: 'src',
  platformVersion: '2025.2',
};
const SOURCE_DIR = path.join(PROJECT_DIR, mockProjectConfig.srcDir);

function mockProvisionedBuild(buildId = BUILD_ID): void {
  mockedProvisionBuild.mockResolvedValue({
    data: { buildId },
  } as unknown as Awaited<ReturnType<typeof provisionBuild>>);
}

describe('lib/projects/watch', () => {
  let createWatcher: CreateWatcher;
  let watcherHandlers: Record<string, WatcherHandler>;
  let handleBuildStatus: Mock<BuildHandler>;
  let handleUserInput: Mock<BuildHandler>;
  let handleWatchTermination: Mock<TerminationHandler>;

  async function startWatcher(): Promise<void> {
    await createWatcher(
      ACCOUNT_ID,
      mockProjectConfig,
      PROJECT_DIR,
      handleBuildStatus,
      handleUserInput,
      handleWatchTermination
    );
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ createWatcher } = await import('../watch.js'));

    watcherHandlers = {};
    handleBuildStatus = vi.fn().mockResolvedValue(undefined);
    handleUserInput = vi.fn();
    handleWatchTermination = vi.fn();

    mockedChokidarWatch.mockReturnValue({
      on: vi.fn((event: string, handler: WatcherHandler) => {
        watcherHandlers[event] = handler;
      }),
    } as unknown as FSWatcher);
    mockProvisionedBuild();
    mockedQueueBuild.mockResolvedValue(
      {} as Awaited<ReturnType<typeof queueBuild>>
    );
    mockedUploadFileToBuild.mockResolvedValue(
      {} as Awaited<ReturnType<typeof uploadFileToBuild>>
    );
    mockedDeleteFileFromBuild.mockResolvedValue(
      {} as Awaited<ReturnType<typeof deleteFileFromBuild>>
    );
    mockedIsAllowedExtension.mockReturnValue(true);
    mockedShouldIgnoreFile.mockReturnValue(false);
    mockedIsSpecifiedError.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createWatcher()', () => {
    it('should provision a new build with the project name and platform version', async () => {
      await startWatcher();

      expect(mockedProvisionBuild).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockProjectConfig.name,
        mockProjectConfig.platformVersion
      );
    });

    it('should pass the new build id to the user input handler', async () => {
      await startWatcher();

      expect(handleUserInput).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockProjectConfig.name,
        BUILD_ID
      );
    });

    it('should watch the project source directory and ignore initial files', async () => {
      await startWatcher();

      expect(mockedChokidarWatch).toHaveBeenCalledWith(
        SOURCE_DIR,
        expect.objectContaining({ ignoreInitial: true })
      );
    });

    it('should register handlers for file and directory events', async () => {
      await startWatcher();

      expect(Object.keys(watcherHandlers).sort()).toEqual([
        'add',
        'change',
        'ready',
        'unlink',
        'unlinkDir',
      ]);
    });

    it('should log that it is watching once the watcher is ready', async () => {
      await startWatcher();

      await watcherHandlers.ready();

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        commands.project.watch.logs.watching(PROJECT_DIR)
      );
    });

    it('should pass the ignore rules to the watcher', async () => {
      await startWatcher();
      const { ignored } = mockedChokidarWatch.mock.calls[0][1] as {
        ignored: (file: string) => boolean;
      };
      mockedShouldIgnoreFile.mockReturnValue(true);

      expect(ignored('some/file.js')).toBe(true);
      expect(mockedShouldIgnoreFile).toHaveBeenCalledWith('some/file.js');
    });

    it('should reject and not start watching when the build cannot be provisioned', async () => {
      mockedProvisionBuild.mockRejectedValue(new Error('boom'));

      await expect(startWatcher()).rejects.toThrow('boom');
      expect(mockedLogError).toHaveBeenCalled();
      expect(mockedChokidarWatch).not.toHaveBeenCalled();
    });

    it('should cancel the staged build when the project is locked', async () => {
      mockedProvisionBuild.mockRejectedValue(new Error('locked'));
      mockedIsSpecifiedError.mockImplementation(
        (_error, { subCategory }) =>
          subCategory === PROJECT_ERROR_TYPES.PROJECT_LOCKED
      );

      await expect(startWatcher()).rejects.toThrow('locked');
      expect(mockedCancelStagedBuild).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockProjectConfig.name
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        commands.project.watch.logs.previousStagingBuildCancelled
      );
    });

    it('should not cancel the staged build for other provisioning errors', async () => {
      mockedProvisionBuild.mockRejectedValue(new Error('boom'));

      await expect(startWatcher()).rejects.toThrow('boom');
      expect(mockedCancelStagedBuild).not.toHaveBeenCalled();
    });
  });

  describe('file events', () => {
    const filePath = path.join(SOURCE_DIR, 'app', 'card.json');
    const remotePath = path.join('app', 'card.json');

    beforeEach(async () => {
      await startWatcher();
    });

    it.each(['add', 'change'])(
      'should upload the file to the build on %s',
      async event => {
        await watcherHandlers[event](filePath);
        await vi.advanceTimersByTimeAsync(0);

        expect(mockedUploadFileToBuild).toHaveBeenCalledWith(
          ACCOUNT_ID,
          mockProjectConfig.name,
          filePath,
          remotePath
        );
        expect(mockedUiLogger.log).toHaveBeenCalledWith(
          commands.project.watch.logs.uploadSucceeded(remotePath, filePath)
        );
      }
    );

    it('should delete the file from the build on unlink', async () => {
      await watcherHandlers.unlink(filePath);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockedDeleteFileFromBuild).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockProjectConfig.name,
        remotePath
      );
      expect(mockedUploadFileToBuild).not.toHaveBeenCalled();
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        commands.project.watch.logs.deleteFileSucceeded(remotePath)
      );
    });

    it('should delete the folder from the build on unlinkDir', async () => {
      await watcherHandlers.unlinkDir(filePath);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockedDeleteFileFromBuild).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockProjectConfig.name,
        remotePath
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        commands.project.watch.logs.deleteFolderSucceeded(remotePath)
      );
    });

    it('should not upload files with a disallowed extension', async () => {
      mockedIsAllowedExtension.mockReturnValue(false);

      await watcherHandlers.add(filePath);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockedUploadFileToBuild).not.toHaveBeenCalled();
      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        commands.project.watch.debug.extensionNotAllowed(filePath)
      );
    });

    it('should still delete files with a disallowed extension', async () => {
      mockedIsAllowedExtension.mockReturnValue(false);

      await watcherHandlers.unlink(filePath);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockedDeleteFileFromBuild).toHaveBeenCalled();
    });

    it('should not upload ignored files', async () => {
      mockedShouldIgnoreFile.mockReturnValue(true);

      await watcherHandlers.add(filePath);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockedUploadFileToBuild).not.toHaveBeenCalled();
      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        commands.project.watch.debug.ignored(filePath)
      );
    });

    it('should log a debug message and keep watching when an upload fails', async () => {
      mockedUploadFileToBuild.mockRejectedValue(new Error('upload failed'));

      await watcherHandlers.add(filePath);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        commands.project.watch.errors.uploadFailed(remotePath, filePath)
      );
      expect(handleWatchTermination).not.toHaveBeenCalled();
    });
  });

  describe('build debouncing', () => {
    const filePath = path.join(SOURCE_DIR, 'card.json');

    beforeEach(async () => {
      await startWatcher();
    });

    it('should not queue a build before the debounce delay has elapsed', async () => {
      await watcherHandlers.add(filePath);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);

      expect(mockedQueueBuild).not.toHaveBeenCalled();
    });

    it('should queue a build once the debounce delay has elapsed', async () => {
      await watcherHandlers.add(filePath);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

      expect(mockedQueueBuild).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockProjectConfig.name,
        mockProjectConfig.platformVersion
      );
    });

    it('should queue only one build for several rapid file events', async () => {
      await watcherHandlers.add(filePath);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
      await watcherHandlers.change(filePath);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
      await watcherHandlers.change(filePath);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

      expect(mockedQueueBuild).toHaveBeenCalledTimes(1);
    });

    it('should report build status and start a new staging build after queueing', async () => {
      mockProvisionedBuild(BUILD_ID);
      await watcherHandlers.add(filePath);
      mockProvisionedBuild(BUILD_ID + 1);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

      expect(handleBuildStatus).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockProjectConfig.name,
        BUILD_ID
      );
      expect(mockedProvisionBuild).toHaveBeenCalledTimes(2);
      expect(handleUserInput).toHaveBeenLastCalledWith(
        ACCOUNT_ID,
        mockProjectConfig.name,
        BUILD_ID + 1
      );
      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        commands.project.watch.logs.resuming
      );
    });

    it('should terminate the watch without an error when the project was cancelled from the UI', async () => {
      mockedQueueBuild.mockRejectedValue(new Error('no provision'));
      mockedIsSpecifiedError.mockImplementation(
        (_error, { subCategory }) =>
          subCategory === PROJECT_ERROR_TYPES.MISSING_PROJECT_PROVISION
      );

      await watcherHandlers.add(filePath);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

      expect(mockedUiLogger.log).toHaveBeenCalledWith(
        commands.project.watch.logs.watchCancelledFromUi
      );
      expect(handleWatchTermination).toHaveBeenCalledWith();
      expect(handleBuildStatus).not.toHaveBeenCalled();
    });

    it('should log the error and skip build status when queueing fails for another reason', async () => {
      const error = new Error('queue failed');
      mockedQueueBuild.mockRejectedValue(error);

      await watcherHandlers.add(filePath);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

      expect(mockedLogError).toHaveBeenCalledWith(error, expect.anything());
      expect(handleBuildStatus).not.toHaveBeenCalled();
      expect(handleWatchTermination).not.toHaveBeenCalled();
    });

    it('should terminate the watch with the error when handling build status throws', async () => {
      const error = new Error('status failed');
      handleBuildStatus.mockRejectedValue(error);

      await watcherHandlers.add(filePath);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

      expect(handleWatchTermination).toHaveBeenCalledWith(error);
    });

    it('should hold events received while a build is queueing and upload them afterwards', async () => {
      const queuedFile = path.join(SOURCE_DIR, 'queued.json');
      const heldFile = path.join(SOURCE_DIR, 'held.json');
      let finishQueueBuild: () => void = () => {};
      mockedQueueBuild.mockReturnValue(
        new Promise(resolve => {
          finishQueueBuild = () =>
            resolve({} as Awaited<ReturnType<typeof queueBuild>>);
        })
      );

      await watcherHandlers.add(queuedFile);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      await watcherHandlers.add(heldFile);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockedUploadFileToBuild).not.toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockProjectConfig.name,
        heldFile,
        expect.any(String)
      );

      finishQueueBuild();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockedUploadFileToBuild).toHaveBeenCalledWith(
        ACCOUNT_ID,
        mockProjectConfig.name,
        heldFile,
        path.relative(SOURCE_DIR, heldFile)
      );
    });

    it('should log a debug message instead of queueing a held file twice', async () => {
      const heldFile = path.join(SOURCE_DIR, 'held.json');
      mockedQueueBuild.mockReturnValue(new Promise(() => {}));

      await watcherHandlers.add(filePath);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      await watcherHandlers.add(heldFile);
      await watcherHandlers.change(heldFile);

      expect(mockedUiLogger.debug).toHaveBeenCalledWith(
        commands.project.watch.debug.fileAlreadyQueued(heldFile)
      );
    });
  });
});
