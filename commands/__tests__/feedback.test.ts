import yargs, { Argv } from 'yargs';
import feedbackCommand from '../feedback';

jest.mock('yargs');

const optionsSpy = jest
  .spyOn(yargs as Argv, 'options')
  .mockReturnValue(yargs as Argv);

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

      expect(optionsSpy).toHaveBeenCalledTimes(1);
      expect(optionsSpy).toHaveBeenCalledWith({
        bug: expect.objectContaining({ type: 'boolean' }),
        general: expect.objectContaining({ type: 'boolean' }),
      });
    });
  });
});
