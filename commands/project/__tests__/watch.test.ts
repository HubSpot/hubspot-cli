import yargs, { Argv } from 'yargs';
import {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} from '../../../lib/commonOpts.js';
import * as projectConfigLib from '../../../lib/projects/config.js';
import { uiLogger } from '../../../lib/ui/logger.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import projectWatchCommand from '../watch.js';

vi.mock('../../../lib/commonOpts');
vi.mock('../../../lib/projects/config.js');

const getProjectConfigSpy = vi.spyOn(projectConfigLib, 'getProjectConfig');
const processExitSpy = vi.spyOn(process, 'exit');

describe('commands/project/watch', () => {
  const yargsMock = yargs as Argv;

  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectWatchCommand.command).toEqual('watch');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectWatchCommand.describe).toBeDefined();
    });

    it('should mark the command as deprecated and point to hs project dev', () => {
      expect(projectWatchCommand.describe).toContain('[DEPRECATED]');
      expect(projectWatchCommand.describe).toContain('hs project dev');
    });
  });

  describe('builder', () => {
    it('should support the correct options', () => {
      projectWatchCommand.builder(yargsMock);

      expect(addAccountOptions).toHaveBeenCalledTimes(1);
      expect(addAccountOptions).toHaveBeenCalledWith(yargsMock);

      expect(addConfigOptions).toHaveBeenCalledTimes(1);
      expect(addConfigOptions).toHaveBeenCalledWith(yargsMock);

      expect(addUseEnvironmentOptions).toHaveBeenCalledTimes(1);
      expect(addUseEnvironmentOptions).toHaveBeenCalledWith(yargsMock);
    });

    it('should define options', () => {
      const optionSpy = vi.spyOn(yargsMock, 'option');
      const exampleSpy = vi.spyOn(yargsMock, 'example');

      projectWatchCommand.builder(yargsMock);

      expect(optionSpy).toHaveBeenCalledWith(
        'initial-upload',
        expect.any(Object)
      );

      expect(exampleSpy).toHaveBeenCalled();
    });
  });

  describe('handler', () => {
    beforeEach(() => {
      // @ts-expect-error Mock implementation
      processExitSpy.mockImplementation(() => {});
      getProjectConfigSpy.mockResolvedValue({
        projectConfig: null,
        projectDir: null,
      });
    });

    it('should log a runtime notice pointing users to hs project dev', async () => {
      await projectWatchCommand.handler({
        _: ['project', 'watch'],
        derivedAccountId: 123456,
      } as unknown as Parameters<typeof projectWatchCommand.handler>[0]);

      const loggedMessages = vi
        .mocked(uiLogger.log)
        .mock.calls.map(call => String(call[0]))
        .join('\n');

      expect(loggedMessages).toContain('hs project dev');
      expect(loggedMessages).toContain('deprecated');
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
