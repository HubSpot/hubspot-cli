import fs from 'fs';
import os from 'os';
import path from 'path';
import { validateProjectConfig } from '../../projects/config.js';
import ProjectValidationError from '../../errors/ProjectValidationError.js';

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
        /.*Unable to locate a project configuration file. Try running again from a project directory, or run*/
      );
    });

    it('rejects configuration with missing name', () => {
      // @ts-ignore Testing invalid input
      expect(() => validateProjectConfig({ srcDir: '.' }, projectDir)).toThrow(
        /missing required field.*name/
      );
    });

    it('rejects configuration with missing srcDir', () => {
      expect(() =>
        // @ts-ignore Testing invalid input
        validateProjectConfig({ name: 'hello' }, projectDir)
      ).toThrow(/missing required field.*srcDir/);
    });

    it('rejects configuration with both name and srcDir missing', () => {
      // @ts-ignore Testing invalid input
      expect(() => validateProjectConfig({}, projectDir)).toThrow(
        /missing required fields:.*name.*srcDir/
      );
    });

    describe('rejects configuration with srcDir outside project directory', () => {
      it('for parent directory', () => {
        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir: '..', platformVersion: '' },
            projectDir
          )
        ).toThrow(/srcDir: "\.\."/);
      });

      it('for root directory', () => {
        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir: '/', platformVersion: '' },
            projectDir
          )
        ).toThrow(/srcDir: "\/"/);
      });

      it('for complicated directory', () => {
        const srcDir = './src/././../src/../../src';

        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir, platformVersion: '' },
            projectDir
          )
        ).toThrow(ProjectValidationError);
        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir, platformVersion: '' },
            projectDir
          )
        ).toThrow(/srcDir:/);
      });
    });

    it('rejects configuration with srcDir that does not exist', () => {
      expect(() =>
        validateProjectConfig(
          { name: 'hello', srcDir: 'foo', platformVersion: '' },
          projectDir
        )
      ).toThrow(/.*could not be found in.*/);
    });

    describe('accepts configuration with valid srcDir', () => {
      it('for current directory', () => {
        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir: '.', platformVersion: '' },
            projectDir
          )
        ).not.toThrow();
      });

      it('for relative directory', () => {
        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir: './src', platformVersion: '' },
            projectDir
          )
        ).not.toThrow();
      });

      it('for implied relative directory', () => {
        expect(() =>
          validateProjectConfig(
            { name: 'hello', srcDir: 'src', platformVersion: '' },
            projectDir
          )
        ).not.toThrow();
      });
    });
  });
});
