import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import { fetchTables } from '@hubspot/local-dev-lib/api/hubdb';

import { Mock } from 'vitest';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { mockHubSpotHttpResponse } from '../../../lib/testUtils.js';
import hubdbListCommand from '../list.js';
import {
  AccountArgs,
  CommonArgs,
  ConfigArgs,
  EnvironmentArgs,
} from '../../../types/Yargs.js';
import type { UsageTrackingArgs } from '../../../types/Yargs.js';

vi.mock('../../../lib/commonOpts');
vi.mock('@hubspot/local-dev-lib/api/hubdb');
vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../../lib/errorHandlers');

const processExitSpy = vi.spyOn(process, 'exit');

describe('commands/hubdb/list', () => {
  const yargsMock = yargs as Argv;
  const mockedFetchTables = fetchTables as Mock;
  const mockedLogger = uiLogger;
  beforeEach(() => {
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
    mockedFetchTables.mockReset();
    vi.mocked(mockedLogger.success).mockReset();
    vi.mocked(mockedLogger.log).mockReset();
    vi.mocked(mockedLogger.error).mockReset();
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(hubdbListCommand.command).toEqual(['list', 'ls']);
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(hubdbListCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      hubdbListCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });
  });

  type HubdbListArgs = CommonArgs &
    ConfigArgs &
    AccountArgs &
    EnvironmentArgs &
    UsageTrackingArgs;

  describe('handler', () => {
    const mockArgs: ArgumentsCamelCase<HubdbListArgs> = {
      derivedAccountId: 123456789,
      d: false,
      debug: false,
      _: [],
      $0: 'hs',
    } as unknown as ArgumentsCamelCase<HubdbListArgs>;

    const mockTables = {
      results: [
        {
          id: 1,
          label: 'Test Table',
          name: 'test_table',
          columnCount: 5,
          rowCount: 10,
        },
      ],
      total: 1,
    };

    it('should fetch and display tables', async () => {
      mockedFetchTables.mockReturnValue(mockHubSpotHttpResponse(mockTables));

      await hubdbListCommand.handler(mockArgs);

      expect(mockedFetchTables).toHaveBeenCalledTimes(1);
      expect(mockedFetchTables).toHaveBeenCalledWith(mockArgs.derivedAccountId);
      expect(mockedLogger.success).toHaveBeenCalled();
      expect(mockedLogger.log).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle errors appropriately', async () => {
      const error = new Error('Test error');
      mockedFetchTables.mockRejectedValue(error);

      try {
        await hubdbListCommand.handler(mockArgs);
      } catch (e) {}

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
