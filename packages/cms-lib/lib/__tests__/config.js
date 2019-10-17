const { setConfig, getPortalId } = require('../config');

describe('lib/config', () => {
  describe('getPortalId()', () => {
    beforeEach(() => {
      setConfig({
        portals: [
          {
            name: 'QA',
            portalId: 123,
            apiKey: 'secret',
          },
        ],
      });
    });
    it('returns portalId from config when a name is passed', () => {
      expect(getPortalId('QA')).toEqual(123);
    });
  });
});
