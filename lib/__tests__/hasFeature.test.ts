import { fetchEnabledFeatures } from '@hubspot/local-dev-lib/api/localDevAuth';
import { hasFeature } from '../hasFeature';

jest.mock('@hubspot/local-dev-lib/api/localDevAuth');

const mockedFetchEnabledFeatures = fetchEnabledFeatures as jest.Mock;

describe('lib/hasFeature', () => {
  describe('hasFeature()', () => {
    const accountId = 123;

    beforeEach(() => {
      mockedFetchEnabledFeatures.mockResolvedValueOnce({
        data: {
          enabledFeatures: {
            'feature-1': true,
            'feature-2': false,
            'feature-3': true,
          },
        },
      });
    });

    it('should return true if the feature is enabled', async () => {
      // @ts-expect-error test data
      const result = await hasFeature(accountId, 'feature-1');
      expect(result).toBe(true);
    });

    it('should return false if the feature is not enabled', async () => {
      // @ts-expect-error test data
      const result = await hasFeature(accountId, 'feature-2');
      expect(result).toBe(false);
    });

    it('should return false if the feature is not present', async () => {
      // @ts-expect-error test data
      const result = await hasFeature(accountId, 'feature-4');
      expect(result).toBe(false);
    });
  });
});
