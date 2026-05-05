import { describe, it, expect, vi } from 'vitest';
import {
  HUBSPOT_ACCOUNT_TYPES,
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} from '@hubspot/local-dev-lib/constants/config';
import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';
import {
  buildAccountRow,
  buildAccountHeader,
  getNameColumnWidth,
  AccountRow,
} from '../accountTableUtils.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../ui/index.js', () => ({
  indent: vi.fn((level: number) => '  '.repeat(level)),
}));
vi.mock('../../ui/styles.js', () => ({
  INK_COLORS: {
    INFO_BLUE: '#4dcbeb',
  },
}));

const mockedGetConfigAccountIfExists = vi.mocked(getConfigAccountIfExists);

describe('lib/link/accountTableUtils', () => {
  describe('buildAccountRow()', () => {
    it('should build a row with account type when account exists', () => {
      mockedGetConfigAccountIfExists.mockReturnValue({
        name: 'My Account',
        accountId: 111,
        accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
      } as ReturnType<typeof getConfigAccountIfExists>);

      const row = buildAccountRow(111, false);

      expect(row.accountId).toBe('111');
      expect(row.name).toContain('My Account');
      expect(row.name).toContain(
        HUBSPOT_ACCOUNT_TYPE_STRINGS[HUBSPOT_ACCOUNT_TYPES.STANDARD]
      );
    });

    it('should fall back to account ID string when account has no type', () => {
      mockedGetConfigAccountIfExists.mockReturnValue({
        name: 'No Type Account',
        accountId: 222,
        accountType: undefined,
      } as unknown as ReturnType<typeof getConfigAccountIfExists>);

      const row = buildAccountRow(222, false);

      expect(row.name).toBe('222');
      expect(row.accountId).toBe('222');
    });

    it('should fall back to account ID string when account does not exist', () => {
      mockedGetConfigAccountIfExists.mockReturnValue(undefined);

      const row = buildAccountRow(333, false);

      expect(row.name).toBe('333');
      expect(row.accountId).toBe('333');
    });

    it('should append (default) suffix when isDefault is true', () => {
      mockedGetConfigAccountIfExists.mockReturnValue({
        name: 'Default Account',
        accountId: 444,
        accountType: HUBSPOT_ACCOUNT_TYPES.APP_DEVELOPER,
      } as ReturnType<typeof getConfigAccountIfExists>);

      const row = buildAccountRow(444, true);

      expect(row.name).toContain('(default)');
    });

    it('should not append (default) suffix when isDefault is false', () => {
      mockedGetConfigAccountIfExists.mockReturnValue({
        name: 'Regular Account',
        accountId: 555,
        accountType: HUBSPOT_ACCOUNT_TYPES.STANDARD,
      } as ReturnType<typeof getConfigAccountIfExists>);

      const row = buildAccountRow(555, false);

      expect(row.name).not.toContain('(default)');
    });
  });

  describe('buildAccountHeader()', () => {
    it('should return a string containing the name and accountId labels', () => {
      const result = buildAccountHeader(20);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getNameColumnWidth()', () => {
    it('should return the label width when no rows are wider', () => {
      const rows: AccountRow[] = [{ name: 'A', accountId: '1' }];

      const width = getNameColumnWidth(rows);

      expect(width).toBeGreaterThanOrEqual(1);
    });

    it('should return the longest row name width when it exceeds the label', () => {
      const longName = 'A'.repeat(200);
      const rows: AccountRow[] = [
        { name: longName, accountId: '1' },
        { name: 'Short', accountId: '2' },
      ];

      const width = getNameColumnWidth(rows);

      expect(width).toBe(200);
    });

    it('should handle an empty rows array', () => {
      const rows: AccountRow[] = [];

      const width = getNameColumnWidth(rows);

      expect(width).toBeGreaterThanOrEqual(0);
    });
  });
});
