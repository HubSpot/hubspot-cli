import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { uiLogger } from '../../ui/logger.js';
import { confirmPrompt } from '../../prompts/promptUtils.js';
import { getIsInProject, getProjectConfig } from '../config.js';
import {
  getProjectArchiveDest,
  restoreSourceFromProjectArchive,
} from '../archive.js';
import {
  copyArchivedFilesToSource,
  getFilesOnlyInArchive,
  writeArchiveDiffFile,
} from '../archiveDiff.js';
import {
  describeArchiveLocation,
  extractBuild,
  getDisplayPath,
  getLocalProject,
  handleArchivedSource,
  resolveDownloadDestination,
  type ArchivePlan,
} from '../download.js';

vi.mock('../config.js');
vi.mock('../archive.js');
vi.mock('../archiveDiff.js');
vi.mock('../../prompts/promptUtils.js');
vi.mock('../../errorHandlers/index.js');
vi.mock('@hubspot/local-dev-lib/archive', () => ({
  extractZipArchive: vi.fn().mockResolvedValue(true),
}));
vi.mock('@hubspot/local-dev-lib/path', () => ({
  getCwd: vi.fn(() => '/cwd'),
  sanitizeFileName: vi.fn((name: string) => name),
}));

const mockedGetIsInProject = vi.mocked(getIsInProject);
const mockedGetProjectConfig = vi.mocked(getProjectConfig);
const mockedGetProjectArchiveDest = vi.mocked(getProjectArchiveDest);
const mockedRestoreSourceFromProjectArchive = vi.mocked(
  restoreSourceFromProjectArchive
);
const mockedGetFilesOnlyInArchive = vi.mocked(getFilesOnlyInArchive);
const mockedWriteArchiveDiffFile = vi.mocked(writeArchiveDiffFile);
const mockedCopyArchivedFilesToSource = vi.mocked(copyArchivedFilesToSource);
const mockedConfirmPrompt = vi.mocked(confirmPrompt);
const mockedExtractZipArchive = vi.mocked(extractZipArchive);
const mockedUiLogger = vi.mocked(uiLogger);

const mockArchivePlan: ArchivePlan = {
  projectDir: '/cwd/myProject',
  srcDir: 'src',
  archiveDest: '/cwd/myProject/archive',
};

describe('lib/projects/download', () => {
  beforeEach(() => {
    mockedGetIsInProject.mockReturnValue(true);
    mockedGetProjectConfig.mockReturnValue({
      projectDir: '/cwd/myProject',
      projectConfig: { name: 'myProject', srcDir: 'src' },
    } as unknown as ReturnType<typeof getProjectConfig>);
    mockedGetProjectArchiveDest.mockReturnValue('/cwd/myProject/archive');
    mockedGetFilesOnlyInArchive.mockResolvedValue([]);
    mockedWriteArchiveDiffFile.mockReturnValue(
      '/cwd/myProject/archive/diff.json'
    );
    mockedCopyArchivedFilesToSource.mockReturnValue({
      copiedCount: 2,
      failures: [],
    });
    mockedConfirmPrompt.mockResolvedValue(true);
  });

  describe('getLocalProject()', () => {
    it('should return undefined when not run inside a project', () => {
      mockedGetIsInProject.mockReturnValue(false);

      expect(getLocalProject()).toBeUndefined();
      expect(mockedGetProjectConfig).not.toHaveBeenCalled();
    });

    it('should return the project name, directory, and source directory when run inside a project', () => {
      expect(getLocalProject()).toEqual({
        projectName: 'myProject',
        projectDir: '/cwd/myProject',
        srcDir: 'src',
      });
    });

    it('should throw when the project config cannot be loaded', () => {
      mockedGetProjectConfig.mockImplementation(() => {
        throw new Error('Invalid config');
      });

      expect(() => getLocalProject()).toThrow('Invalid config');
    });
  });

  describe('resolveDownloadDestination()', () => {
    const localProject = {
      projectName: 'myProject',
      projectDir: '/cwd/myProject',
      srcDir: 'src',
    };

    it('should download into the project and plan an archive when the local project is downloaded without a dest', () => {
      expect(
        resolveDownloadDestination({ projectName: 'myProject', localProject })
      ).toEqual({
        absoluteDestPath: '/cwd/myProject',
        archivePlan: mockArchivePlan,
      });
    });

    it('should download into the dest folder without an archive plan when dest is provided', () => {
      expect(
        resolveDownloadDestination({
          projectName: 'myProject',
          dest: 'out',
          localProject,
        })
      ).toEqual({ absoluteDestPath: '/cwd/out/myProject' });
    });

    it('should download into a new folder without an archive plan when a different project is selected', () => {
      expect(
        resolveDownloadDestination({ projectName: 'other', localProject })
      ).toEqual({ absoluteDestPath: '/cwd/other' });
    });

    it('should download into a new folder without an archive plan when run outside a project', () => {
      expect(resolveDownloadDestination({ projectName: 'myProject' })).toEqual({
        absoluteDestPath: '/cwd/myProject',
      });
    });
  });

  describe('getDisplayPath()', () => {
    it('should return the path relative to the current directory', () => {
      expect(getDisplayPath('/cwd/myProject/archive')).toBe(
        'myProject/archive'
      );
    });

    it('should return a dot when the path is the current directory', () => {
      expect(getDisplayPath('/cwd')).toBe('.');
    });
  });

  describe('describeArchiveLocation()', () => {
    it('should describe the archive as a directory in the project root using a relative path', () => {
      const description = describeArchiveLocation(mockArchivePlan);

      expect(description).toContain('archive directory in your project root');
      expect(description).toContain('myProject/archive');
      expect(description).not.toContain('/cwd');
    });
  });

  describe('extractBuild()', () => {
    const extractOptions = {
      zippedProject: Buffer.from('zip'),
      projectName: 'myProject',
      absoluteDestPath: '/cwd/myProject',
    };

    it('should extract the build into the destination', async () => {
      await extractBuild(extractOptions);

      expect(mockedExtractZipArchive).toHaveBeenCalledWith(
        extractOptions.zippedProject,
        'myProject',
        '/cwd/myProject'
      );
    });

    it('should restore the archived source and rethrow when extraction fails', async () => {
      mockedExtractZipArchive.mockRejectedValueOnce(new Error('Disk full'));

      await expect(
        extractBuild({ ...extractOptions, archivePlan: mockArchivePlan })
      ).rejects.toThrow('Disk full');

      expect(mockedRestoreSourceFromProjectArchive).toHaveBeenCalledWith(
        '/cwd/myProject',
        'src'
      );
      expect(mockedUiLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('have been restored')
      );
    });

    it('should tell the user where their files are and rethrow the original error when restoring fails', async () => {
      mockedExtractZipArchive.mockRejectedValueOnce(new Error('Disk full'));
      mockedRestoreSourceFromProjectArchive.mockImplementationOnce(() => {
        throw new Error('EPERM');
      });

      await expect(
        extractBuild({ ...extractOptions, archivePlan: mockArchivePlan })
      ).rejects.toThrow('Disk full');

      expect(mockedUiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('myProject/archive')
      );
      expect(mockedUiLogger.warn).not.toHaveBeenCalled();
    });

    it('should not restore anything and rethrow when extraction fails without an archive plan', async () => {
      mockedExtractZipArchive.mockRejectedValueOnce(new Error('Disk full'));

      await expect(extractBuild(extractOptions)).rejects.toThrow('Disk full');

      expect(mockedRestoreSourceFromProjectArchive).not.toHaveBeenCalled();
    });
  });

  describe('handleArchivedSource()', () => {
    const archivedFiles = ['app/local-notes.md', 'scripts/dev.js'];
    const options = { archivePlan: mockArchivePlan, canPrompt: true };

    it('should log where the previous contents were moved', async () => {
      await handleArchivedSource(options);

      expect(mockedUiLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('myProject/archive')
      );
    });

    describe('listing files only in the archive', () => {
      beforeEach(() => {
        mockedGetFilesOnlyInArchive.mockResolvedValue(archivedFiles);
      });

      it('should list the files that only exist in the archive', async () => {
        await handleArchivedSource(options);

        expect(mockedGetFilesOnlyInArchive).toHaveBeenCalledWith(
          '/cwd/myProject',
          'src'
        );
        expect(mockedUiLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('app/local-notes.md')
        );
        expect(mockedUiLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('scripts/dev.js')
        );
      });

      it('should use the header that says the files are available in the archive directory', async () => {
        await handleArchivedSource(options);

        expect(mockedUiLogger.log).toHaveBeenCalledWith(
          expect.stringContaining(
            'These files existed locally but are not in the downloaded build. They are available in the archive directory:'
          )
        );
      });

      it('should log a blank line before the list', async () => {
        await handleArchivedSource(options);

        const messages = mockedUiLogger.log.mock.calls.map(
          ([message]) => message
        );
        const listIndex = messages.findIndex(message =>
          message.includes('These files existed locally')
        );
        expect(messages[listIndex - 1]).toBe('');
      });

      it('should write the full list of files to the archive diff file', async () => {
        const files = Array.from(
          { length: 30 },
          (_, index) => `file-${index}.md`
        );
        mockedGetFilesOnlyInArchive.mockResolvedValue(files);

        await handleArchivedSource(options);

        expect(mockedWriteArchiveDiffFile).toHaveBeenCalledWith(
          '/cwd/myProject/archive',
          files
        );
      });

      it('should cap the listed files, report how many were left out, and point to the diff file', async () => {
        mockedGetFilesOnlyInArchive.mockResolvedValue(
          Array.from({ length: 30 }, (_, index) => `file-${index}.md`)
        );

        await handleArchivedSource(options);

        expect(mockedUiLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('...and 5 more')
        );
        expect(mockedUiLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('The full list can be viewed in')
        );
        expect(mockedUiLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('myProject/archive/diff.json')
        );
        expect(mockedUiLogger.log).not.toHaveBeenCalledWith(
          expect.stringContaining('file-25.md')
        );
      });

      it('should not mention the diff file when every file is listed', async () => {
        await handleArchivedSource(options);

        expect(mockedUiLogger.log).not.toHaveBeenCalledWith(
          expect.stringContaining('full list')
        );
      });

      it('should not point to the diff file when writing it fails', async () => {
        mockedGetFilesOnlyInArchive.mockResolvedValue(
          Array.from({ length: 30 }, (_, index) => `file-${index}.md`)
        );
        mockedWriteArchiveDiffFile.mockImplementation(() => {
          throw new Error('EACCES');
        });

        await handleArchivedSource(options);

        expect(mockedUiLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('...and 5 more')
        );
        expect(mockedUiLogger.log).not.toHaveBeenCalledWith(
          expect.stringContaining('full list')
        );
      });

      it('should not throw when the files only in the archive cannot be listed', async () => {
        mockedGetFilesOnlyInArchive.mockRejectedValue(new Error('EACCES'));

        await expect(handleArchivedSource(options)).resolves.toBeUndefined();

        expect(mockedConfirmPrompt).not.toHaveBeenCalled();
      });
    });

    it('should not list files, write a diff file, or prompt when every archived file is in the downloaded build', async () => {
      await handleArchivedSource(options);

      expect(mockedWriteArchiveDiffFile).not.toHaveBeenCalled();
      expect(mockedConfirmPrompt).not.toHaveBeenCalled();
      expect(mockedCopyArchivedFilesToSource).not.toHaveBeenCalled();
    });

    describe('copying archived files back', () => {
      beforeEach(() => {
        mockedGetFilesOnlyInArchive.mockResolvedValue(archivedFiles);
      });

      it('should offer to copy the files back after listing them', async () => {
        await handleArchivedSource(options);

        expect(mockedConfirmPrompt).toHaveBeenCalledWith(
          '[--keep-local-files] Copy these 2 files back into your project source directory?'
        );
      });

      it('should log a blank line before the prompt', async () => {
        await handleArchivedSource(options);

        const blankLineOrders = mockedUiLogger.log.mock.calls
          .map(([message], index) =>
            message === ''
              ? mockedUiLogger.log.mock.invocationCallOrder[index]
              : -1
          )
          .filter(order => order > -1);
        expect(blankLineOrders).toContain(
          mockedConfirmPrompt.mock.invocationCallOrder[0] - 1
        );
      });

      it('should copy the files into the source directory when the user accepts', async () => {
        await handleArchivedSource(options);

        expect(mockedCopyArchivedFilesToSource).toHaveBeenCalledWith(
          '/cwd/myProject',
          'src',
          archivedFiles
        );
        expect(mockedUiLogger.success).toHaveBeenCalledWith(
          expect.stringContaining('Copied 2 files back to')
        );
      });

      it('should not copy the files when the user declines', async () => {
        mockedConfirmPrompt.mockResolvedValue(false);

        await handleArchivedSource(options);

        expect(mockedCopyArchivedFilesToSource).not.toHaveBeenCalled();
      });

      it('should copy without prompting when keepLocalFiles is true', async () => {
        await handleArchivedSource({
          archivePlan: mockArchivePlan,
          canPrompt: false,
          keepLocalFiles: true,
        });

        expect(mockedConfirmPrompt).not.toHaveBeenCalled();
        expect(mockedCopyArchivedFilesToSource).toHaveBeenCalledTimes(1);
      });

      it('should skip copying without prompting when keepLocalFiles is false', async () => {
        await handleArchivedSource({ ...options, keepLocalFiles: false });

        expect(mockedConfirmPrompt).not.toHaveBeenCalled();
        expect(mockedCopyArchivedFilesToSource).not.toHaveBeenCalled();
      });

      it('should not prompt or copy when prompting is not possible and keepLocalFiles is not set', async () => {
        await handleArchivedSource({ ...options, canPrompt: false });

        expect(mockedConfirmPrompt).not.toHaveBeenCalled();
        expect(mockedCopyArchivedFilesToSource).not.toHaveBeenCalled();
      });

      it('should warn about files that could not be copied', async () => {
        mockedCopyArchivedFilesToSource.mockReturnValue({
          copiedCount: 1,
          failures: [{ file: 'scripts/dev.js', error: new Error('EEXIST') }],
        });

        await handleArchivedSource(options);

        expect(mockedUiLogger.success).toHaveBeenCalledWith(
          expect.stringContaining('Copied 1 file back to')
        );
        expect(mockedUiLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('1 file could not be copied back')
        );
      });

      it('should not log a success message when no files could be copied', async () => {
        mockedCopyArchivedFilesToSource.mockReturnValue({
          copiedCount: 0,
          failures: [{ file: 'a.md', error: new Error('EEXIST') }],
        });

        await handleArchivedSource(options);

        expect(mockedUiLogger.success).not.toHaveBeenCalled();
      });
    });
  });
});
