const { setConfig, getPortalId } = require('../config');

describe('lib/config', () => {
  describe('getPortalId()', () => {
    beforeEach(() => {
      setConfig({
        defaultPortal: 'PROD',
        portals: [
          {
            name: 'QA',
            portalId: 123,
            apiKey: 'secret',
          },
          {
            name: 'PROD',
            portalId: 456,
            apiKey: 'secret',
          },
        ],
      });
    });
    it('returns portalId from config when a name is passed', () => {
      expect(getPortalId('QA')).toEqual(123);
    });
    it('returns portalId from config when a string id is passed', () => {
      expect(getPortalId('123')).toEqual(123);
    });
    it('returns portalId from config when a numeric id is passed', () => {
      expect(getPortalId(123)).toEqual(123);
    });
    it('returns defaultPortal from config', () => {
      expect(getPortalId()).toEqual(456);
    });
  });
});
