import yargs, { Argv } from 'yargs';
import * as commonOpts from '../../lib/commonOpts.js';
import feedbackCommand from '../feedback.js';

vi.mock('yargs');
vi.mock('../../lib/commonOpts');

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
      feedbackCommand.builder(yargs as Argv);

      expect(commonOpts.addGlobalOptions).toHaveBeenCalledTimes(1);
      expect(commonOpts.addGlobalOptions).toHaveBeenCalledWith(yargs);
    });
  });
});
