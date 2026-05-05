import { describe, it, expect, vi } from 'vitest';
import {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} from '@hubspot/local-dev-lib/constants/config';
import { HubSpotConfigAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { getAllConfigAccounts } from '@hubspot/local-dev-lib/config';
import { isSandbox, isDeveloperTestAccount } from '../../accountTypes.js';
import { renderTable } from '../../../ui/render.js';
import { uiLogger } from '../logger.js';
import {
  sortAndMapAccounts,
  getAccountData,
  renderAccountTable,
} from '../accountTable.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../../accountTypes.js');
vi.mock('../../../ui/render.js');

const mockedGetAllConfigAccounts = vi.mocked(getAllConfigAccounts);
const mockedIsSandbox = vi.mocked(isSandbox);
const mockedIsDeveloperTestAccount = vi.mocked(isDeveloperTestAccount);
const mockedRenderTable = vi.mocked(renderTable);

const STANDARD_ACCOUNT: HubSpotConfigAccount = {
  name: 'Production Hub',
  accountId: 100,
  accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
  authType: 'personalaccesskey',
} as HubSpotConfigAccount;

const APP_DEVELOPER_ACCOUNT: HubSpotConfigAccount = {
  name: 'Dev Portal',
  accountId: 200,
  accountType: HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER,
  authType: 'personalaccesskey',
} as HubSpotConfigAccount;

const SANDBOX_ACCOUNT: HubSpotConfigAccount = {
  name: 'My Sandbox',
  accountId: 300,
  accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
  parentAccountId: 100,
  authType: 'personalaccesskey',
} as HubSpotConfigAccount;

const DEVELOPER_TEST_ACCOUNT: HubSpotConfigAccount = {
  name: 'Test Account',
  accountId: 400,
  accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST,
  parentAccountId: 200,
  authType: 'personalaccesskey',
} as HubSpotConfigAccount;

describe('lib/ui/accountTable', () => {
  beforeEach(() => {
    mockedIsSandbox.mockImplementation(
      (account: HubSpotConfigAccount) =>
        account.accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX ||
        account.accountType === HUBSPOT_ACCOUNT_TYPES.STANDARD_SANDBOX
    );
    mockedIsDeveloperTestAccount.mockImplementation(
      (account: HubSpotConfigAccount) =>
        account.accountType === HUBSPOT_ACCOUNT_TYPES.DEVELOPER_TEST
    );
  });

  describe('sortAndMapAccounts()', () => {
    it('should group standard accounts by their own account ID', () => {
      const result = sortAndMapAccounts([STANDARD_ACCOUNT]);

      expect(result[100]).toBeDefined();
      expect(result[100]).toHaveLength(1);
      expect(result[100][0].accountId).toBe(100);
    });

    it('should group app developer accounts by their own account ID', () => {
      const result = sortAndMapAccounts([APP_DEVELOPER_ACCOUNT]);

      expect(result[200]).toBeDefined();
      expect(result[200]).toHaveLength(1);
      expect(result[200][0].accountId).toBe(200);
    });

    it('should nest sandbox accounts under their parent account ID', () => {
      const result = sortAndMapAccounts([STANDARD_ACCOUNT, SANDBOX_ACCOUNT]);

      expect(result[100]).toBeDefined();
      expect(result[100]).toHaveLength(2);
      expect(result[100][0].accountId).toBe(100);
      expect(result[100][1].accountId).toBe(300);
    });

    it('should nest developer test accounts under their parent account ID', () => {
      const result = sortAndMapAccounts([
        APP_DEVELOPER_ACCOUNT,
        DEVELOPER_TEST_ACCOUNT,
      ]);

      expect(result[200]).toBeDefined();
      expect(result[200]).toHaveLength(2);
      expect(result[200][0].accountId).toBe(200);
      expect(result[200][1].accountId).toBe(400);
    });

    it('should group sandbox without parent under its own account ID', () => {
      const orphanSandbox: HubSpotConfigAccount = {
        name: 'Orphan Sandbox',
        accountId: 500,
        accountType: HUBSPOT_ACCOUNT_TYPES.DEVELOPMENT_SANDBOX,
        parentAccountId: undefined,
        authType: 'personalaccesskey',
      } as unknown as HubSpotConfigAccount;

      const result = sortAndMapAccounts([orphanSandbox]);

      expect(result[500]).toBeDefined();
      expect(result[500]).toHaveLength(1);
    });
  });

  describe('getAccountData()', () => {
    it('should format rows with name, account ID, and auth type', () => {
      const mapped = { '100': [STANDARD_ACCOUNT] };
      const result = getAccountData(mapped);

      expect(result).toHaveLength(1);
      expect(result[0][0]).toContain('Production Hub');
      expect(result[0][0]).toContain(
        HUBSPOT_ACCOUNT_TYPE_STRINGS[HUBSPOT_ACCOUNT_TYPES.STANDARD]
      );
      expect(result[0][1]).toBe('100');
      expect(result[0][2]).toBe('personalaccesskey');
    });

    it('should prefix child sandbox accounts with arrow when parent exists', () => {
      const mapped = {
        '100': [STANDARD_ACCOUNT, SANDBOX_ACCOUNT],
      };
      const result = getAccountData(mapped);

      expect(result).toHaveLength(2);
      const sandboxRow = result.find(row => row[1] === '300');
      expect(sandboxRow).toBeDefined();
      expect(sandboxRow![0]).toMatch(/^↳/);
    });

    it('should prefix child developer test accounts with arrow when parent exists', () => {
      const mapped = {
        '200': [APP_DEVELOPER_ACCOUNT, DEVELOPER_TEST_ACCOUNT],
      };
      const result = getAccountData(mapped);

      const testAccountRow = result.find(row => row[1] === '400');
      expect(testAccountRow).toBeDefined();
      expect(testAccountRow![0]).toMatch(/^↳/);
    });

    it('should not prefix sandbox when it is the only entry in the group', () => {
      const mapped = { '300': [SANDBOX_ACCOUNT] };
      const result = getAccountData(mapped);

      expect(result).toHaveLength(1);
      expect(result[0][0]).not.toMatch(/^↳/);
    });
  });

  describe('renderAccountTable()', () => {
    beforeEach(() => {
      mockedGetAllConfigAccounts.mockReturnValue([
        STANDARD_ACCOUNT,
        SANDBOX_ACCOUNT,
      ]);
      mockedRenderTable.mockReturnValue(undefined as unknown as Promise<void>);
    });

    it('should call getAllConfigAccounts', () => {
      renderAccountTable();
      expect(mockedGetAllConfigAccounts).toHaveBeenCalledTimes(1);
    });

    it('should call renderTable with table header and data', () => {
      renderAccountTable();

      expect(mockedRenderTable).toHaveBeenCalledTimes(1);
      expect(mockedRenderTable).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        true
      );
    });

    it('should log the accounts header via uiLogger', () => {
      renderAccountTable();
      expect(uiLogger.log).toHaveBeenCalled();
    });
  });
});
