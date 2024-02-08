const fs = require('fs');
const os = require('os');
const path = require('path');
const { EXIT_CODES } = require('../enums/exitCodes');
const projects = require('../projects');

describe('@hubspot/cli/lib/projects', () => {
  describe('validateProjectConfig()', () => {
    let realProcess;
    let projectDir;
    let exitMock;
    let errorSpy;

    beforeAll(() => {
      projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'));
      fs.mkdirSync(path.join(projectDir, 'src'));

      realProcess = process;
      errorSpy = jest.spyOn(console, 'error');
    });

    beforeEach(() => {
      exitMock = jest.fn();
      global.process = { ...realProcess, exit: exitMock };
    });

    afterEach(() => {
      errorSpy.mockClear();
    });

    afterAll(() => {
      global.process = realProcess;
      errorSpy.mockRestore();
    });

    it('rejects undefined configuration', () => {
      projects.validateProjectConfig(null, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/.*config not found.*/)
      );
    });

    it('rejects configuration with missing name', () => {
      projects.validateProjectConfig({ srcDir: '.' }, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/.*missing required fields*/)
      );
    });

    it('rejects configuration with missing srcDir', () => {
      projects.validateProjectConfig({ name: 'hello' }, projectDir);

      expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(errorSpy).toHaveBeenCalledWith(
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
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('srcDir: ".."')
        );
      });

      it('for root directory', () => {
        projects.validateProjectConfig(
          { name: 'hello', srcDir: '/' },
          projectDir
        );

        expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('srcDir: "/"')
        );
      });

      it('for complicated directory', () => {
        const srcDir = './src/././../src/../../src';

        projects.validateProjectConfig({ name: 'hello', srcDir }, projectDir);

        expect(exitMock).toHaveBeenCalledWith(EXIT_CODES.ERROR);
        expect(errorSpy).toHaveBeenCalledWith(
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
      expect(errorSpy).toHaveBeenCalledWith(
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
        expect(errorSpy).not.toHaveBeenCalled();
      });

      it('for relative directory', () => {
        projects.validateProjectConfig(
          { name: 'hello', srcDir: './src' },
          projectDir
        );

        expect(exitMock).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
      });

      it('for implied relative directory', () => {
        projects.validateProjectConfig(
          { name: 'hello', srcDir: 'src' },
          projectDir
        );

        expect(exitMock).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
      });
    });
  });
});
