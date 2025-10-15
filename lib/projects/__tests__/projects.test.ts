import fs from 'fs';
import os from 'os';
import path from 'path';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { validateProjectConfig } from '../../projects/config.js';
import { uiLogger } from '../../ui/logger.js';
import { Mock } from 'vitest';

vi.mock('../../ui/logger.js');

describe('lib/projects', () => {
  describe('validateProjectConfig()', () => {
    let projectDir: string;
    let exitMock: Mock<typeof process.exit>;

    beforeAll(() => {
      projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'));
      fs.mkdirSync(path.join(projectDir, 'src'));
    });

    beforeEach(() => {
      // @ts-expect-error - Mocking process.exit
      exitMock = vi
        .spyOn(process, 'exit')
        .mockImplementation((): never => undefined as never);
    });

    afterEach(() => {
      exitMock.mockRestore();
    });

    it('rejects undefined configuration', () => {
      // @ts-ignore Testing invalid input
      validateProjectConfig(null, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /.*Unable to locate a project configuration file. Try running again from a project directory, or run*/
        )
      );
    });

    it('rejects configuration with missing name', () => {
      // @ts-ignore Testing invalid input
      validateProjectConfig({ srcDir: '.' }, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*missing required fields*/)
      );
    });

    it('rejects configuration with missing srcDir', () => {
      // @ts-ignore Testing invalid input
      validateProjectConfig({ name: 'hello' }, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*missing required fields.*/)
      );
    });

    describe('rejects configuration with srcDir outside project directory', () => {
      it('for parent directory', () => {
        validateProjectConfig(
          { name: 'hello', srcDir: '..', platformVersion: '' },
          projectDir
        );

        expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('srcDir: ".."')
        );
      });

      it('for root directory', () => {
        validateProjectConfig(
          { name: 'hello', srcDir: '/', platformVersion: '' },
          projectDir
        );

        expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('srcDir: "/"')
        );
      });

      it('for complicated directory', () => {
        const srcDir = './src/././../src/../../src';

        validateProjectConfig(
          { name: 'hello', srcDir, platformVersion: '' },
          projectDir
        );

        expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(uiLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(`srcDir: "${srcDir}"`)
        );
      });
    });

    it('rejects configuration with srcDir that does not exist', () => {
      validateProjectConfig(
        { name: 'hello', srcDir: 'foo', platformVersion: '' },
        projectDir
      );

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*could not be found in.*/)
      );
    });

    describe('accepts configuration with valid srcDir', () => {
      it('for current directory', () => {
        validateProjectConfig(
          { name: 'hello', srcDir: '.', platformVersion: '' },
          projectDir
        );

        expect(exitMock).not.toHaveBeenCalled();
        expect(uiLogger.error).not.toHaveBeenCalled();
      });

      it('for relative directory', () => {
        validateProjectConfig(
          { name: 'hello', srcDir: './src', platformVersion: '' },
          projectDir
        );

        expect(exitMock).not.toHaveBeenCalled();
        expect(uiLogger.error).not.toHaveBeenCalled();
      });

      it('for implied relative directory', () => {
        validateProjectConfig(
          { name: 'hello', srcDir: 'src', platformVersion: '' },
          projectDir
        );

        expect(exitMock).not.toHaveBeenCalled();
        expect(uiLogger.error).not.toHaveBeenCalled();
      });
    });
  });
});
