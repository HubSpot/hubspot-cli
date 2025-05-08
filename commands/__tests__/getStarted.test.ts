// @ts-nocheck

jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../lib/usageTracking');
jest.mock('../lib/commonOpts', () => ({
  addGlobalOptions: jest.fn(),
}));

// Import this last so mocks apply
import * as getStartedCommand from '../getStarted';
import { addGlobalOptions } from '../lib/commonOpts';

describe('commands/get-started', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(getStartedCommand.command).toEqual('get-started');
    });
  });

  xdescribe('describe', () => {
    it('should provide a description', () => {
      expect(getStartedCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should add global options to yargs', () => {
      const mockYargs = {};
      getStartedCommand.builder(mockYargs);
      expect(addGlobalOptions).toHaveBeenCalledWith(mockYargs);
    });
  });
});
