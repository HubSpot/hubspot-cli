import yargs, { ArgumentsCamelCase, Argv } from 'yargs';

import { ImportRequest } from '@hubspot/local-dev-lib/types/Crm';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts.js';
import testAccountImportDataCommand from '../importData.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../../../types/Yargs.js';
import {
  handleImportData,
  handleTargetTestAccountSelectionFlow,
} from '../../../lib/importData.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import { getImportDataRequest } from '@hubspot/local-dev-lib/crm';
import { logError } from '../../../lib/errorHandlers/index.js';
import { importDataFilePathPrompt } from '../../../lib/prompts/importDataFilePathPrompt.js';
import { confirmImportDataPrompt } from '../../../lib/prompts/confirmImportDataPrompt.js';

vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/importData');
vi.mock('../../../lib/usageTracking');
vi.mock('@hubspot/local-dev-lib/crm');
vi.mock('../../../lib/errorHandlers/index');
vi.mock('../../../lib/prompts/importDataFilePathPrompt');
vi.mock('../../../lib/prompts/confirmImportDataPrompt');

describe('commands/testAccount/importData', () => {
  const yargsMock = yargs as Argv;
  const mockExit = vi
    .spyOn(process, 'exit')
    .mockImplementation(() => undefined as never);

  const mockHandleImportData = vi.mocked(handleImportData);
  const mockHandleTargetTestAccountSelectionFlow = vi.mocked(
    handleTargetTestAccountSelectionFlow
  );
  const mockTrackCommandUsage = vi.mocked(trackCommandUsage);
  const mockGetImportDataRequest = vi.mocked(getImportDataRequest);
  const mockLogError = vi.mocked(logError);
  const mockImportDataFilePathPrompt = vi.mocked(importDataFilePathPrompt);
  const mockConfirmImportDataPrompt = vi.mocked(confirmImportDataPrompt);

  beforeEach(() => {
    mockExit.mockReset();
    mockHandleImportData.mockReset();
    mockHandleTargetTestAccountSelectionFlow.mockReset();
    mockTrackCommandUsage.mockReset();
    mockGetImportDataRequest.mockReset();
    mockLogError.mockReset();
    mockImportDataFilePathPrompt.mockReset();
    mockConfirmImportDataPrompt.mockReset();
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(testAccountImportDataCommand.command).toEqual('import-data');
    });
  });

  // describe('describe', () => {
  //   it('should provide a description', () => {
  //     expect(testAccountImportDataCommand.describe).toBeDefined();
  //   });
  // });

  describe('builder', () => {
    it('should support the correct options', () => {
      testAccountImportDataCommand.builder(yargsMock);

      expect(yargsMock.example).toHaveBeenCalledTimes(1);
      expect(yargsMock.options).toHaveBeenCalledTimes(1);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });

  describe('handler', () => {
    type CrmImportDataArgs = CommonArgs &
      ConfigArgs &
      AccountArgs &
      EnvironmentArgs & {
        filePath: string | undefined;
        skipConfirm: boolean | undefined;
      };

    it('should complete the flow given the correct args', async () => {
      const targetAccountId = 123456789;
      const mockArgs: ArgumentsCamelCase<CrmImportDataArgs> = {
        d: false,
        debug: false,
        _: [],
        $0: 'hs',
        derivedAccountId: targetAccountId,
        userProvidedAccount: 'test-account',
        filePath: 'test-file.json',
        skipConfirm: true,
      };

      mockHandleTargetTestAccountSelectionFlow.mockResolvedValue(
        targetAccountId
      );
      mockGetImportDataRequest.mockReturnValue({
        importRequest: {} as ImportRequest,
        dataFileNames: ['test-file.json'],
      });
      mockHandleImportData.mockResolvedValue();

      await testAccountImportDataCommand.handler(mockArgs);

      expect(mockHandleTargetTestAccountSelectionFlow).toHaveBeenCalledWith(
        123456789,
        'test-account'
      );
      expect(mockGetImportDataRequest).toHaveBeenCalledWith('test-file.json');
      expect(mockHandleImportData).toHaveBeenCalledTimes(1);
      expect(mockTrackCommandUsage).toHaveBeenCalledTimes(1);
      expect(mockLogError).not.toHaveBeenCalled();
      expect(mockImportDataFilePathPrompt).not.toHaveBeenCalled();
      expect(mockConfirmImportDataPrompt).not.toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });
  });
});
