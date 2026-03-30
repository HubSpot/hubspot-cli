import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import fs from 'fs';
import path from 'path';
import * as uploadFolderLib from '@hubspot/local-dev-lib/cms/uploadFolder';
import * as fileMapperLib from '@hubspot/local-dev-lib/api/fileMapper';
import * as pathLib from '@hubspot/local-dev-lib/path';
import * as modulesLib from '@hubspot/local-dev-lib/cms/modules';
import * as ignoreRulesLib from '@hubspot/local-dev-lib/ignoreRules';
import * as themesLib from '@hubspot/local-dev-lib/cms/themes';
import * as configLib from '@hubspot/local-dev-lib/config';
import * as handleFieldsJSLib from '@hubspot/local-dev-lib/cms/handleFieldsJS';
import { uiLogger } from '../../../lib/ui/logger.js';
import * as errorHandlers from '../../../lib/errorHandlers/index.js';
import * as commonOpts from '../../../lib/commonOpts.js';
import * as uploadPromptLib from '../../../lib/prompts/uploadPrompt.js';
import * as promptUtilsLib from '../../../lib/prompts/promptUtils.js';
import * as validationLib from '../../../lib/validation.js';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import * as uploadLib from '../../../lib/upload.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import uploadCommand, { UploadArgs } from '../upload.js';

vi.mock('fs');
vi.mock('@hubspot/local-dev-lib/cms/uploadFolder');
vi.mock('@hubspot/local-dev-lib/api/fileMapper');
vi.mock('@hubspot/local-dev-lib/path');
vi.mock('@hubspot/local-dev-lib/cms/modules');
vi.mock('@hubspot/local-dev-lib/ignoreRules');
vi.mock('@hubspot/local-dev-lib/cms/themes');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('@hubspot/local-dev-lib/cms/handleFieldsJS');
vi.mock('../../../lib/errorHandlers/index.js');
vi.mock('../../../lib/commonOpts.js');
vi.mock('../../../lib/prompts/uploadPrompt.js');
vi.mock('../../../lib/prompts/promptUtils.js');
vi.mock('../../../lib/validation.js');
vi.mock('../../../lib/upload.js');

const uploadFolderSpy = vi.spyOn(uploadFolderLib, 'uploadFolder');
const uploadSpy = vi.spyOn(fileMapperLib, 'upload');
const deleteFileSpy = vi.spyOn(fileMapperLib, 'deleteFile');
const statSyncSpy = vi.spyOn(fs, 'statSync');
const validateSrcAndDestPathsSpy = vi.spyOn(
  modulesLib,
  'validateSrcAndDestPaths'
);
const shouldIgnoreFileSpy = vi.spyOn(ignoreRulesLib, 'shouldIgnoreFile');
const isAllowedExtensionSpy = vi.spyOn(pathLib, 'isAllowedExtension');
const getCwdSpy = vi.spyOn(pathLib, 'getCwd');
const convertToUnixPathSpy = vi.spyOn(pathLib, 'convertToUnixPath');
const uploadPromptSpy = vi.spyOn(uploadPromptLib, 'uploadPrompt');
const confirmPromptSpy = vi.spyOn(promptUtilsLib, 'confirmPrompt');
const validateCmsPublishModeSpy = vi.spyOn(
  validationLib,
  'validateCmsPublishMode'
);
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');
const getUploadableFileListSpy = vi.spyOn(uploadLib, 'getUploadableFileList');
const getCmsPublishModeSpy = vi.spyOn(commonOpts, 'getCmsPublishMode');
const getThemePreviewUrlSpy = vi.spyOn(themesLib, 'getThemePreviewUrl');
const getThemeJSONPathSpy = vi.spyOn(themesLib, 'getThemeJSONPath');
const hasUploadErrorsSpy = vi.spyOn(uploadFolderLib, 'hasUploadErrors');
const processExitSpy = vi.spyOn(process, 'exit');
const logErrorSpy = vi.spyOn(errorHandlers, 'logError');
const getConfigAccountIfExistsSpy = vi.spyOn(
  configLib,
  'getConfigAccountIfExists'
);
const isConvertableFieldJsSpy = vi.spyOn(
  handleFieldsJSLib,
  'isConvertableFieldJs'
);

describe('commands/cms/upload', () => {
  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    getCwdSpy.mockReturnValue('/test/cwd');
    convertToUnixPathSpy.mockImplementation(p => p.replace(/\\/g, '/'));
    validateCmsPublishModeSpy.mockReturnValue(true);
    getCmsPublishModeSpy.mockReturnValue('publish');
    uploadPromptSpy.mockResolvedValue({ src: '', dest: '' });
    validateSrcAndDestPathsSpy.mockResolvedValue([]);
    getThemeJSONPathSpy.mockReturnValue(null);
    getThemePreviewUrlSpy.mockReturnValue(undefined);
    // Mock config to prevent reading actual config file in CI
    getConfigAccountIfExistsSpy.mockReturnValue(undefined);
    isConvertableFieldJsSpy.mockReturnValue(false);
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(uploadCommand.command).toEqual('upload [src] [dest]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(uploadCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      const optionsSpy = vi.spyOn(yargs as Argv, 'option');
      const positionalSpy = vi.spyOn(yargs as Argv, 'positional');

      uploadCommand.builder(yargs as Argv);

      expect(positionalSpy).toHaveBeenCalledWith(
        'src',
        expect.objectContaining({ type: 'string' })
      );
      expect(positionalSpy).toHaveBeenCalledWith(
        'dest',
        expect.objectContaining({ type: 'string' })
      );
      expect(optionsSpy).toHaveBeenCalledWith(
        'field-options',
        expect.objectContaining({ type: 'array' })
      );
      expect(optionsSpy).toHaveBeenCalledWith(
        'save-output',
        expect.objectContaining({ type: 'boolean' })
      );
      expect(optionsSpy).toHaveBeenCalledWith(
        'convert-fields',
        expect.objectContaining({ type: 'boolean' })
      );
      expect(optionsSpy).toHaveBeenCalledWith(
        'clean',
        expect.objectContaining({ type: 'boolean' })
      );
      expect(optionsSpy).toHaveBeenCalledWith(
        'force',
        expect.objectContaining({ type: 'boolean' })
      );
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<UploadArgs>;

    beforeEach(() => {
      args = {
        src: 'test.js',
        dest: '/dest/test.js',
        derivedAccountId: 123456,
      } as ArgumentsCamelCase<UploadArgs>;
    });

    describe('validation', () => {
      it('should exit if CMS publish mode validation fails', async () => {
        validateCmsPublishModeSpy.mockReturnValue(false);

        await uploadCommand.handler(args);

        expect(validateCmsPublishModeSpy).toHaveBeenCalledWith(args);
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.WARNING);
      });

      it('should prompt for src and dest when not provided', async () => {
        delete args.src;
        delete args.dest;
        uploadPromptSpy.mockResolvedValue({
          src: 'prompted.js',
          dest: '/prompted/dest.js',
        });
        statSyncSpy.mockReturnValue({
          isFile: () => true,
          isDirectory: () => false,
        } as fs.Stats);
        isAllowedExtensionSpy.mockReturnValue(true);
        shouldIgnoreFileSpy.mockReturnValue(false);
        // @ts-expect-error Mock return value doesn't need full type implementation
        uploadSpy.mockResolvedValue({});

        await uploadCommand.handler(args);

        expect(uploadPromptSpy).toHaveBeenCalledWith(args);
        expect(uploadSpy).toHaveBeenCalled();
      });

      it('should error if dest is not provided', async () => {
        args.dest = '';
        uploadPromptSpy.mockResolvedValue({ src: 'test.js', dest: '' });

        await uploadCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('destination')
        );
      });

      it('should error if src path is invalid', async () => {
        statSyncSpy.mockImplementation(() => {
          throw new Error('File not found');
        });

        await uploadCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('path to a file or folder')
        );
      });

      it('should error if src path is not a file or directory', async () => {
        statSyncSpy.mockReturnValue({
          isFile: () => false,
          isDirectory: () => false,
        } as fs.Stats);

        await uploadCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('path to a file or folder')
        );
      });

      it('should exit if src/dest validation fails', async () => {
        statSyncSpy.mockReturnValue({
          isFile: () => true,
          isDirectory: () => false,
        } as fs.Stats);
        validateSrcAndDestPathsSpy.mockResolvedValue([
          { id: '1', message: 'Invalid path' },
        ]);

        await uploadCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith('Invalid path');
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.WARNING);
      });
    });

    describe('file upload', () => {
      beforeEach(() => {
        statSyncSpy.mockReturnValue({
          isFile: () => true,
          isDirectory: () => false,
        } as fs.Stats);
        isAllowedExtensionSpy.mockReturnValue(true);
        shouldIgnoreFileSpy.mockReturnValue(false);
      });

      it('should track command usage for file uploads', async () => {
        // @ts-expect-error Mock return value doesn't need full type implementation
        uploadSpy.mockResolvedValue({});

        await uploadCommand.handler(args);

        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'upload',
          { mode: 'publish', type: 'file' },
          123456
        );
      });

      it('should upload a file successfully', async () => {
        // @ts-expect-error Mock return value doesn't need full type implementation
        uploadSpy.mockResolvedValue({});

        await uploadCommand.handler(args);

        expect(uploadSpy).toHaveBeenCalledWith(
          123456,
          path.resolve('/test/cwd', 'test.js'),
          '/dest/test.js',
          expect.any(Object)
        );
        expect(uiLogger.success).toHaveBeenCalledWith(
          expect.stringMatching(/uploaded/i)
        );
      });

      it('should error if file has disallowed extension', async () => {
        isAllowedExtensionSpy.mockReturnValue(false);

        await uploadCommand.handler(args);

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('path to a file or folder')
        );
      });

      it('should error if file is ignored', async () => {
        shouldIgnoreFileSpy.mockReturnValue(true);

        await uploadCommand.handler(args);

        expect(uploadSpy).not.toHaveBeenCalled();
        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('ignored')
        );
      });

      it('should handle upload errors', async () => {
        vi.useFakeTimers();
        const error = new Error('Upload failed');
        uploadSpy.mockRejectedValue(error);

        await uploadCommand.handler(args);
        await vi.runAllTimersAsync();

        expect(uiLogger.error).toHaveBeenCalled();
        expect(logErrorSpy).toHaveBeenCalledWith(
          error,
          expect.any(errorHandlers.ApiErrorContext)
        );
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.WARNING);
        vi.useRealTimers();
      });

      it('should log theme preview URL if available', async () => {
        getThemePreviewUrlSpy.mockReturnValue('http://preview.url');
        // @ts-expect-error Mock return value doesn't need full type implementation
        uploadSpy.mockResolvedValue({});

        await uploadCommand.handler(args);

        expect(getThemePreviewUrlSpy).toHaveBeenCalledWith('test.js', 123456);
        expect(uiLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('http://preview.url')
        );
      });
    });

    describe('folder upload', () => {
      beforeEach(() => {
        statSyncSpy.mockReturnValue({
          isFile: () => false,
          isDirectory: () => true,
        } as fs.Stats);
        getUploadableFileListSpy.mockResolvedValue([]);
        uploadFolderSpy.mockResolvedValue([]);
        hasUploadErrorsSpy.mockReturnValue(false);
      });

      it('should track command usage for folder uploads', async () => {
        await uploadCommand.handler(args);

        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'upload',
          { mode: 'publish', type: 'folder' },
          123456
        );
      });

      it('should upload a folder successfully', async () => {
        await uploadCommand.handler(args);

        expect(uploadFolderSpy).toHaveBeenCalledWith(
          123456,
          path.resolve('/test/cwd', 'test.js'),
          '/dest/test.js',
          {},
          expect.objectContaining({
            convertFields: undefined,
            saveOutput: undefined,
          }),
          []
        );
        expect(uiLogger.success).toHaveBeenCalledWith(
          expect.stringContaining('complete')
        );
      });

      it('should handle clean upload with confirmation', async () => {
        args.clean = true;
        confirmPromptSpy.mockResolvedValue(true);
        // @ts-expect-error Mock return value doesn't need full type implementation
        deleteFileSpy.mockResolvedValue({});

        await uploadCommand.handler(args);

        expect(confirmPromptSpy).toHaveBeenCalled();
        expect(deleteFileSpy).toHaveBeenCalledWith(123456, '/dest/test.js');
        // Check that log was called multiple times (upload message + cleaning message)
        expect(uiLogger.log).toHaveBeenCalled();
      });

      it('should skip clean upload if not confirmed', async () => {
        args.clean = true;
        confirmPromptSpy.mockResolvedValue(false);

        await uploadCommand.handler(args);

        expect(deleteFileSpy).not.toHaveBeenCalled();
      });

      it('should force clean upload without confirmation', async () => {
        args.clean = true;
        args.force = true;
        // @ts-expect-error Mock return value doesn't need full type implementation
        deleteFileSpy.mockResolvedValue({});

        await uploadCommand.handler(args);

        expect(confirmPromptSpy).not.toHaveBeenCalled();
        expect(deleteFileSpy).toHaveBeenCalledWith(123456, '/dest/test.js');
      });

      it('should handle delete errors during clean upload', async () => {
        args.clean = true;
        args.force = true;
        const error = new Error('Delete failed');
        deleteFileSpy.mockRejectedValue(error);

        await uploadCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Deleting')
        );
      });

      it('should error if folder upload has errors', async () => {
        hasUploadErrorsSpy.mockReturnValue(true);

        await uploadCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('failed')
        );
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.WARNING);
      });

      it('should handle folder upload errors', async () => {
        vi.useFakeTimers();
        const error = new Error('Folder upload failed');
        uploadFolderSpy.mockRejectedValue(error);

        await uploadCommand.handler(args);
        await vi.runAllTimersAsync();

        expect(uiLogger.error).toHaveBeenCalled();
        expect(logErrorSpy).toHaveBeenCalledWith(error, {
          accountId: 123456,
        });
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.WARNING);
        vi.useRealTimers();
      });

      it('should pass convertFields option to uploadFolder', async () => {
        args.convertFields = true;

        await uploadCommand.handler(args);

        expect(uploadFolderSpy).toHaveBeenCalledWith(
          123456,
          expect.any(String),
          expect.any(String),
          {},
          expect.objectContaining({
            convertFields: true,
          }),
          expect.any(Array)
        );
      });

      it('should generate uploadable file list with convertFields', async () => {
        args.convertFields = true;
        getUploadableFileListSpy.mockResolvedValue(['file1.js', 'file2.js']);

        await uploadCommand.handler(args);

        expect(getUploadableFileListSpy).toHaveBeenCalledWith(
          path.resolve('/test/cwd', 'test.js'),
          true
        );
      });
    });
  });
});
