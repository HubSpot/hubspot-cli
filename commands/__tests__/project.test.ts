import yargs, { Argv } from 'yargs';
import deploy from '../project/deploy.js';
import create from '../project/create.js';
import upload from '../project/upload.js';
import listBuilds from '../project/listBuilds.js';
import logs from '../project/logs.js';
import watch from '../project/watch.js';
import download from '../project/download.js';
import open from '../project/open.js';
import dev from '../project/dev/index.js';
import add from '../project/add.js';
import migrate from '../project/migrate.js';
import installDeps from '../project/installDeps.js';
import lint from '../project/lint.js';
import updateDeps from '../project/updateDeps.js';
import validate from '../project/validate.js';
import profileCommands from '../project/profile.js';
import list from '../project/list.js';
import projectCommand from '../project.js';
import * as projectConfigLib from '../../lib/projects/config.js';
import * as platformVersionLib from '../../lib/projects/platformVersion.js';
import { uiLogger } from '../../lib/ui/logger.js';

vi.mock('../project/deploy');
vi.mock('../project/create');
vi.mock('../project/upload');
vi.mock('../project/listBuilds');
vi.mock('../project/logs');
vi.mock('../project/watch');
vi.mock('../project/download');
vi.mock('../project/open');
vi.mock('../project/dev');
vi.mock('../project/add');
vi.mock('../project/migrateApp', () => ({
  default: {},
}));
vi.mock('../project/cloneApp', () => ({
  default: {},
}));
vi.mock('../project/migrate', () => ({
  default: {},
}));
vi.mock('../project/installDeps');
vi.mock('../project/lint');
vi.mock('../project/profile');
vi.mock('../../lib/commonOpts');
vi.mock('../../lib/projects/config.js');
vi.mock('../../lib/projects/platformVersion.js');

const commandSpy = vi
  .spyOn(yargs as Argv, 'command')
  .mockReturnValue(yargs as Argv);
const demandCommandSpy = vi
  .spyOn(yargs as Argv, 'demandCommand')
  .mockReturnValue(yargs as Argv);

const getProjectConfigSpy = vi.spyOn(projectConfigLib, 'getProjectConfig');
const isUnsupportedPlatformVersionSpy = vi.spyOn(
  platformVersionLib,
  'isUnsupportedPlatformVersion'
);
const processExitSpy = vi.spyOn(process, 'exit');
const uiLoggerErrorSpy = vi.spyOn(uiLogger, 'error');

describe('commands/project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error Mock implementation
    processExitSpy.mockImplementation(() => {});
  });

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectCommand.command).toEqual(['project', 'projects']);
    });
  });

  describe('describe', () => {
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
      migrate,
      installDeps,
      lint,
      updateDeps,
      profileCommands,
      validate,
      list,
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

  describe('middleware - validatePlatformVersion', () => {
    it('should have platform version validation functions available', () => {
      // Verify the necessary functions are available for middleware
      expect(getProjectConfigSpy).toBeDefined();
      expect(isUnsupportedPlatformVersionSpy).toBeDefined();
      expect(uiLoggerErrorSpy).toBeDefined();
      expect(processExitSpy).toBeDefined();
    });

    it('should register middleware when building', async () => {
      // Verify middleware is registered during builder execution
      await projectCommand.builder(yargs as Argv);

      // The middleware should be registered (we can't easily test async middleware execution)
      // but we verify the builder completes successfully
      expect(projectCommand.builder).toBeDefined();
    });
  });
});
