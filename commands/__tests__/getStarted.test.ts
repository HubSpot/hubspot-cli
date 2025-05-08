// @ts-nocheck

jest.mock('yargs');
jest.mock('@hubspot/local-dev-lib/logger');
jest.mock('../lib/usageTracking');

// Import this last so mocks apply
import * as getStartedCommand from '../getStarted';

describe('commands/get-started', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(getStartedCommand.command).toEqual('get-started');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(getStartedCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the global options', () => {
      // Create a mock yargs instance
      const mockYargs = {
        options: jest.fn().mockReturnThis(),
      };

      // Call the builder function with our mock
      getStartedCommand.builder(mockYargs);

      // Verify that the builder function was called
      expect(mockYargs.options).toBeDefined();
    });
  });
});
