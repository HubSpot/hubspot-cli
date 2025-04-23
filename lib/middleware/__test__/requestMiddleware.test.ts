import { addUserAgentHeader } from '@hubspot/local-dev-lib/http';
import { setRequestHeaders } from '../requestMiddleware';
import pkg from '../../../package.json';

jest.mock('@hubspot/local-dev-lib/http', () => ({
  addUserAgentHeader: jest.fn(),
}));

describe('lib/middleware/requestMiddleware', () => {
  describe('setRequestHeaders()', () => {
    it('should call addUserAgentHeader with correct parameters', () => {
      setRequestHeaders();
      expect(addUserAgentHeader).toHaveBeenCalledTimes(1);
      expect(addUserAgentHeader).toHaveBeenCalledWith(
        'HubSpot CLI',
        pkg.version
      );
    });
  });
});
