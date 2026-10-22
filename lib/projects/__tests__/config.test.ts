import fs from 'fs';
import os from 'os';
import path from 'path';
import { getIsInProject, getProjectConfig } from '../config.js';
import { lib } from '../../../lang/en.js';

describe('lib/projects/config', () => {
  let tempDir: string;
  let projectDir: string;
  let nestedDir: string;
  let outsideDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-config-'));
    projectDir = path.join(tempDir, 'my-project');
    nestedDir = path.join(projectDir, 'src', 'app');
    outsideDir = path.join(tempDir, 'not-a-project');

    fs.mkdirSync(nestedDir, { recursive: true });
    fs.mkdirSync(outsideDir);
    fs.writeFileSync(
      path.join(projectDir, 'hsproject.json'),
      JSON.stringify({
        name: 'my-project',
        srcDir: 'src',
        platformVersion: '2025.2',
      })
    );
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getIsInProject()', () => {
    it('should return true in the project root', () => {
      expect(getIsInProject(projectDir)).toBe(true);
    });

    it('should return true in a nested directory of the project', () => {
      expect(getIsInProject(nestedDir)).toBe(true);
    });

    it('should return false outside a project', () => {
      expect(getIsInProject(outsideDir)).toBe(false);
    });

    it('should find a project config file with different casing', () => {
      const casedProjectDir = path.join(tempDir, 'cased-project');
      fs.mkdirSync(path.join(casedProjectDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(casedProjectDir, 'HSPROJECT.JSON'), '{}');

      expect(getIsInProject(path.join(casedProjectDir, 'src'))).toBe(true);
    });
  });

  describe('getProjectConfig()', () => {
    it('should load the project config from a nested directory', () => {
      const { projectDir: foundProjectDir, projectConfig } =
        getProjectConfig(nestedDir);

      expect(foundProjectDir).toBe(projectDir);
      expect(projectConfig.name).toBe('my-project');
    });

    it('should throw when no project config file exists', () => {
      expect(() => getProjectConfig(outsideDir)).toThrow(
        lib.projects.validateProjectConfig.configNotFound
      );
    });
  });
});
