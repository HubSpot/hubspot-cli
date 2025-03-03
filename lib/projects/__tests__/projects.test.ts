import fs from 'fs';
import os from 'os';
import path from 'path';
import { EXIT_CODES } from '../../enums/exitCodes';
import * as projects from '../../projects';
import { logger } from '@hubspot/local-dev-lib/logger';

jest.mock('@hubspot/local-dev-lib/logger');

const mockedValidateProjectConfig = projects.validateProjectConfig as jest.Mock;

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
      mockedValidateProjectConfig(null, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /.*Unable to locate a project configuration file. Try running again from a project directory, or run*/
        )
      );
    });

    it('rejects configuration with missing name', () => {
      mockedValidateProjectConfig({ srcDir: '.' }, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*missing required fields*/)
      );
    });

    it('rejects configuration with missing srcDir', () => {
      mockedValidateProjectConfig({ name: 'hello' }, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*missing required fields.*/)
      );
    });

    describe('rejects configuration with srcDir outside project directory', () => {
      it('for parent directory', () => {
        mockedValidateProjectConfig(
          { name: 'hello', srcDir: '..' },
          projectDir
        );

        expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('srcDir: ".."')
        );
      });

      it('for root directory', () => {
        mockedValidateProjectConfig({ name: 'hello', srcDir: '/' }, projectDir);

        expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('srcDir: "/"')
        );
      });

      it('for complicated directory', () => {
        const srcDir = './src/././../src/../../src';

        mockedValidateProjectConfig({ name: 'hello', srcDir }, projectDir);

        expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining(`srcDir: "${srcDir}"`)
        );
      });
    });

    it('rejects configuration with srcDir that does not exist', () => {
      mockedValidateProjectConfig({ name: 'hello', srcDir: 'foo' }, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*could not be found in.*/)
      );
    });

    describe('accepts configuration with valid srcDir', () => {
      it('for current directory', () => {
        mockedValidateProjectConfig({ name: 'hello', srcDir: '.' }, projectDir);

        expect(exitMock).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('for relative directory', () => {
        mockedValidateProjectConfig(
          { name: 'hello', srcDir: './src' },
          projectDir
        );

        expect(exitMock).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('for implied relative directory', () => {
        mockedValidateProjectConfig(
          { name: 'hello', srcDir: 'src' },
          projectDir
        );

        expect(exitMock).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });
    });
  });
});
