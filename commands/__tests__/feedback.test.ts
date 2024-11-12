// @ts-nocheck
import yargs from 'yargs';

jest.mock('yargs');

// Import this last so mocks apply
import feedbackCommand from '../feedback';

describe('commands/feedback', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(feedbackCommand.command).toEqual('feedback');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(feedbackCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      feedbackCommand.builder(yargs);

      expect(yargs.options).toHaveBeenCalledTimes(1);
      expect(yargs.options).toHaveBeenCalledWith({
        bug: expect.objectContaining({ type: 'boolean' }),
        general: expect.objectContaining({ type: 'boolean' }),
      });
    });
  });
});
