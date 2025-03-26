import fs from 'fs';
import os from 'os';
import path from 'path';
import { EXIT_CODES } from '../../enums/exitCodes';
import { validateProjectConfig } from '../../projects';
import { logger } from '@hubspot/local-dev-lib/logger';

jest.mock('@hubspot/local-dev-lib/logger');

describe('lib/projects', () => {
  describe('validateProjectConfig()', () => {
    let projectDir: string;
    let exitMock: jest.SpyInstance;

    beforeAll(() => {
      projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'));
      fs.mkdirSync(path.join(projectDir, 'src'));
    });

    beforeEach(() => {
      exitMock = jest
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
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /.*Unable to locate a project configuration file. Try running again from a project directory, or run*/
        )
      );
    });

    it('rejects configuration with missing name', () => {
      // @ts-ignore Testing invalid input
      validateProjectConfig({ srcDir: '.' }, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*missing required fields*/)
      );
    });

    it('rejects configuration with missing srcDir', () => {
      // @ts-ignore Testing invalid input
      validateProjectConfig({ name: 'hello' }, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(logger.error).toHaveBeenCalledWith(
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
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('srcDir: ".."')
        );
      });

      it('for root directory', () => {
        validateProjectConfig(
          { name: 'hello', srcDir: '/', platformVersion: '' },
          projectDir
        );

        expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(logger.error).toHaveBeenCalledWith(
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
        expect(logger.error).toHaveBeenCalledWith(
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
      expect(logger.error).toHaveBeenCalledWith(
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
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('for relative directory', () => {
        validateProjectConfig(
          { name: 'hello', srcDir: './src', platformVersion: '' },
          projectDir
        );

        expect(exitMock).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('for implied relative directory', () => {
        validateProjectConfig(
          { name: 'hello', srcDir: 'src', platformVersion: '' },
          projectDir
        );

        expect(exitMock).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });
    });
  });
});
