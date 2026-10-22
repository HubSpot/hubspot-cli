import yargs, { ArgumentsCamelCase, Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts.js';
import projectDownloadCommand, {
  type ProjectDownloadArgs,
} from '../download.js';
import {
  downloadProject,
  fetchProjectBuilds,
} from '@hubspot/local-dev-lib/api/projects';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import {
  getIsInProject,
  getProjectConfig,
} from '../../../lib/projects/config.js';
import { confirmPrompt } from '../../../lib/prompts/promptUtils.js';
import {
  archiveDestExists,
  getProjectArchiveDest,
  moveSourceToProjectArchive,
  restoreSourceFromProjectArchive,
} from '../../../lib/projects/archive.js';
import {
  copyArchivedFilesToSource,
  getFilesOnlyInArchive,
  writeArchiveDiffFile,
} from '../../../lib/projects/archiveDiff.js';
import { downloadProjectPrompt } from '../../../lib/prompts/downloadProjectPrompt.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';

vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('../../../lib/projects/config.js');
vi.mock('../../../lib/projects/archive.js');
vi.mock('../../../lib/projects/archiveDiff.js');
vi.mock('../../../lib/prompts/downloadProjectPrompt.js');
vi.mock('../../../lib/prompts/promptUtils.js');
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/archive', () => ({
  extractZipArchive: vi.fn().mockResolvedValue(true),
}));
vi.mock('@hubspot/local-dev-lib/path', () => ({
  getCwd: vi.fn(() => '/cwd'),
  sanitizeFileName: vi.fn((name: string) => name),
}));
vi.mock('../../../lib/errors/PromptExitError.js', () => ({
  isPromptExitError: vi.fn(() => false),
}));
vi.mock('../../../lib/yargs/makeWrappedYargsHandler', () => ({
  makeWrappedYargsHandler: (
    _name: string,
    handler: (...args: unknown[]) => unknown
  ) => handler,
}));

const mockedGetIsInProject = vi.mocked(getIsInProject);
const mockedGetProjectConfig = vi.mocked(getProjectConfig);
const mockedArchiveDestExists = vi.mocked(archiveDestExists);
const mockedMoveSourceToProjectArchive = vi.mocked(moveSourceToProjectArchive);
const mockedGetFilesOnlyInArchive = vi.mocked(getFilesOnlyInArchive);
const mockedWriteArchiveDiffFile = vi.mocked(writeArchiveDiffFile);
const mockedCopyArchivedFilesToSource = vi.mocked(copyArchivedFilesToSource);
const mockedRestoreSourceFromProjectArchive = vi.mocked(
  restoreSourceFromProjectArchive
);
const mockedGetProjectArchiveDest = vi.mocked(getProjectArchiveDest);
const mockedConfirmPrompt = vi.mocked(confirmPrompt);
const mockedDownloadProjectPrompt = vi.mocked(downloadProjectPrompt);
const mockedFetchProjectBuilds = vi.mocked(fetchProjectBuilds);
const mockedDownloadProject = vi.mocked(downloadProject);
const mockedExtractZipArchive = vi.mocked(extractZipArchive);
const mockedUiLogger = vi.mocked(uiLogger);

describe('commands/project/download', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectDownloadCommand.command).toEqual('download');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectDownloadCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectDownloadCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define project, dest, build, force, and keep-local-files options', () => {
      const optionsSpy = vi.spyOn(yargsMock, 'options');
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      projectDownloadCommand.builder(yargsMock);

      expect(optionsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          project: expect.any(Object),
          dest: expect.any(Object),
          build: expect.any(Object),
          force: expect.any(Object),
          'keep-local-files': expect.any(Object),
        })
      );

      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    const mockExit = vi.fn();
    const mockAddJsonOutput = vi.fn();
    const mockArgs = {
      derivedAccountId: 100,
      formatOutputAsJson: false,
      exit: mockExit,
      addUsageMetadata: vi.fn(),
      addJsonOutput: mockAddJsonOutput,
    } as unknown as ArgumentsCamelCase<ProjectDownloadArgs>;

    beforeEach(() => {
      mockedGetIsInProject.mockReturnValue(false);
      mockedGetProjectConfig.mockReturnValue({
        projectDir: '/cwd/myProject',
        projectConfig: { name: 'myProject', srcDir: 'src' },
      } as unknown as ReturnType<typeof getProjectConfig>);
      mockedConfirmPrompt.mockResolvedValue(true);
      mockedGetProjectArchiveDest.mockReturnValue('/cwd/myProject/archive');
      mockedArchiveDestExists.mockReturnValue(false);
      mockedGetFilesOnlyInArchive.mockResolvedValue([]);
      mockedCopyArchivedFilesToSource.mockReturnValue({
        copiedCount: 2,
        failures: [],
      });
      mockedWriteArchiveDiffFile.mockReturnValue(
        '/cwd/myProject/archive/diff.json'
      );
      mockedDownloadProjectPrompt.mockResolvedValue({ project: 'myProject' });
      mockedFetchProjectBuilds.mockResolvedValue({
        data: { results: [{ buildId: 7 }] },
      } as unknown as Awaited<ReturnType<typeof fetchProjectBuilds>>);
      mockedDownloadProject.mockResolvedValue({
        data: Buffer.from('zip'),
      } as unknown as Awaited<ReturnType<typeof downloadProject>>);
    });

    it('should use the current project name and directory when run inside a project', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler(mockArgs);

      expect(mockedDownloadProjectPrompt).toHaveBeenCalledWith(
        expect.objectContaining({ project: 'myProject' })
      );
      expect(mockedExtractZipArchive).toHaveBeenCalledWith(
        expect.anything(),
        'myProject',
        '/cwd/myProject'
      );
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should confirm before archiving the current project source', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler(mockArgs);

      expect(mockedConfirmPrompt).toHaveBeenCalledWith(expect.any(String), {
        defaultAnswer: false,
      });
    });

    it('should warn about the archive before prompting, keeping the prompt short', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler(mockArgs);

      const [message] = mockedConfirmPrompt.mock.calls[0];
      expect(message).toBe(
        '[--force] Download build "7" of project "myProject"?'
      );
      expect(mockedUiLogger.warn.mock.invocationCallOrder[0]).toBeLessThan(
        mockedConfirmPrompt.mock.invocationCallOrder[0]
      );
    });

    it('should recommend making a backup in the warning before prompting', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler(mockArgs);

      const [message] = mockedUiLogger.warn.mock.calls[0];
      expect(message).toContain(
        'Back up any local changes in this project before you continue.'
      );
    });

    it('should log a blank line between the warning and the prompt', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler(mockArgs);

      const blankLineOrder = mockedUiLogger.log.mock.calls.findIndex(
        ([message]) => message === ''
      );
      expect(blankLineOrder).toBeGreaterThan(-1);
      expect(
        mockedUiLogger.log.mock.invocationCallOrder[blankLineOrder]
      ).toBeGreaterThan(mockedUiLogger.warn.mock.invocationCallOrder[0]);
      expect(
        mockedUiLogger.log.mock.invocationCallOrder[blankLineOrder]
      ).toBeLessThan(mockedConfirmPrompt.mock.invocationCallOrder[0]);
    });

    it('should show the archive path relative to the current directory in the warning', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler(mockArgs);

      const [message] = mockedUiLogger.warn.mock.calls[0];
      expect(message).toContain('myProject/archive');
      expect(message).not.toContain('/cwd');
    });

    it('should describe the archive as a directory in the project root when the source is a subdirectory', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler(mockArgs);

      const [message] = mockedUiLogger.warn.mock.calls[0];
      expect(message).toContain('project source files');
      expect(message).toContain('archive directory in your project root');
    });

    it('should archive into the project root when the source directory is the project root', async () => {
      mockedGetIsInProject.mockReturnValue(true);
      mockedGetProjectConfig.mockReturnValue({
        projectDir: '/cwd/myProject',
        projectConfig: { name: 'myProject', srcDir: '.' },
      } as unknown as ReturnType<typeof getProjectConfig>);

      await projectDownloadCommand.handler(mockArgs);

      const [message] = mockedUiLogger.warn.mock.calls[0];
      expect(message).toContain('archive directory in your project root');
      expect(mockedMoveSourceToProjectArchive).toHaveBeenCalledWith(
        '/cwd/myProject',
        '.'
      );
    });

    it('should archive the current source, extract the build, and log where the files went', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler(mockArgs);

      expect(mockedMoveSourceToProjectArchive).toHaveBeenCalledWith(
        '/cwd/myProject',
        'src'
      );
      expect(mockedUiLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('myProject/archive')
      );
      expect(mockAddJsonOutput).toHaveBeenCalledWith(
        expect.objectContaining({ archiveDest: '/cwd/myProject/archive' })
      );
    });

    describe('copying archived files back', () => {
      beforeEach(() => {
        mockedGetIsInProject.mockReturnValue(true);
        mockedGetFilesOnlyInArchive.mockResolvedValue(['app/local-notes.md']);
      });

      it('should offer to copy archived files back after downloading', async () => {
        await projectDownloadCommand.handler(mockArgs);

        expect(mockedConfirmPrompt).toHaveBeenCalledTimes(2);
        expect(mockedCopyArchivedFilesToSource).toHaveBeenCalledTimes(1);
      });

      it('should not prompt or copy archived files back when force is set without keep-local-files', async () => {
        await projectDownloadCommand.handler({ ...mockArgs, force: true });

        expect(mockedConfirmPrompt).not.toHaveBeenCalled();
        expect(mockedCopyArchivedFilesToSource).not.toHaveBeenCalled();
      });

      it('should not prompt or copy archived files back when output is JSON without keep-local-files', async () => {
        await projectDownloadCommand.handler({
          ...mockArgs,
          formatOutputAsJson: true,
        });

        expect(mockedConfirmPrompt).not.toHaveBeenCalled();
        expect(mockedCopyArchivedFilesToSource).not.toHaveBeenCalled();
      });

      it('should copy archived files back without prompting when keep-local-files is true', async () => {
        await projectDownloadCommand.handler({
          ...mockArgs,
          force: true,
          keepLocalFiles: true,
        });

        expect(mockedConfirmPrompt).not.toHaveBeenCalled();
        expect(mockedCopyArchivedFilesToSource).toHaveBeenCalledTimes(1);
      });

      it('should skip copying archived files back without prompting when keep-local-files is false', async () => {
        await projectDownloadCommand.handler({
          ...mockArgs,
          force: true,
          keepLocalFiles: false,
        });

        expect(mockedConfirmPrompt).not.toHaveBeenCalled();
        expect(mockedCopyArchivedFilesToSource).not.toHaveBeenCalled();
      });

      it('should not copy archived files back when the source was not archived', async () => {
        mockedGetIsInProject.mockReturnValue(false);

        await projectDownloadCommand.handler(mockArgs);

        expect(mockedCopyArchivedFilesToSource).not.toHaveBeenCalled();
      });
    });

    it('should archive the source only after the build has been downloaded', async () => {
      mockedGetIsInProject.mockReturnValue(true);
      mockedDownloadProject.mockRejectedValue(new Error('Download failed'));

      await projectDownloadCommand.handler(mockArgs);

      expect(mockedMoveSourceToProjectArchive).not.toHaveBeenCalled();
      expect(mockedExtractZipArchive).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should restore the archived source when extraction fails', async () => {
      mockedGetIsInProject.mockReturnValue(true);
      mockedExtractZipArchive.mockRejectedValueOnce(new Error('Disk full'));

      await projectDownloadCommand.handler(mockArgs);

      expect(mockedRestoreSourceFromProjectArchive).toHaveBeenCalledWith(
        '/cwd/myProject',
        'src'
      );
      expect(mockedUiLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('have been restored')
      );
      expect(mockedUiLogger.info).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should exit with error when the archive directory already exists', async () => {
      mockedGetIsInProject.mockReturnValue(true);
      mockedArchiveDestExists.mockReturnValue(true);

      await projectDownloadCommand.handler(mockArgs);

      expect(mockedUiLogger.error).toHaveBeenCalled();
      expect(mockedConfirmPrompt).not.toHaveBeenCalled();
      expect(mockedDownloadProject).not.toHaveBeenCalled();
      expect(mockedMoveSourceToProjectArchive).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should not download or archive when the user declines', async () => {
      mockedGetIsInProject.mockReturnValue(true);
      mockedConfirmPrompt.mockResolvedValue(false);

      await projectDownloadCommand.handler(mockArgs);

      expect(mockedDownloadProject).not.toHaveBeenCalled();
      expect(mockedMoveSourceToProjectArchive).not.toHaveBeenCalled();
      expect(mockedExtractZipArchive).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should skip the confirmation but still archive when force is set', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler({ ...mockArgs, force: true });

      expect(mockedConfirmPrompt).not.toHaveBeenCalled();
      expect(mockedMoveSourceToProjectArchive).toHaveBeenCalledTimes(1);
      expect(mockedExtractZipArchive).toHaveBeenCalledTimes(1);
    });

    it('should skip the confirmation but still archive when output is JSON', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler({
        ...mockArgs,
        formatOutputAsJson: true,
      });

      expect(mockedConfirmPrompt).not.toHaveBeenCalled();
      expect(mockedMoveSourceToProjectArchive).toHaveBeenCalledTimes(1);
      expect(mockedExtractZipArchive).toHaveBeenCalledTimes(1);
    });

    it('should download the specified build when run inside a project', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler({ ...mockArgs, build: 3 });

      expect(mockedFetchProjectBuilds).not.toHaveBeenCalled();
      expect(mockedDownloadProject).toHaveBeenCalledWith(100, 'myProject', 3);
    });

    it('should not archive the current project when dest is provided', async () => {
      mockedGetIsInProject.mockReturnValue(true);

      await projectDownloadCommand.handler({ ...mockArgs, dest: 'out' });

      expect(mockedConfirmPrompt).not.toHaveBeenCalled();
      expect(mockedMoveSourceToProjectArchive).not.toHaveBeenCalled();
      expect(mockedExtractZipArchive).toHaveBeenCalledWith(
        expect.anything(),
        'myProject',
        '/cwd/out/myProject'
      );
    });

    it('should not archive the current project when a different project is selected', async () => {
      mockedGetIsInProject.mockReturnValue(true);
      mockedDownloadProjectPrompt.mockResolvedValue({ project: 'other' });

      await projectDownloadCommand.handler(mockArgs);

      expect(mockedConfirmPrompt).not.toHaveBeenCalled();
      expect(mockedMoveSourceToProjectArchive).not.toHaveBeenCalled();
      expect(mockedExtractZipArchive).toHaveBeenCalledWith(
        expect.anything(),
        'other',
        '/cwd/other'
      );
    });

    it('should exit with error when the project config cannot be loaded', async () => {
      mockedGetIsInProject.mockReturnValue(true);
      mockedGetProjectConfig.mockImplementation(() => {
        throw new Error('Invalid config');
      });

      await projectDownloadCommand.handler(mockArgs);

      expect(mockedDownloadProject).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should not prompt or archive when run outside a project', async () => {
      await projectDownloadCommand.handler(mockArgs);

      expect(mockedConfirmPrompt).not.toHaveBeenCalled();
      expect(mockedMoveSourceToProjectArchive).not.toHaveBeenCalled();
    });

    it('should download, log success, and add JSON output', async () => {
      await projectDownloadCommand.handler(mockArgs);

      expect(mockedExtractZipArchive).toHaveBeenCalledTimes(1);
      expect(mockAddJsonOutput).toHaveBeenCalledWith({
        projectName: 'myProject',
        buildId: 7,
        dest: '/cwd/myProject',
      });
      expect(mockedUiLogger.log).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });
  });
});
