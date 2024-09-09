const { command, describe: projectDescribe, builder } = require('../project');

jest.mock('../project/deploy');
jest.mock('../project/create');
jest.mock('../project/upload');
jest.mock('../project/listBuilds');
jest.mock('../project/logs');
jest.mock('../project/watch');
jest.mock('../project/download');
jest.mock('../project/open');
jest.mock('../project/dev');
jest.mock('../project/add');
jest.mock('../project/migrateApp');
jest.mock('../project/cloneApp');
jest.mock('../project/installDeps');
jest.mock('../../lib/commonOpts');

const deploy = require('../project/deploy');
const create = require('../project/create');
const upload = require('../project/upload');
const listBuilds = require('../project/listBuilds');
const logs = require('../project/logs');
const watch = require('../project/watch');
const download = require('../project/download');
const open = require('../project/open');
const dev = require('../project/dev');
const add = require('../project/add');
const migrateApp = require('../project/migrateApp');
const cloneApp = require('../project/cloneApp');
const installDeps = require('../project/installDeps');
const { addConfigOptions, addAccountOptions } = require('../../lib/commonOpts');

describe('commands/projects', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(command).toEqual('project');
    });
  });

  describe('describe', () => {
    it('should contain the beta tag', () => {
      expect(projectDescribe).toContain('[BETA]');
    });
    it('should provide an accurate description of what the command is doing', () => {
      expect(projectDescribe).toContain(
        'Commands for working with projects. For more information, visit our documentation: https://developers.hubspot.com/docs/platform/build-and-deploy-using-hubspot-projects'
      );
    });
  });

  describe('builder', () => {
    let yargs;

    const subcommands = [
      ['create', create],
      ['add', add],
      ['watch', watch],
      ['dev', dev],
      ['upload', upload],
      ['deploy', deploy],
      ['logs', logs],
      ['listBuilds', listBuilds],
      ['download', download],
      ['open', open],
      ['migrateApp', migrateApp],
      ['cloneApp', cloneApp],
      ['installDeps', installDeps],
    ];

    beforeEach(() => {
      yargs = {
        command: jest.fn().mockImplementation(() => yargs),
        demandCommand: jest.fn().mockImplementation(() => yargs),
      };
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

    it('should add the correct number of sub commands', () => {
      builder(yargs);
      expect(yargs.command).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', (name, module) => {
      builder(yargs);
      expect(yargs.command).toHaveBeenCalledWith(module);
    });

    it('should demand the command takes one positional argument', () => {
      builder(yargs);
      expect(yargs.demandCommand).toHaveBeenCalledTimes(1);
      expect(yargs.demandCommand).toHaveBeenCalledWith(1, '');
    });
  });
});
