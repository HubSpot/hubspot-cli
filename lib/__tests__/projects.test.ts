// @ts-nocheck
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EXIT_CODES } = require('../enums/exitCodes');
const projects = require('../projects');
const { logger } = require('@hubspot/local-dev-lib/logger');

jest.mock('@hubspot/local-dev-lib/logger');

describe('lib/projects', () => {
  describe('validateProjectConfig()', () => {
    let realProcess;
    let projectDir;
    let exitMock;

    beforeAll(() => {
      projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'));
      fs.mkdirSync(path.join(projectDir, 'src'));

      realProcess = process;
    });

    beforeEach(() => {
      exitMock = jest.fn();
      global.process = { ...realProcess, exit: exitMock };
    });

    afterAll(() => {
      global.process = realProcess;
    });

    it('rejects undefined configuration', () => {
      projects.validateProjectConfig(null, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /.*Unable to locate a project configuration file. Try running again from a project directory, or run*/
        )
      );
    });

    it('rejects configuration with missing name', () => {
      projects.validateProjectConfig({ srcDir: '.' }, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*missing required fields*/)
      );
    });

    it('rejects configuration with missing srcDir', () => {
      projects.validateProjectConfig({ name: 'hello' }, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*missing required fields.*/)
      );
    });

    describe('rejects configuration with srcDir outside project directory', () => {
      it('for parent directory', () => {
        projects.validateProjectConfig(
          { name: 'hello', srcDir: '..' },
          projectDir
        );

        expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('srcDir: ".."')
        );
      });

      it('for root directory', () => {
        projects.validateProjectConfig(
          { name: 'hello', srcDir: '/' },
          projectDir
        );

        expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('srcDir: "/"')
        );
      });

      it('for complicated directory', () => {
        const srcDir = './src/././../src/../../src';

        projects.validateProjectConfig({ name: 'hello', srcDir }, projectDir);

        expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining(`srcDir: "${srcDir}"`)
        );
      });
    });

    it('rejects configuration with srcDir that does not exist', () => {
      projects.validateProjectConfig(
        { name: 'hello', srcDir: 'foo' },
        projectDir
      );

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*could not be found in.*/)
      );
    });

    describe('accepts configuration with valid srcDir', () => {
      it('for current directory', () => {
        projects.validateProjectConfig(
          { name: 'hello', srcDir: '.' },
          projectDir
        );

        expect(exitMock).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('for relative directory', () => {
        projects.validateProjectConfig(
          { name: 'hello', srcDir: './src' },
          projectDir
        );

        expect(exitMock).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('for implied relative directory', () => {
        projects.validateProjectConfig(
          { name: 'hello', srcDir: 'src' },
          projectDir
        );

        expect(exitMock).not.toHaveBeenCalled();
        expect(logger.error).not.toHaveBeenCalled();
      });
    });
  });
});
