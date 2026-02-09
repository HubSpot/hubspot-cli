import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import * as fileMapperLib from '@hubspot/local-dev-lib/fileMapper';
import * as commonOpts from '../../../lib/commonOpts.js';
import * as filesystemLib from '../../../lib/filesystem.js';
import * as validationLib from '../../../lib/validation.js';
import * as usageTrackingLib from '../../../lib/usageTracking.js';
import * as errorHandlers from '../../../lib/errorHandlers/index.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import fetchCommand, { FetchCommandArgs } from '../fetch.js';

vi.mock('../../../lib/commonOpts');
vi.mock('@hubspot/local-dev-lib/fileMapper');
vi.mock('../../../lib/filesystem.js');
vi.mock('../../../lib/validation.js');
vi.mock('../../../lib/errorHandlers/index.js');

const downloadFileOrFolderSpy = vi.spyOn(fileMapperLib, 'downloadFileOrFolder');
const getCmsPublishModeSpy = vi.spyOn(commonOpts, 'getCmsPublishMode');
const resolveLocalPathSpy = vi.spyOn(filesystemLib, 'resolveLocalPath');
const validateCmsPublishModeSpy = vi.spyOn(
  validationLib,
  'validateCmsPublishMode'
);
const trackCommandUsageSpy = vi.spyOn(usageTrackingLib, 'trackCommandUsage');
const logErrorSpy = vi.spyOn(errorHandlers, 'logError');
const processExitSpy = vi.spyOn(process, 'exit');

const positionalSpy = vi
  .spyOn(yargs as Argv, 'positional')
  .mockReturnValue(yargs as Argv);

const optionsSpy = vi
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

describe('commands/cms/fetch', () => {
  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    validateCmsPublishModeSpy.mockReturnValue(true);
    getCmsPublishModeSpy.mockReturnValue('publish');
    resolveLocalPathSpy.mockImplementation(path => path || '.');
    downloadFileOrFolderSpy.mockResolvedValue(undefined);
    trackCommandUsageSpy.mockImplementation(async () => {});
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(fetchCommand.command).toEqual('fetch <src> [dest]');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(fetchCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct positional arguments', () => {
      fetchCommand.builder(yargs as Argv);

      expect(positionalSpy).toHaveBeenCalledTimes(2);
      expect(positionalSpy).toHaveBeenCalledWith(
        'src',
        expect.objectContaining({ type: 'string' })
      );
      expect(positionalSpy).toHaveBeenCalledWith(
        'dest',
        expect.objectContaining({ type: 'string' })
      );
    });

    it('should support the correct options', () => {
      fetchCommand.builder(yargs as Argv);

      expect(optionsSpy).toHaveBeenCalledTimes(2);
      expect(optionsSpy).toHaveBeenCalledWith({
        staging: expect.objectContaining({
          type: 'boolean',
          default: false,
          hidden: true,
        }),
      });
      expect(optionsSpy).toHaveBeenCalledWith({
        'asset-version': expect.objectContaining({ type: 'number' }),
      });

      expect(commonOpts.addConfigOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addConfigOptions).toHaveBeenCalledWith(yargs);

      expect(commonOpts.addAccountOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addAccountOptions).toHaveBeenCalledWith(yargs);

      expect(commonOpts.addOverwriteOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addOverwriteOptions).toHaveBeenCalledWith(yargs);

      expect(commonOpts.addCmsPublishModeOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addCmsPublishModeOptions).toHaveBeenCalledWith(yargs, {
        read: true,
      });

      expect(commonOpts.addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<FetchCommandArgs>;

    beforeEach(() => {
      args = {
        src: '/remote/path/file.js',
        dest: './local/path',
        derivedAccountId: 123456,
      } as ArgumentsCamelCase<FetchCommandArgs>;
    });

    describe('validation', () => {
      it('should exit if CMS publish mode validation fails', async () => {
        validateCmsPublishModeSpy.mockReturnValue(false);

        await fetchCommand.handler(args);

        expect(validateCmsPublishModeSpy).toHaveBeenCalledWith(args);
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });
    });

    describe('fetch execution', () => {
      it('should track command usage', async () => {
        await fetchCommand.handler(args);

        expect(trackCommandUsageSpy).toHaveBeenCalledWith(
          'fetch',
          { mode: 'publish' },
          123456
        );
      });

      it('should fetch file successfully with increased timeout', async () => {
        await fetchCommand.handler(args);

        expect(downloadFileOrFolderSpy).toHaveBeenCalledWith(
          123456,
          '/remote/path/file.js',
          './local/path',
          'publish',
          expect.objectContaining({
            assetVersion: undefined,
            staging: undefined,
            overwrite: undefined,
            timeout: 60000,
          })
        );
      });

      it('should use default dest if not provided', async () => {
        delete args.dest;

        await fetchCommand.handler(args);

        expect(resolveLocalPathSpy).toHaveBeenCalledWith(undefined);
        expect(downloadFileOrFolderSpy).toHaveBeenCalledWith(
          123456,
          '/remote/path/file.js',
          '.',
          'publish',
          expect.any(Object)
        );
      });

      it('should pass staging option to download', async () => {
        args.staging = true;

        await fetchCommand.handler(args);

        expect(downloadFileOrFolderSpy).toHaveBeenCalledWith(
          123456,
          expect.any(String),
          expect.any(String),
          'publish',
          expect.objectContaining({
            staging: true,
          })
        );
      });

      it('should pass assetVersion option to download', async () => {
        args.assetVersion = 5;

        await fetchCommand.handler(args);

        expect(downloadFileOrFolderSpy).toHaveBeenCalledWith(
          123456,
          expect.any(String),
          expect.any(String),
          'publish',
          expect.objectContaining({
            assetVersion: '5',
          })
        );
      });

      it('should pass overwrite option to download', async () => {
        args.overwrite = true;

        await fetchCommand.handler(args);

        expect(downloadFileOrFolderSpy).toHaveBeenCalledWith(
          123456,
          expect.any(String),
          expect.any(String),
          'publish',
          expect.objectContaining({
            overwrite: true,
          })
        );
      });

      it('should use draft mode when specified', async () => {
        getCmsPublishModeSpy.mockReturnValue('draft');

        await fetchCommand.handler(args);

        expect(downloadFileOrFolderSpy).toHaveBeenCalledWith(
          123456,
          expect.any(String),
          expect.any(String),
          'draft',
          expect.any(Object)
        );
      });
    });

    describe('error handling', () => {
      it('should handle download errors', async () => {
        const error = new Error('Download failed');
        downloadFileOrFolderSpy.mockRejectedValue(error);

        await fetchCommand.handler(args);

        expect(logErrorSpy).toHaveBeenCalledWith(error);
        expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      });
    });
  });
});
