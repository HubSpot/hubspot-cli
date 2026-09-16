import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  validateProjectConfig,
  ProjectConfigValidationError,
} from '@hubspot/project-parsing-lib/projects';

describe('lib/projects', () => {
  describe('validateProjectConfig()', () => {
    let projectDir: string;

    beforeAll(() => {
      projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'));
      fs.mkdirSync(path.join(projectDir, 'src'));
    });

    it('rejects undefined configuration', () => {
      // @ts-ignore Testing invalid input
      expect(() => validateProjectConfig(null, projectDir)).toThrow(
        ProjectConfigValidationError
      );
    });

    it('rejects configuration with missing name', () => {
      // @ts-ignore Testing invalid input
      expect(() => validateProjectConfig({ srcDir: '.' }, projectDir)).toThrow(
        /missing required field/
      );
    });

    it('rejects configuration with missing srcDir', () => {
      expect(() =>
        // @ts-ignore Testing invalid input
        validateProjectConfig({ name: 'hello' }, projectDir)
      ).toThrow(/missing required field/);
    });

    it('rejects configuration with both name and srcDir missing', () => {
      // @ts-ignore Testing invalid input
      expect(() => validateProjectConfig({}, projectDir)).toThrow(
        /missing required field/
      );
    });

    describe('rejects configuration with srcDir outside project directory', () => {
      it('for parent directory', () => {
        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir: '..', platformVersion: '2025.2' },
            projectDir
          )
        ).toThrow(ProjectConfigValidationError);
      });

      it('for root directory', () => {
        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir: '/', platformVersion: '2025.2' },
            projectDir
          )
        ).toThrow(ProjectConfigValidationError);
      });

      it('for complicated directory', () => {
        const srcDir = './src/././../src/../../src';

        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir, platformVersion: '2025.2' },
            projectDir
          )
        ).toThrow(ProjectConfigValidationError);
      });
    });

    it('rejects configuration with srcDir that does not exist', () => {
      expect(() =>
        validateProjectConfig(
          { name: 'hello', srcDir: 'foo', platformVersion: '2025.2' },
          projectDir
        )
      ).toThrow(ProjectConfigValidationError);
    });

    describe('accepts configuration with valid srcDir', () => {
      it('for current directory', () => {
        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir: '.', platformVersion: '2025.2' },
            projectDir
          )
        ).not.toThrow();
      });

      it('for relative directory', () => {
        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir: './src', platformVersion: '2025.2' },
            projectDir
          )
        ).not.toThrow();
      });

      it('for implied relative directory', () => {
        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir: 'src', platformVersion: '2025.2' },
            projectDir
          )
        ).not.toThrow();
      });
    });
  });
});
