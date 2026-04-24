import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import fs from 'fs';
import path from 'path';
import { AxiosError } from 'axios';
import * as watchLib from '@hubspot/local-dev-lib/cms/watch';
import * as pathLib from '@hubspot/local-dev-lib/path';
import * as configLib from '@hubspot/local-dev-lib/config';
import { uiLogger } from '../../../lib/ui/logger.js';
import * as commonOpts from '../../../lib/commonOpts.js';
import * as uploadPromptLib from '../../../lib/prompts/uploadPrompt.js';
import * as validationLib from '../../../lib/validation.js';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import * as uploadLib from '../../../lib/upload.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import watchCommand, { WatchCommandArgs } from '../watch.js';

vi.mock('fs');
vi.mock('@hubspot/local-dev-lib/cms/watch');
vi.mock('@hubspot/local-dev-lib/path');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../lib/commonOpts.js');
vi.mock('../../../lib/prompts/uploadPrompt.js');
vi.mock('../../../lib/validation.js');
vi.mock('../../../lib/upload.js');

const watchSpy = vi.spyOn(watchLib, 'watch');
const statSyncSpy = vi.spyOn(fs, 'statSync');
const getCwdSpy = vi.spyOn(pathLib, 'getCwd');
const uploadPromptSpy = vi.spyOn(uploadPromptLib, 'uploadPrompt');
const validateCmsPublishModeSpy = vi.spyOn(
  validationLib,
  'validateCmsPublishMode'
);
const getCmsPublishModeSpy = vi.spyOn(commonOpts, 'getCmsPublishMode');
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');
const getUploadableFileListSpy = vi.spyOn(uploadLib, 'getUploadableFileList');
const processExitSpy = vi.spyOn(process, 'exit');
const getConfigAccountIfExistsSpy = vi.spyOn(
  configLib,
  'getConfigAccountIfExists'
);

describe('commands/cms/watch', () => {
  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    getCwdSpy.mockReturnValue('/test/cwd');
    validateCmsPublishModeSpy.mockReturnValue(true);
    getCmsPublishModeSpy.mockReturnValue('publish');
    uploadPromptSpy.mockResolvedValue({ src: '', dest: '' });
    // @ts-expect-error Mock return value doesn't need full type implementation
    watchSpy.mockImplementation(() => ({}));
    getUploadableFileListSpy.mockResolvedValue([]);
    // Mock config to prevent reading actual config file in CI
    getConfigAccountIfExistsSpy.mockReturnValue(undefined);
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(watchCommand.command).toEqual('watch [src] [dest]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(watchCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      const positionalSpy = vi.spyOn(yargs as Argv, 'positional');
      const optionSpy = vi.spyOn(yargs as Argv, 'option');

      watchCommand.builder(yargs as Argv);

      expect(positionalSpy).toHaveBeenCalledWith(
        'src',
        expect.objectContaining({ type: 'string' })
      );
      expect(positionalSpy).toHaveBeenCalledWith(
        'dest',
        expect.objectContaining({ type: 'string' })
      );
      expect(optionSpy).toHaveBeenCalledWith(
        'remove',
        expect.objectContaining({ type: 'boolean', alias: 'r' })
      );
      expect(optionSpy).toHaveBeenCalledWith(
        'initial-upload',
        expect.objectContaining({ type: 'boolean', alias: 'i' })
      );
      expect(optionSpy).toHaveBeenCalledWith(
        'notify',
        expect.objectContaining({ type: 'string', alias: 'n' })
      );
      expect(optionSpy).toHaveBeenCalledWith(
        'convert-fields',
        expect.objectContaining({ type: 'boolean' })
      );
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<WatchCommandArgs>;

    beforeEach(() => {
      args = {
        src: 'src',
        dest: '/dest',
        derivedAccountId: 123456,
        remove: false,
        initialUpload: false,
      } as ArgumentsCamelCase<WatchCommandArgs>;
      statSyncSpy.mockReturnValue({
        isFile: () => false,
        isDirectory: () => true,
      } as fs.Stats);
    });

    describe('validation', () => {
      it('should exit if CMS publish mode validation fails', async () => {
        validateCmsPublishModeSpy.mockReturnValue(false);

        await watchCommand.handler(args);

        expect(validateCmsPublishModeSpy).toHaveBeenCalledWith(args);
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });

      it('should prompt for src and dest when not provided', async () => {
        delete args.src;
        delete args.dest;
        uploadPromptSpy.mockResolvedValue({
          src: 'prompted-src',
          dest: '/prompted-dest',
        });

        await watchCommand.handler(args);

        expect(uploadPromptSpy).toHaveBeenCalledWith(args);
      });

      it('should error if src path is invalid', async () => {
        statSyncSpy.mockImplementation(() => {
          throw new Error('File not found');
        });

        await watchCommand.handler(args);

        expect(uiLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('path to a directory')
        );
        expect(watchSpy).not.toHaveBeenCalled();
      });

      it('should error if src path is not a directory', async () => {
        statSyncSpy.mockReturnValue({
          isFile: () => true,
          isDirectory: () => false,
        } as fs.Stats);

        await watchCommand.handler(args);

        expect(uiLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('path to a directory')
        );
        expect(watchSpy).not.toHaveBeenCalled();
      });

      it('should error if dest is not provided', async () => {
        args.dest = '';
        uploadPromptSpy.mockResolvedValue({ src: 'src', dest: '' });

        await watchCommand.handler(args);

        expect(uiLogger.log).toHaveBeenCalledWith(
          expect.stringContaining('destination')
        );
        expect(watchSpy).not.toHaveBeenCalled();
      });
    });

    describe('watch execution', () => {
      it('should track command usage', async () => {
        await watchCommand.handler(args);

        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'watch',
          { mode: 'publish', successful: true },
          123456
        );
      });

      it('should start watching without initial upload by default', async () => {
        await watchCommand.handler(args);

        expect(getUploadableFileListSpy).not.toHaveBeenCalled();
        expect(watchSpy).toHaveBeenCalledWith(
          123456,
          path.resolve('/test/cwd', 'src'),
          '/dest',
          expect.objectContaining({
            cmsPublishMode: 'publish',
            remove: false,
            disableInitial: true,
          }),
          null,
          expect.any(Function),
          undefined,
          expect.any(Function)
        );
      });

      it('should generate uploadable file list when initialUpload is true', async () => {
        args.initialUpload = true;
        getUploadableFileListSpy.mockResolvedValue(['file1.js', 'file2.js']);

        await watchCommand.handler(args);

        expect(getUploadableFileListSpy).toHaveBeenCalledWith(
          path.resolve('/test/cwd', 'src'),
          undefined
        );
        expect(watchSpy).toHaveBeenCalledWith(
          123456,
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            disableInitial: false,
            filePaths: ['file1.js', 'file2.js'],
          }),
          null,
          expect.any(Function),
          undefined,
          expect.any(Function)
        );
      });

      it('should pass remove option to watch', async () => {
        args.remove = true;

        await watchCommand.handler(args);

        expect(watchSpy).toHaveBeenCalledWith(
          123456,
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            remove: true,
          }),
          null,
          expect.any(Function),
          undefined,
          expect.any(Function)
        );
      });

      it('should pass notify option to watch', async () => {
        args.notify = 'http://notify.url';

        await watchCommand.handler(args);

        expect(watchSpy).toHaveBeenCalledWith(
          123456,
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            notify: 'http://notify.url',
          }),
          null,
          expect.any(Function),
          undefined,
          expect.any(Function)
        );
      });

      it('should pass convertFields to getUploadableFileList', async () => {
        args.initialUpload = true;
        args.convertFields = true;

        await watchCommand.handler(args);

        expect(getUploadableFileListSpy).toHaveBeenCalledWith(
          expect.any(String),
          true
        );
      });

      it('should pass command options to watch', async () => {
        args.saveOutput = true;
        args.fieldOptions = ['option1'];

        await watchCommand.handler(args);

        expect(watchSpy).toHaveBeenCalledWith(
          123456,
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            commandOptions: expect.objectContaining({
              saveOutput: true,
              fieldOptions: ['option1'],
            }),
          }),
          null,
          expect.any(Function),
          undefined,
          expect.any(Function)
        );
      });
    });

    describe('error handlers', () => {
      it('should provide error handler for folder errors', async () => {
        await watchCommand.handler(args);

        const folderErrorHandler = watchSpy.mock.calls[0][5];
        const error = new AxiosError('Folder error');

        folderErrorHandler?.(error);

        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('failures')
        );
      });

      it('should provide error handler factory for file errors', async () => {
        await watchCommand.handler(args);

        const fileErrorHandlerFactory = watchSpy.mock.calls[0][7];
        const fileErrorHandler = fileErrorHandlerFactory?.(
          'test.js',
          '/dest/test.js',
          123456
        );
        const error = new AxiosError('File error');

        fileErrorHandler?.(error);

        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('test.js')
        );
      });
    });
  });
});
