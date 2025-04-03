import { Argv } from 'yargs';
import { hasFlag, makeYargsBuilder } from '../yargsUtils';
import * as commonOpts from '../commonOpts';

jest.mock('yargs');
jest.mock('../commonOpts');

const argvWithFlag = ['hs', 'command', '--test'];
const argvWithoutFlag = ['hs', 'command'];

describe('lib/yargsUtils', () => {
  describe('hasFlag()', () => {
    it('should return true if the flag is present', () => {
      const flag = hasFlag('test', argvWithFlag);
      expect(flag).toBe(true);
    });

    it('should return false if argv is an empty array', () => {
      const flag = hasFlag('test', []);
      expect(flag).toBe(false);
    });

    it('should return false if the flag is not present', () => {
      const flag = hasFlag('test', argvWithoutFlag);
      expect(flag).toBe(false);
    });
  });

  describe('makeYargsBuilder()', () => {
    it('should add specified options', async () => {
      const builder = makeYargsBuilder(yargs => yargs, 'command', 'describe', {
        useAccountOptions: true,
        useConfigOptions: true,
        useUseEnvironmentOptions: true,
        useTestingOptions: true,
        useGlobalOptions: true,
      });

      await builder({} as Argv);

      expect(commonOpts.addGlobalOptions).toHaveBeenCalled();
      expect(commonOpts.addAccountOptions).toHaveBeenCalled();
      expect(commonOpts.addConfigOptions).toHaveBeenCalled();
      expect(commonOpts.addUseEnvironmentOptions).toHaveBeenCalled();
      expect(commonOpts.addTestingOptions).toHaveBeenCalled();
      expect(commonOpts.addCustomHelpOutput).toHaveBeenCalled();
    });
  });
});
