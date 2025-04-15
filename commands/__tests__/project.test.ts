import yargs, { Argv } from 'yargs';
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
import projectCommand from '../project';

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
jest.mock('../project/migrateApp', () => ({}));
jest.mock('../project/cloneApp', () => ({}));
jest.mock('../project/installDeps');
jest.mock('../../lib/commonOpts');

const commandSpy = jest
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = jest
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

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
      create,
      add,
      watch,
      dev,
      upload,
      deploy,
      logs,
      listBuilds,
      download,
      open,
      migrateApp,
      cloneApp,
      installDeps,
    ];

    it('should demand the command takes one positional argument', () => {
      projectCommand.builder(yargs as Argv);

      expect(demandCommandSpy).toHaveBeenCalledTimes(1);
      expect(demandCommandSpy).toHaveBeenCalledWith(1, '');
    });

    it('should add the correct number of sub commands', () => {
      projectCommand.builder(yargs as Argv);
      expect(commandSpy).toHaveBeenCalledTimes(subcommands.length);
    });

    it.each(subcommands)('should attach the %s subcommand', module => {
      projectCommand.builder(yargs as Argv);
      expect(module).toBeDefined();
      expect(commandSpy).toHaveBeenCalledWith(module);
    });
  });
});
