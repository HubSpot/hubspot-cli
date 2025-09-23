import { fetchEnabledFeatures } from '@hubspot/local-dev-lib/api/localDevAuth';
import { http } from '@hubspot/local-dev-lib/http';
import { hasFeature, hasUnfiedAppsAccess } from '../hasFeature.js';
import { FEATURES } from '../constants.js';
import { Mock, Mocked } from 'vitest';

vi.mock('@hubspot/local-dev-lib/api/localDevAuth');
vi.mock('@hubspot/local-dev-lib/http');

const mockedFetchEnabledFeatures = fetchEnabledFeatures as Mock;
const mockedHttp = http as Mocked<typeof http>;

describe('lib/hasFeature', () => {
  describe('hasFeature()', () => {
    const accountId = 123;

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return true if the feature is enabled', async () => {
      mockedFetchEnabledFeatures.mockResolvedValueOnce({
        data: {
          enabledFeatures: {
            'feature-1': true,
          },
        },
      });

      // @ts-expect-error test data
      const result = await hasFeature(accountId, 'feature-1');
      expect(result).toBe(true);
    });

    it('should return false if the feature is disabled', async () => {
      mockedFetchEnabledFeatures.mockResolvedValueOnce({
        data: {
          enabledFeatures: {
            'feature-2': false,
          },
        },
      });

      // @ts-expect-error test data
      const result = await hasFeature(accountId, 'feature-2');
      expect(result).toBe(false);
    });

    it('should return false if the feature is not present', async () => {
      mockedFetchEnabledFeatures.mockResolvedValueOnce({
        data: {
          enabledFeatures: {},
        },
      });

      // @ts-expect-error test data
      const result = await hasFeature(accountId, 'feature-4');
      expect(result).toBe(false);
    });

    it('should return true for APPS_HOME feature when not present in enabled features (defaults on)', async () => {
      mockedFetchEnabledFeatures.mockResolvedValueOnce({
        data: {
          enabledFeatures: {},
        },
      });

      const result = await hasFeature(accountId, FEATURES.APPS_HOME);
      expect(result).toBe(true);
    });

    it('should respect explicit setting for APPS_HOME feature even when it defaults on', async () => {
      mockedFetchEnabledFeatures.mockResolvedValueOnce({
        data: {
          enabledFeatures: {
            [FEATURES.APPS_HOME]: false,
          },
        },
      });

      const result = await hasFeature(accountId, FEATURES.APPS_HOME);
      expect(result).toBe(false);
    });

    it('should handle truthy values correctly', async () => {
      mockedFetchEnabledFeatures.mockResolvedValueOnce({
        data: {
          enabledFeatures: {
            'feature-truthy': 'yes',
          },
        },
      });

      // @ts-expect-error test data
      const truthyResult = await hasFeature(accountId, 'feature-truthy');
      expect(truthyResult).toBe(true);

      mockedFetchEnabledFeatures.mockResolvedValueOnce({
        data: {
          enabledFeatures: {
            'feature-number': 1,
          },
        },
      });

      // @ts-expect-error test data
      const numberResult = await hasFeature(accountId, 'feature-number');
      expect(numberResult).toBe(true);
    });

    it('should handle falsy values correctly', async () => {
      mockedFetchEnabledFeatures.mockResolvedValueOnce({
        data: {
          enabledFeatures: {
            'feature-null': null,
          },
        },
      });

      // @ts-expect-error test data
      const nullResult = await hasFeature(accountId, 'feature-null');
      expect(nullResult).toBe(false);

      mockedFetchEnabledFeatures.mockResolvedValueOnce({
        data: {
          enabledFeatures: {
            'feature-zero': 0,
          },
        },
      });

      // @ts-expect-error test data
      const zeroResult = await hasFeature(accountId, 'feature-zero');
      expect(zeroResult).toBe(false);

      mockedFetchEnabledFeatures.mockResolvedValueOnce({
        data: {
          enabledFeatures: {
            'feature-empty': '',
          },
        },
      });

      // @ts-expect-error test data
      const emptyResult = await hasFeature(accountId, 'feature-empty');
      expect(emptyResult).toBe(false);
    });

    it('should propagate errors from fetchEnabledFeatures', async () => {
      const error = new Error('API error');
      mockedFetchEnabledFeatures.mockRejectedValueOnce(error);

      await expect(
        hasFeature(accountId, FEATURES.UNIFIED_APPS)
      ).rejects.toThrow('API error');
    });
  });

  describe('hasUnfiedAppsAccess()', () => {
    const accountId = 123;

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return true when API returns true', async () => {
      // @ts-expect-error Don't want to mock the full response object
      mockedHttp.get.mockResolvedValueOnce({ data: true });

      const result = await hasUnfiedAppsAccess(accountId);
      expect(result).toBe(true);
      expect(mockedHttp.get).toHaveBeenCalledWith(accountId, {
        url: 'developer-tooling/external/developer-portal/has-unified-dev-platform-access',
      });
    });

    it('should return false when API returns false', async () => {
      // @ts-expect-error Don't want to mock the full response object
      mockedHttp.get.mockResolvedValueOnce({ data: false });

      const result = await hasUnfiedAppsAccess(accountId);
      expect(result).toBe(false);
    });

    it('should handle truthy values correctly', async () => {
      // @ts-expect-error Don't want to mock the full response object
      mockedHttp.get.mockResolvedValueOnce({ data: 'yes' });

      const result = await hasUnfiedAppsAccess(accountId);
      expect(result).toBe(true);
    });

    it('should handle falsy values correctly', async () => {
      // @ts-expect-error Don't want to mock the full response object
      mockedHttp.get.mockResolvedValueOnce({ data: null });

      const result = await hasUnfiedAppsAccess(accountId);
      expect(result).toBe(false);
    });

    it('should handle undefined response data', async () => {
      // @ts-expect-error Don't want to mock the full response object
      mockedHttp.get.mockResolvedValueOnce({ data: undefined });

      const result = await hasUnfiedAppsAccess(accountId);
      expect(result).toBe(false);
    });

    it('should propagate errors from http.get', async () => {
      const error = new Error('Network error');
      mockedHttp.get.mockRejectedValueOnce(error);

      await expect(hasUnfiedAppsAccess(accountId)).rejects.toThrow(
        'Network error'
      );
    });
  });
});
