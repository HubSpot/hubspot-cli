import fs from 'fs';
import os from 'os';
import path from 'path';
import { projectConfigIsValid } from '../../projects/config';
import { logger } from '@hubspot/local-dev-lib/logger';

jest.mock('@hubspot/local-dev-lib/logger');

describe('lib/projects', () => {
  describe('validateProjectConfig()', () => {
    let projectDir: string;

    beforeAll(() => {
      projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'));
      fs.mkdirSync(path.join(projectDir, 'src'));
    });

    it('rejects undefined configuration', () => {
      // @ts-ignore Testing invalid input
      const isValid = projectConfigIsValid(null, projectDir);

      expect(isValid).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /.*Unable to locate a project configuration file. Try running again from a project directory, or run*/
        )
      );
    });

    it('rejects configuration with missing name', () => {
      // @ts-ignore Testing invalid input
      const isValid = projectConfigIsValid({ srcDir: '.' }, projectDir);

      expect(isValid).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*missing required fields*/)
      );
    });

    it('rejects configuration with missing srcDir', () => {
      // @ts-ignore Testing invalid input
      const isValid = projectConfigIsValid({ name: 'hello' }, projectDir);

      expect(isValid).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*missing required fields.*/)
      );
    });

    describe('rejects configuration with srcDir outside project directory', () => {
      it('for parent directory', () => {
        const isValid = projectConfigIsValid(
          { name: 'hello', srcDir: '..', platformVersion: '' },
          projectDir
        );

        expect(isValid).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('srcDir: ".."')
        );
      });

      it('for root directory', () => {
        const isValid = projectConfigIsValid(
          { name: 'hello', srcDir: '/', platformVersion: '' },
          projectDir
        );

        expect(isValid).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('srcDir: "/"')
        );
      });

      it('for complicated directory', () => {
        const srcDir = './src/././../src/../../src';

        const isValid = projectConfigIsValid(
          { name: 'hello', srcDir, platformVersion: '' },
          projectDir
        );

        expect(isValid).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining(`srcDir: "${srcDir}"`)
        );
      });
    });

    it('rejects configuration with srcDir that does not exist', () => {
      const isValid = projectConfigIsValid(
        { name: 'hello', srcDir: 'foo', platformVersion: '' },
        projectDir
      );

      expect(isValid).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/.*could not be found in.*/)
      );
    });

    describe('accepts configuration with valid srcDir', () => {
      it('for current directory', () => {
        const isValid = projectConfigIsValid(
          { name: 'hello', srcDir: '.', platformVersion: '' },
          projectDir
        );

        expect(isValid).toBe(true);
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('for relative directory', () => {
        const isValid = projectConfigIsValid(
          { name: 'hello', srcDir: './src', platformVersion: '' },
          projectDir
        );

        expect(isValid).toBe(true);
        expect(logger.error).not.toHaveBeenCalled();
      });

      it('for implied relative directory', () => {
        const isValid = projectConfigIsValid(
          { name: 'hello', srcDir: 'src', platformVersion: '' },
          projectDir
        );

        expect(isValid).toBe(true);
        expect(logger.error).not.toHaveBeenCalled();
      });
    });
  });
});
