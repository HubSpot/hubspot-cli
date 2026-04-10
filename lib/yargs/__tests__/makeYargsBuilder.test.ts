import { Argv } from 'yargs';
import { makeYargsBuilder } from '../makeYargsBuilder.js';
import * as commonOpts from '../../commonOpts.js';

vi.mock('../../commonOpts');

describe('makeYargsBuilder()', () => {
  it('should add specified options', async () => {
    const builder = makeYargsBuilder(yargs => yargs, 'command', 'describe', {
      useAccountOptions: true,
      useConfigOptions: true,
      useEnvironmentOptions: true,
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
