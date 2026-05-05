import { describe, it, expect, vi } from 'vitest';
import { HsSettingsFile } from '@hubspot/local-dev-lib/types/HsSettings';
import { renderTable } from '../../../ui/render.js';
import { buildAccountRow } from '../accountTableUtils.js';
import { renderLinkedAccountsTable } from '../renderLinkedAccountsTable.js';

vi.mock('../../../ui/render.js');
vi.mock('../accountTableUtils.js', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../accountTableUtils.js')>();
  return {
    ...actual,
    buildAccountRow: vi.fn(),
  };
});

const mockedRenderTable = vi.mocked(renderTable);
const mockedBuildAccountRow = vi.mocked(buildAccountRow);

describe('lib/link/renderLinkedAccountsTable', () => {
  describe('renderLinkedAccountsTable()', () => {
    const settings: HsSettingsFile = {
      accounts: [111, 222, 333],
      localDefaultAccount: 222,
    } as unknown as HsSettingsFile;

    beforeEach(() => {
      mockedBuildAccountRow.mockImplementation((accountId, isDefault) => ({
        name: isDefault
          ? `Account ${accountId} (default)`
          : `Account ${accountId}`,
        accountId: String(accountId),
      }));
      mockedRenderTable.mockResolvedValue(undefined);
    });

    it('should call renderTable with header and data', async () => {
      await renderLinkedAccountsTable(settings);
      expect(mockedRenderTable).toHaveBeenCalledTimes(1);
      expect(mockedRenderTable).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        true
      );
    });

    it('should sort the default account first', async () => {
      await renderLinkedAccountsTable(settings);

      const tableData = mockedRenderTable.mock.calls[0][1];
      expect(tableData[0][0]).toContain('222');
    });

    it('should mark the default account with isDefault=true', async () => {
      await renderLinkedAccountsTable(settings);

      const defaultCall = mockedBuildAccountRow.mock.calls.find(
        ([id]) => id === 222
      );
      expect(defaultCall).toBeDefined();
      expect(defaultCall![1]).toBe(true);
    });

    it('should mark non-default accounts with isDefault=false', async () => {
      await renderLinkedAccountsTable(settings);

      const nonDefaultCalls = mockedBuildAccountRow.mock.calls.filter(
        ([id]) => id !== 222
      );
      nonDefaultCalls.forEach(([, isDefault]) => {
        expect(isDefault).toBe(false);
      });
    });
  });
});
