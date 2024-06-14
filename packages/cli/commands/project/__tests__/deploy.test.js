jest.mock('../../../lib/commonOpts');
jest.mock('yargs');

const {
  handler,
  describe: deployDescribe,
  command,
  builder,
} = require('../deploy');

const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../../lib/commonOpts');

const yargs = require('yargs');

describe('commands/project/deploy', () => {
  const projectFlag = 'project';
  const buildFlag = 'buildId';
  const buildAliases = ['build'];

  describe('describe', () => {
    it('should contain the beta tag', () => {
      expect(deployDescribe).toContain('[BETA]');
    });
    it('should provide an accurate description of what the command is doing', () => {
      expect(deployDescribe).toMatch(/Deploy a project build$/);
    });
  });

  describe('command', () => {
    it('should the correct command structure', () => {
      expect(command).toEqual(`deploy [--${projectFlag}] [--${buildFlag}]`);
    });
  });

  describe('builder', () => {
    it('should add the correct options', () => {
      builder(yargs);
      expect(yargs.options).toHaveBeenCalledTimes(1);
      expect(yargs.options).toHaveBeenCalledWith({
        [projectFlag]: {
          describe: 'Project name',
          type: 'string',
        },
        [buildFlag]: {
          alias: buildAliases,
          describe: 'Project build ID to be deployed',
          type: 'number',
        },
      });
    });

    it('should add the correct examples', () => {
      builder(yargs);
      expect(yargs.example).toHaveBeenCalledTimes(1);
      expect(yargs.example).toHaveBeenCalledWith([
        ['$0 project deploy', 'Deploy the latest build of the current project'],
        [
          `$0 project deploy --${projectFlag}="my-project" --${buildFlag}=5`,
          'Deploy build 5 of the project my-project',
        ],
      ]);
    });

    it('should add the config options', () => {
      builder(yargs);
      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargs);
    });

    it('should add the account options', () => {
      builder(yargs);
      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargs);
    });

    it('should add the environment options', () => {
      builder(yargs);
      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargs);
    });

    it('should the yargs object it is passed', () => {
      expect(builder(yargs)).toEqual(yargs);
    });
  });
});
