// @ts-nocheck
import yargs from 'yargs';
import deploy from '../project/deploy';
import create from '../project/create';
import upload from '../project/upload';
import listBuilds from '../project/listBuilds';
import logs from '../project/logs';
import watch from '../project/watch';
import download from '../project/download';
import open from '../project/open';
import dev from '../project/dev';
import add from '../project/add';
import migrateApp from '../project/migrateApp';
import cloneApp from '../project/cloneApp';
import installDeps from '../project/installDeps';

jest.mock('yargs');
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
yargs.command.mockReturnValue(yargs);
yargs.demandCommand.mockReturnValue(yargs);

// Import this last so mocks apply
import projectCommand from '../project';

describe('commands/project', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectCommand.command).toEqual(['project', 'projects']);
    });
  });

  describe('describe', () => {
    it('should contain the beta tag', () => {
      expect(projectCommand.describe).toContain('[BETA]');
    });

    it('should provide a description', () => {
      expect(projectCommand.describe).toBeDefined();
    });
  });

  describe('builder', () => {
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

    it('should demand the command takes one positional argument', () => {
      projectCommand.builder(yargs);

      expect(yargs.demandCommand).toHaveBeenCalledTimes(1);
      expect(yargs.demandCommand).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      projectCommand.builder(yargs);
      expect(yargs.command).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', (name, module) => {
      projectCommand.builder(yargs);
      expect(yargs.command).toHaveBeenCalledWith(module);
    });
  });
});
