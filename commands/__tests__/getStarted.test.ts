import * as getStartedCommand from '../getStarted';

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
});
