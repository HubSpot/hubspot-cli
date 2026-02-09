import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import fs from 'fs';
import path from 'path';
import * as fileManagerLib from '@hubspot/local-dev-lib/fileManager';
import * as fileManagerApiLib from '@hubspot/local-dev-lib/api/fileManager';
import * as pathLib from '@hubspot/local-dev-lib/path';
import * as modulesLib from '@hubspot/local-dev-lib/cms/modules';
import * as ignoreRulesLib from '@hubspot/local-dev-lib/ignoreRules';
import * as configLib from '@hubspot/local-dev-lib/config';
import {
  addGlobalOptions,
  addConfigOptions,
  addAccountOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import * as errorHandlers from '../../../lib/errorHandlers/index.js';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import fileManagerUploadCommand from '../upload.js';

vi.mock('../../../lib/commonOpts');
vi.mock('fs');
vi.mock('@hubspot/local-dev-lib/fileManager');
vi.mock('@hubspot/local-dev-lib/api/fileManager');
vi.mock('@hubspot/local-dev-lib/path');
vi.mock('@hubspot/local-dev-lib/cms/modules');
vi.mock('@hubspot/local-dev-lib/ignoreRules');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../lib/errorHandlers/index.js');

const uploadFolderSpy = vi.spyOn(fileManagerLib, 'uploadFolder');
const uploadFileSpy = vi.spyOn(fileManagerApiLib, 'uploadFile');
const statSyncSpy = vi.spyOn(fs, 'statSync');
const validateSrcAndDestPathsSpy = vi.spyOn(
  modulesLib,
  'validateSrcAndDestPaths'
);
const shouldIgnoreFileSpy = vi.spyOn(ignoreRulesLib, 'shouldIgnoreFile');
const getCwdSpy = vi.spyOn(pathLib, 'getCwd');
const convertToUnixPathSpy = vi.spyOn(pathLib, 'convertToUnixPath');
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');
const processExitSpy = vi.spyOn(process, 'exit');
const logErrorSpy = vi.spyOn(errorHandlers, 'logError');
const getConfigAccountIfExistsSpy = vi.spyOn(
  configLib,
  'getConfigAccountIfExists'
);

describe('commands/filemanager/upload', () => {
  const yargsMock = yargs as Argv;

  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    getCwdSpy.mockReturnValue('/test/cwd');
    convertToUnixPathSpy.mockImplementation(p => p.replace(/\\/g, '/'));
    validateSrcAndDestPathsSpy.mockResolvedValue([]);
    // Mock config to prevent reading actual config file in CI
    getConfigAccountIfExistsSpy.mockReturnValue(undefined);
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(fileManagerUploadCommand.command).toEqual('upload <src> <dest>');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(fileManagerUploadCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      fileManagerUploadCommand.builder(yargsMock);

      expect(addGlobalOptions).toHaveBeenCalledTimes(1);
      expect(addGlobalOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<{
      src: string;
      dest: string;
      derivedAccountId: number;
      d: boolean;
      debug: boolean;
    }>;

    beforeEach(() => {
      args = {
        src: 'test.js',
        dest: '/dest/test.js',
        derivedAccountId: 123456,
        d: false,
        debug: false,
      } as ArgumentsCamelCase<{
        src: string;
        dest: string;
        derivedAccountId: number;
        d: boolean;
        debug: boolean;
      }>;
    });

    describe('validation', () => {
      it('should error if src path is invalid', async () => {
        statSyncSpy.mockImplementation(() => {
          throw new Error('File not found');
        });

        await fileManagerUploadCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('path to a file or folder')
        );
      });

      it('should error if src path is not a file or directory', async () => {
        statSyncSpy.mockReturnValue({
          isFile: () => false,
          isDirectory: () => false,
        } as fs.Stats);

        await fileManagerUploadCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('path to a file or folder')
        );
      });

      it('should error if dest is not provided', async () => {
        args.dest = '';
        statSyncSpy.mockReturnValue({
          isFile: () => true,
          isDirectory: () => false,
        } as fs.Stats);

        await fileManagerUploadCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('destination')
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
        // @ts-expect-error Mock return value doesn't need full type implementation
        uploadFileSpy.mockResolvedValue({});

        await fileManagerUploadCommand.handler(args);

        expect(uiLogger.error).toHaveBeenCalledWith('Invalid path');
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });
    });

    describe('file upload', () => {
      beforeEach(() => {
        statSyncSpy.mockReturnValue({
          isFile: () => true,
          isDirectory: () => false,
        } as fs.Stats);
        shouldIgnoreFileSpy.mockReturnValue(false);
      });

      it('should track command usage for file uploads', async () => {
        // @ts-expect-error Mock return value doesn't need full type implementation
        uploadFileSpy.mockResolvedValue({});

        await fileManagerUploadCommand.handler(args);

        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'filemanager-upload',
          { type: 'file' },
          123456
        );
      });

      it('should upload a file successfully', async () => {
        // @ts-expect-error Mock return value doesn't need full type implementation
        uploadFileSpy.mockResolvedValue({});

        await fileManagerUploadCommand.handler(args);

        expect(uploadFileSpy).toHaveBeenCalledWith(
          123456,
          path.resolve('/test/cwd', 'test.js'),
          '/dest/test.js'
        );
        expect(uiLogger.success).toHaveBeenCalledWith(
          expect.stringContaining('test.js')
        );
      });

      it('should error if file is ignored', async () => {
        shouldIgnoreFileSpy.mockReturnValue(true);

        await fileManagerUploadCommand.handler(args);

        expect(uploadFileSpy).not.toHaveBeenCalled();
        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('ignored')
        );
      });

      it('should handle upload errors', async () => {
        vi.useFakeTimers();
        const error = new Error('Upload failed');
        uploadFileSpy.mockRejectedValue(error);

        await fileManagerUploadCommand.handler(args);
        await vi.runAllTimersAsync();

        expect(uiLogger.error).toHaveBeenCalled();
        expect(logErrorSpy).toHaveBeenCalledWith(
          error,
          expect.any(errorHandlers.ApiErrorContext)
        );
        vi.useRealTimers();
      });
    });

    describe('folder upload', () => {
      beforeEach(() => {
        statSyncSpy.mockReturnValue({
          isFile: () => false,
          isDirectory: () => true,
        } as fs.Stats);
        // @ts-expect-error Mock return value doesn't need full type implementation
        uploadFolderSpy.mockResolvedValue({});
      });

      it('should track command usage for folder uploads', async () => {
        await fileManagerUploadCommand.handler(args);

        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'filemanager-upload',
          { type: 'folder' },
          123456
        );
      });

      it('should upload a folder successfully', async () => {
        await fileManagerUploadCommand.handler(args);

        expect(uploadFolderSpy).toHaveBeenCalledWith(
          123456,
          path.resolve('/test/cwd', 'test.js'),
          '/dest/test.js'
        );
        expect(uiLogger.success).toHaveBeenCalledWith(
          expect.stringContaining('complete')
        );
      });

      it('should handle folder upload errors', async () => {
        vi.useFakeTimers();
        const error = new Error('Folder upload failed');
        uploadFolderSpy.mockRejectedValue(error);

        await fileManagerUploadCommand.handler(args);
        await vi.runAllTimersAsync();

        expect(uiLogger.error).toHaveBeenCalled();
        expect(logErrorSpy).toHaveBeenCalledWith(error, {
          accountId: 123456,
        });
        vi.useRealTimers();
      });
    });
  });
});
