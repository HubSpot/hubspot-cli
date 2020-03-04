const {
  setConfig,
  getConfig,
  getPortalId,
  updateDefaultPortal,
  deleteEmptyConfigFile,
} = require('../config');
jest.mock('fs');

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

  describe('updateDefaultPortal()', () => {
    const myPortalName = 'Foo';

    beforeEach(() => {
      updateDefaultPortal(myPortalName);
    });

    it('sets the defaultPortal in the config', () => {
      expect(getConfig().defaultPortal).toEqual(myPortalName);
    });
  });

  describe('deleteEmptyConfigFile()', () => {
    const fs = require('fs-extra');

    it('does not delete config file if there are contents', () => {
      fs.__setReadFile('defaultPortal: Foo');
      fs.__setExistsValue(true);
      fs.unlinkSync = jest.fn();

      deleteEmptyConfigFile();
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('deletes config file if empty', () => {
      fs.__setReadFile('');
      fs.__setExistsValue(true);
      fs.unlinkSync = jest.fn();

      deleteEmptyConfigFile();
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });
});
