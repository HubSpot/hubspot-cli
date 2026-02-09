import util from 'util';
import {
  installPackages,
  updatePackages,
  getProjectPackageJsonLocations,
  isPackageInstalled,
} from '../dependencyManagement.js';
import { walk } from '@hubspot/local-dev-lib/fs';
import path from 'path';
import { getProjectConfig } from '../projects/config.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import fs from 'fs';
import { Mock } from 'vitest';
import { clearPackageJsonCache } from '../npm/packageJson.js';

vi.mock('../projects/config');
vi.mock('@hubspot/local-dev-lib/fs');
vi.mock('fs');
vi.mock('../ui/SpinniesManager', () => ({
  default: {
    init: vi.fn(),
    add: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  },
}));

const mockedFs = vi.mocked(fs);

describe('lib/dependencyManagement', () => {
  let execMock: Mock;

  const projectDir = path.join('path', 'to', 'project');
  const srcDir = 'src';
  const appDir = path.join(projectDir, srcDir, 'app');
  const appFunctionsDir = path.join(appDir, 'app.functions');
  const extensionsDir = path.join(appDir, 'exensions');
  const projectName = 'super cool test project';
  const installLocations = [appFunctionsDir, extensionsDir];

  function mockedPromisify(execMock: Mock): typeof util.promisify {
    return vi
      .fn()
      .mockReturnValue(execMock) as unknown as typeof util.promisify;
  }

  const mockedWalk = walk as Mock;
  const mockedGetProjectConfig = getProjectConfig as Mock;

  beforeEach(() => {
    execMock = vi.fn();
    util.promisify = mockedPromisify(execMock);
    mockedGetProjectConfig.mockResolvedValue({
      projectDir,
      projectConfig: {
        srcDir,
        name: projectName,
      },
    });
    mockedFs.existsSync.mockReturnValue(true); // Default to true, override in specific tests
    clearPackageJsonCache();
  });

  describe('installPackages()', () => {
    it('should setup a loading spinner', async () => {
      const packages = ['package1', 'package2'];
      mockedWalk.mockResolvedValue(installLocations);
      await installPackages({ packages, installLocations });
      expect(SpinniesManager.add).toHaveBeenCalledTimes(
        installLocations.length
      );
      expect(SpinniesManager.succeed).toHaveBeenCalledTimes(
        installLocations.length
      );
    });

    it('should install the provided packages in all the provided install locations', async () => {
      mockedWalk.mockResolvedValue(installLocations);
      const packages = ['package1', 'package2'];
      await installPackages({ packages, installLocations });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);
      expect(SpinniesManager.add).toHaveBeenCalledTimes(
        installLocations.length
      );
      expect(SpinniesManager.succeed).toHaveBeenCalledTimes(
        installLocations.length
      );

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(`npm install package1 package2`, {
          cwd: location,
        });
        expect(SpinniesManager.add).toHaveBeenCalledWith(
          `installingDependencies-${location}`,
          {
            text: `Installing [package1, package2] in ${location}`,
          }
        );
        expect(SpinniesManager.succeed).toHaveBeenCalledWith(
          `installingDependencies-${location}`,
          {
            text: `Installed dependencies in ${location}`,
          }
        );
      }
    });

    it('should use the provided install locations', async () => {
      mockedWalk.mockResolvedValue(installLocations);
      await installPackages({ installLocations });
      expect(execMock).toHaveBeenCalledTimes(installLocations.length);
      expect(execMock).toHaveBeenCalledWith(`npm install `, {
        cwd: appFunctionsDir,
      });
      expect(execMock).toHaveBeenCalledWith(`npm install `, {
        cwd: extensionsDir,
      });
    });

    it('should locate the projects package.json files when install locations is not provided', async () => {
      const installLocations = [
        path.join(appFunctionsDir, 'package.json'),
        path.join(extensionsDir, 'package.json'),
      ];

      mockedWalk.mockResolvedValue(installLocations);

      mockedGetProjectConfig.mockResolvedValue({
        projectDir,
        projectConfig: {
          srcDir,
        },
      });

      await installPackages({});

      // It's called once per each install location, plus once to check if npm installed
      expect(execMock).toHaveBeenCalledTimes(installLocations.length + 1);
      expect(execMock).toHaveBeenCalledWith(`npm install `, {
        cwd: appFunctionsDir,
      });
      expect(execMock).toHaveBeenCalledWith(`npm install `, {
        cwd: extensionsDir,
      });
    });

    it('should install packages as dev dependencies when dev flag is true', async () => {
      const packages = ['eslint', 'prettier'];
      await installPackages({ packages, installLocations, dev: true });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(
          `npm install --save-dev eslint prettier`,
          {
            cwd: location,
          }
        );
      }
    });

    it('should install packages as regular dependencies when dev flag is false', async () => {
      const packages = ['react', 'react-dom'];
      await installPackages({ packages, installLocations, dev: false });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(`npm install react react-dom`, {
          cwd: location,
        });
      }
    });

    it('should install packages as regular dependencies when dev flag is not provided', async () => {
      const packages = ['axios'];
      await installPackages({ packages, installLocations });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(`npm install axios`, {
          cwd: location,
        });
      }
    });

    it('should not use --save-dev flag when dev is true but no packages are provided', async () => {
      mockedWalk.mockResolvedValue(installLocations);

      await installPackages({ installLocations, dev: true });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);

      for (let i = 0; i < installLocations.length; i++) {
        const installLocation = installLocations[i];
        expect(execMock.mock.calls[i]).toEqual([
          `npm install `,
          {
            cwd: installLocation,
          },
        ]);
      }
    });

    it('should not use --save-dev flag when dev is true but packages array is empty', async () => {
      await installPackages({ packages: [], installLocations, dev: true });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);

      for (let i = 0; i < installLocations.length; i++) {
        const installLocation = installLocations[i];
        expect(execMock.mock.calls[i]).toEqual([
          `npm install `,
          {
            cwd: installLocation,
          },
        ]);
      }
    });

    it('should throw an error when installing the dependencies fails', async () => {
      execMock = vi.fn().mockImplementation(command => {
        if (command === 'npm --version') {
          return;
        }
        throw new Error('OH NO');
      });

      util.promisify = mockedPromisify(execMock);

      // Mock walk to return the directory paths instead of package.json paths
      mockedWalk.mockResolvedValue([appFunctionsDir, extensionsDir]);
      mockedFs.existsSync.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        if (
          pathStr === projectDir ||
          pathStr === path.join(projectDir, srcDir)
        ) {
          return true;
        }
        return false;
      });

      await expect(() =>
        installPackages({ installLocations: [appFunctionsDir, extensionsDir] })
      ).rejects.toThrowError(
        `Installing dependencies for ${appFunctionsDir} failed`
      );

      expect(SpinniesManager.fail).toHaveBeenCalledTimes(
        installLocations.length
      );

      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        `installingDependencies-${appFunctionsDir}`,
        {
          text: `Installing dependencies for ${appFunctionsDir} failed`,
        }
      );
      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        `installingDependencies-${extensionsDir}`,
        {
          text: `Installing dependencies for ${extensionsDir} failed`,
        }
      );
    });
  });

  describe('updatePackages()', () => {
    it('should setup a loading spinner', async () => {
      mockedWalk.mockResolvedValue(installLocations);
      const packages = ['package1', 'package2'];
      await updatePackages({ packages, installLocations });
      expect(SpinniesManager.add).toHaveBeenCalledTimes(
        installLocations.length
      );
      expect(SpinniesManager.succeed).toHaveBeenCalledTimes(
        installLocations.length
      );
    });

    it('should update the provided packages in all the provided install locations', async () => {
      mockedWalk.mockResolvedValue(installLocations);
      const packages = ['package1', 'package2'];
      await updatePackages({ packages, installLocations });

      expect(execMock).toHaveBeenCalledTimes(installLocations.length);
      expect(SpinniesManager.add).toHaveBeenCalledTimes(
        installLocations.length
      );
      expect(SpinniesManager.succeed).toHaveBeenCalledTimes(
        installLocations.length
      );

      for (const location of installLocations) {
        expect(execMock).toHaveBeenCalledWith(`npm update package1 package2`, {
          cwd: location,
        });
        expect(SpinniesManager.add).toHaveBeenCalledWith(
          `updatingDependencies-${location}`,
          {
            text: `Updating [package1, package2] in ${location}`,
          }
        );
        expect(SpinniesManager.succeed).toHaveBeenCalledWith(
          `updatingDependencies-${location}`,
          {
            text: `Updated dependencies in ${location}`,
          }
        );
      }
    });

    it('should use the provided install locations', async () => {
      await updatePackages({ installLocations });
      expect(execMock).toHaveBeenCalledTimes(installLocations.length);
      expect(execMock).toHaveBeenCalledWith(`npm update `, {
        cwd: appFunctionsDir,
      });
      expect(execMock).toHaveBeenCalledWith(`npm update `, {
        cwd: extensionsDir,
      });
    });

    it('should locate the projects package.json files when install locations is not provided', async () => {
      const installLocations = [
        path.join(appFunctionsDir, 'package.json'),
        path.join(extensionsDir, 'package.json'),
      ];

      mockedWalk.mockResolvedValue(installLocations);

      mockedGetProjectConfig.mockResolvedValue({
        projectDir,
        projectConfig: {
          srcDir,
        },
      });

      await updatePackages({});

      // It's called once per each install location, plus once to check if npm installed
      expect(execMock).toHaveBeenCalledTimes(installLocations.length + 1);
      expect(execMock).toHaveBeenCalledWith(`npm update `, {
        cwd: appFunctionsDir,
      });
      expect(execMock).toHaveBeenCalledWith(`npm update `, {
        cwd: extensionsDir,
      });
    });

    it('should throw an error when updating the dependencies fails', async () => {
      execMock = vi.fn().mockImplementation(command => {
        if (command === 'npm --version') {
          return;
        }
        throw new Error('OH NO');
      });

      util.promisify = mockedPromisify(execMock);

      // Mock walk to return the directory paths instead of package.json paths
      mockedWalk.mockResolvedValue([appFunctionsDir, extensionsDir]);
      mockedFs.existsSync.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        if (
          pathStr === projectDir ||
          pathStr === path.join(projectDir, srcDir)
        ) {
          return true;
        }
        return false;
      });

      await expect(() =>
        updatePackages({ installLocations: [appFunctionsDir, extensionsDir] })
      ).rejects.toThrowError(
        `Updating dependencies for ${appFunctionsDir} failed`
      );

      expect(SpinniesManager.fail).toHaveBeenCalledTimes(
        installLocations.length
      );

      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        `updatingDependencies-${appFunctionsDir}`,
        {
          text: `Updating dependencies for ${appFunctionsDir} failed`,
        }
      );
      expect(SpinniesManager.fail).toHaveBeenCalledWith(
        `updatingDependencies-${extensionsDir}`,
        {
          text: `Updating dependencies for ${extensionsDir} failed`,
        }
      );
    });
  });

  describe('getProjectPackageJsonFiles()', () => {
    it('should throw an error when ran outside the boundary of a project', async () => {
      mockedGetProjectConfig.mockResolvedValue({});
      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        'No project detected. Run this command from a project directory.'
      );
    });

    it('should throw an error if npm is not globally installed', async () => {
      execMock = vi.fn().mockImplementation(() => {
        throw new Error('OH NO');
      });
      util.promisify = mockedPromisify(execMock);
      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        /This command depends on npm, install/
      );
    });

    it('should throw an error if the project directory does not exist', async () => {
      mockedFs.existsSync.mockReturnValueOnce(false);
      await expect(() => getProjectPackageJsonLocations()).rejects.toThrowError(
        new RegExp(
          `No dependencies to install. The project ${projectName} folder might be missing component or subcomponent files.`
        )
      );
    });

    it('should throw "install" error message when isUpdate=false and no package.json files found', async () => {
      mockedWalk.mockResolvedValue([]);
      mockedFs.existsSync.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        if (
          pathStr === projectDir ||
          pathStr === path.join(projectDir, srcDir)
        ) {
          return true;
        }
        return false;
      });

      await expect(() =>
        getProjectPackageJsonLocations(undefined, false)
      ).rejects.toThrowError(
        new RegExp(
          `No dependencies to install. The project ${projectName} folder might be missing component or subcomponent files.`
        )
      );
    });

    it('should throw "update" error message when isUpdate=true and no package.json files found', async () => {
      mockedWalk.mockResolvedValue([]);
      mockedFs.existsSync.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        if (
          pathStr === projectDir ||
          pathStr === path.join(projectDir, srcDir)
        ) {
          return true;
        }
        return false;
      });

      await expect(() =>
        getProjectPackageJsonLocations(undefined, true)
      ).rejects.toThrowError(
        new RegExp(
          `No dependencies to update. The project ${projectName} folder might be missing component or subcomponent files.`
        )
      );
    });

    it('should ignore package.json files in certain directories', async () => {
      const nodeModulesDir = path.join(appDir, 'node_modules');
      const viteDir = path.join(appDir, '.vite');
      const installLocations = [
        path.join(appFunctionsDir, 'package.json'),
        path.join(extensionsDir, 'package.json'),
        path.join(viteDir, 'package.json'),
        path.join(nodeModulesDir, 'package.json'),
      ];

      mockedWalk.mockResolvedValue(installLocations);
      mockedFs.existsSync.mockImplementation(filePath => {
        // Return true for project directory and src directory
        const pathStr = filePath.toString();
        if (
          pathStr === projectDir ||
          pathStr === path.join(projectDir, srcDir)
        ) {
          return true;
        }
        return false;
      });

      const actual = await getProjectPackageJsonLocations();
      expect(actual).toEqual([appFunctionsDir, extensionsDir]);
    });
  });

  describe('isPackageInstalled()', () => {
    const testDir = '/test/directory';
    const readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
    const existsSyncSpy = vi.spyOn(fs, 'existsSync');

    function mockNodeModulesExists(packageName: string, exists = true): void {
      existsSyncSpy.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        return (
          exists && pathStr === path.join(testDir, 'node_modules', packageName)
        );
      });
    }

    beforeEach(() => {
      readFileSyncSpy.mockReset();
      existsSyncSpy.mockReset();
    });

    it('should return true if package is in dependencies and in node_modules', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            eslint: '^9.0.0',
          },
        })
      );
      mockNodeModulesExists('eslint', true);

      const result = isPackageInstalled(testDir, 'eslint');

      expect(result).toBe(true);
      expect(readFileSyncSpy).toHaveBeenCalledWith(
        path.join(testDir, 'package.json'),
        'utf-8'
      );
      expect(existsSyncSpy).toHaveBeenCalledWith(
        path.join(testDir, 'node_modules', 'eslint')
      );
    });

    it('should return true if package is in devDependencies and in node_modules', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          devDependencies: {
            prettier: '^3.0.0',
          },
        })
      );
      mockNodeModulesExists('prettier', true);

      const result = isPackageInstalled(testDir, 'prettier');

      expect(result).toBe(true);
    });

    it('should return false if package is in package.json but not in node_modules', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            react: '^18.0.0',
          },
        })
      );
      mockNodeModulesExists('react', false);

      const result = isPackageInstalled(testDir, 'react');

      expect(result).toBe(false);
    });

    it('should return false if package is not in package.json but is in node_modules', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            typescript: '^5.0.0',
          },
        })
      );
      mockNodeModulesExists('lodash', true);

      const result = isPackageInstalled(testDir, 'lodash');

      expect(result).toBe(false);
    });

    it('should return false if package is not in package.json and not in node_modules', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {},
        })
      );
      mockNodeModulesExists('nonexistent-package', false);

      const result = isPackageInstalled(testDir, 'nonexistent-package');

      expect(result).toBe(false);
    });

    it('should return false if package.json cannot be read', () => {
      readFileSyncSpy.mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      const result = isPackageInstalled(testDir, 'eslint');

      expect(result).toBe(false);
    });

    it('should return false if package.json has invalid JSON', () => {
      readFileSyncSpy.mockReturnValueOnce('invalid json{');

      const result = isPackageInstalled(testDir, 'eslint');

      expect(result).toBe(false);
    });

    it('should return false if checking node_modules throws an error', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            eslint: '^9.0.0',
          },
        })
      );
      existsSyncSpy.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = isPackageInstalled(testDir, 'eslint');

      expect(result).toBe(false);
    });

    it('should handle scoped packages correctly', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            '@typescript-eslint/parser': '^8.0.0',
          },
        })
      );
      mockNodeModulesExists('@typescript-eslint/parser', true);

      const result = isPackageInstalled(testDir, '@typescript-eslint/parser');

      expect(result).toBe(true);
      expect(existsSyncSpy).toHaveBeenCalledWith(
        path.join(testDir, 'node_modules', '@typescript-eslint/parser')
      );
    });

    it('should check both dependencies and devDependencies', () => {
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            react: '^18.0.0',
          },
          devDependencies: {
            eslint: '^9.0.0',
          },
        })
      );
      mockNodeModulesExists('eslint', true);

      const result = isPackageInstalled(testDir, 'eslint');

      expect(result).toBe(true);
    });
  });

  describe('npm workspaces support', () => {
    const workspaceRoot = path.join(projectDir, 'workspace');
    const pkg1Dir = path.join(workspaceRoot, 'packages', 'pkg-a');
    const pkg2Dir = path.join(workspaceRoot, 'packages', 'pkg-b');
    const standaloneDir = path.join(projectDir, 'standalone');

    function mockWorkspaceSetup(
      workspaceRootPath: string,
      workspacePatterns: string[],
      packageDirs: string[]
    ): void {
      const allPackageJsons = [
        path.join(workspaceRootPath, 'package.json'),
        ...packageDirs.map(d => path.join(d, 'package.json')),
      ];

      mockedWalk.mockResolvedValue(allPackageJsons);

      mockedFs.readFileSync.mockImplementation(filePath => {
        const pathStr = filePath.toString();
        if (pathStr === path.join(workspaceRootPath, 'package.json')) {
          return JSON.stringify({
            name: 'workspace-root',
            workspaces: workspacePatterns,
          });
        }
        // Default package.json for workspace members
        return JSON.stringify({
          name: path.basename(path.dirname(pathStr)),
        });
      });
    }

    describe('installPackages()', () => {
      describe('workspace detection', () => {
        it('should return workspace root when directory matches workspace pattern', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);

          await installPackages({
            packages: ['lodash'],
            installLocations: [pkg1Dir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith(
            `npm install --workspace=packages/pkg-a lodash`,
            { cwd: workspaceRoot }
          );
        });

        it('should handle packages without workspaces field as non-workspace', async () => {
          mockedWalk.mockResolvedValue([
            path.join(standaloneDir, 'package.json'),
          ]);
          mockedFs.readFileSync.mockReturnValue(
            JSON.stringify({ name: 'standalone' })
          );

          await installPackages({
            packages: ['react'],
            installLocations: [standaloneDir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith('npm install react', {
            cwd: standaloneDir,
          });
        });

        it('should handle empty workspaces array as non-workspace', async () => {
          mockedWalk.mockResolvedValue([
            path.join(workspaceRoot, 'package.json'),
          ]);
          mockedFs.readFileSync.mockReturnValue(
            JSON.stringify({
              name: 'workspace-root',
              workspaces: [],
            })
          );

          await installPackages({
            packages: ['test'],
            installLocations: [workspaceRoot],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith('npm install test', {
            cwd: workspaceRoot,
          });
        });

        it('should match nested glob patterns like packages/**/*', async () => {
          const nestedDir = path.join(
            workspaceRoot,
            'packages',
            'frontend',
            'ui'
          );
          mockWorkspaceSetup(workspaceRoot, ['packages/**/*'], [nestedDir]);

          await installPackages({
            packages: ['axios'],
            installLocations: [nestedDir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith(
            `npm install --workspace=packages/frontend/ui axios`,
            { cwd: workspaceRoot }
          );
        });

        it('should match against multiple workspace patterns', async () => {
          const appsDir = path.join(workspaceRoot, 'apps', 'web');
          mockWorkspaceSetup(
            workspaceRoot,
            ['packages/*', 'apps/*'],
            [pkg1Dir, appsDir]
          );

          await installPackages({
            packages: ['typescript'],
            installLocations: [pkg1Dir, appsDir],
          });

          expect(execMock).toHaveBeenCalledTimes(2);
          expect(execMock).toHaveBeenCalledWith(
            `npm install --workspace=packages/pkg-a typescript`,
            { cwd: workspaceRoot }
          );
          expect(execMock).toHaveBeenCalledWith(
            `npm install --workspace=apps/web typescript`,
            { cwd: workspaceRoot }
          );
        });

        it('should return null when directory does not match workspace patterns', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], []);
          mockedWalk.mockResolvedValue([
            path.join(workspaceRoot, 'package.json'),
            path.join(standaloneDir, 'package.json'),
          ]);
          mockedFs.readFileSync.mockImplementation(filePath => {
            const pathStr = filePath.toString();
            if (pathStr === path.join(workspaceRoot, 'package.json')) {
              return JSON.stringify({
                name: 'workspace',
                workspaces: ['packages/*'],
              });
            }
            return JSON.stringify({ name: 'standalone' });
          });

          await installPackages({
            packages: ['test'],
            installLocations: [standaloneDir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith('npm install test', {
            cwd: standaloneDir,
          });
        });
      });

      describe('installation behavior without specific packages', () => {
        it('should install at workspace root when no packages and directory is in workspace', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir, pkg2Dir]);

          await installPackages({
            installLocations: [pkg1Dir, pkg2Dir],
          });

          // Should install once at workspace root
          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith('npm install ', {
            cwd: workspaceRoot,
          });
        });

        it('should install in each directory when not in workspace', async () => {
          const dir1 = path.join(projectDir, 'dir1');
          const dir2 = path.join(projectDir, 'dir2');
          mockedWalk.mockResolvedValue([
            path.join(dir1, 'package.json'),
            path.join(dir2, 'package.json'),
          ]);
          mockedFs.readFileSync.mockReturnValue(
            JSON.stringify({ name: 'standalone' })
          );

          await installPackages({
            installLocations: [dir1, dir2],
          });

          expect(execMock).toHaveBeenCalledTimes(2);
          expect(execMock).toHaveBeenCalledWith('npm install ', { cwd: dir1 });
          expect(execMock).toHaveBeenCalledWith('npm install ', { cwd: dir2 });
        });

        it('should install at workspace roots and non-workspace directories', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);
          mockedWalk.mockResolvedValue([
            path.join(workspaceRoot, 'package.json'),
            path.join(pkg1Dir, 'package.json'),
            path.join(standaloneDir, 'package.json'),
          ]);
          mockedFs.readFileSync.mockImplementation(filePath => {
            const pathStr = filePath.toString();
            if (pathStr === path.join(workspaceRoot, 'package.json')) {
              return JSON.stringify({
                name: 'workspace',
                workspaces: ['packages/*'],
              });
            }
            return JSON.stringify({ name: 'pkg' });
          });

          await installPackages({
            installLocations: [pkg1Dir, standaloneDir],
          });

          expect(execMock).toHaveBeenCalledTimes(2);
          expect(execMock).toHaveBeenCalledWith('npm install ', {
            cwd: workspaceRoot,
          });
          expect(execMock).toHaveBeenCalledWith('npm install ', {
            cwd: standaloneDir,
          });
        });
      });

      describe('installation behavior with specific packages', () => {
        it('should use --workspace flag when installing packages in workspace', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);

          await installPackages({
            packages: ['lodash', 'axios'],
            installLocations: [pkg1Dir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith(
            `npm install --workspace=packages/pkg-a lodash axios`,
            { cwd: workspaceRoot }
          );
        });

        it('should install packages normally in non-workspace directories', async () => {
          mockedWalk.mockResolvedValue([
            path.join(standaloneDir, 'package.json'),
          ]);
          mockedFs.readFileSync.mockReturnValue(
            JSON.stringify({ name: 'standalone' })
          );

          await installPackages({
            packages: ['react', 'react-dom'],
            installLocations: [standaloneDir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith('npm install react react-dom', {
            cwd: standaloneDir,
          });
        });

        it('should handle multiple workspace packages with separate commands', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir, pkg2Dir]);

          await installPackages({
            packages: ['typescript'],
            installLocations: [pkg1Dir, pkg2Dir],
          });

          expect(execMock).toHaveBeenCalledTimes(2);
          expect(execMock).toHaveBeenCalledWith(
            `npm install --workspace=packages/pkg-a typescript`,
            { cwd: workspaceRoot }
          );
          expect(execMock).toHaveBeenCalledWith(
            `npm install --workspace=packages/pkg-b typescript`,
            { cwd: workspaceRoot }
          );
        });

        it('should handle mixed workspace and non-workspace installations', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);
          mockedWalk.mockResolvedValue([
            path.join(workspaceRoot, 'package.json'),
            path.join(pkg1Dir, 'package.json'),
            path.join(standaloneDir, 'package.json'),
          ]);
          mockedFs.readFileSync.mockImplementation(filePath => {
            const pathStr = filePath.toString();
            if (pathStr === path.join(workspaceRoot, 'package.json')) {
              return JSON.stringify({
                name: 'workspace',
                workspaces: ['packages/*'],
              });
            }
            return JSON.stringify({ name: 'pkg' });
          });

          await installPackages({
            packages: ['lodash'],
            installLocations: [pkg1Dir, standaloneDir],
          });

          expect(execMock).toHaveBeenCalledTimes(2);
          expect(execMock).toHaveBeenCalledWith(
            `npm install --workspace=packages/pkg-a lodash`,
            { cwd: workspaceRoot }
          );
          expect(execMock).toHaveBeenCalledWith('npm install lodash', {
            cwd: standaloneDir,
          });
        });
      });

      describe('command construction', () => {
        it('should combine --save-dev and --workspace flags correctly', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);

          await installPackages({
            packages: ['eslint', 'prettier'],
            installLocations: [pkg1Dir],
            dev: true,
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith(
            `npm install --save-dev --workspace=packages/pkg-a eslint prettier`,
            { cwd: workspaceRoot }
          );
        });

        it('should not use --save-dev flag when dev is true but no packages provided', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);

          await installPackages({
            installLocations: [pkg1Dir],
            dev: true,
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith('npm install ', {
            cwd: workspaceRoot,
          });
        });

        it('should execute npm commands in workspace root directory for workspace packages', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);

          await installPackages({
            packages: ['test'],
            installLocations: [pkg1Dir],
          });

          expect(execMock).toHaveBeenCalledWith(expect.any(String), {
            cwd: workspaceRoot,
          });
        });

        it('should execute npm commands in package directory for non-workspace packages', async () => {
          mockedWalk.mockResolvedValue([
            path.join(standaloneDir, 'package.json'),
          ]);
          mockedFs.readFileSync.mockReturnValue(
            JSON.stringify({ name: 'standalone' })
          );

          await installPackages({
            packages: ['test'],
            installLocations: [standaloneDir],
          });

          expect(execMock).toHaveBeenCalledWith(expect.any(String), {
            cwd: standaloneDir,
          });
        });
      });

      describe('edge cases', () => {
        it('should correctly calculate relative paths for deeply nested packages', async () => {
          const deeplyNestedDir = path.join(
            workspaceRoot,
            'packages',
            'frontend',
            'components',
            'ui'
          );
          mockWorkspaceSetup(
            workspaceRoot,
            ['packages/**/*'],
            [deeplyNestedDir]
          );

          await installPackages({
            packages: ['test'],
            installLocations: [deeplyNestedDir],
          });

          expect(execMock).toHaveBeenCalledWith(
            `npm install --workspace=packages/frontend/components/ui test`,
            { cwd: workspaceRoot }
          );
        });

        it('should handle invalid package.json gracefully', async () => {
          mockedWalk.mockResolvedValue([
            path.join(workspaceRoot, 'package.json'),
          ]);
          mockedFs.readFileSync.mockReturnValue('invalid json{');

          await installPackages({
            packages: ['test'],
            installLocations: [workspaceRoot],
          });

          // Should treat as non-workspace since parsing fails
          expect(execMock).toHaveBeenCalledWith('npm install test', {
            cwd: workspaceRoot,
          });
        });

        it('should show spinner for package directory not workspace root', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);

          await installPackages({
            packages: ['lodash'],
            installLocations: [pkg1Dir],
          });

          expect(SpinniesManager.add).toHaveBeenCalledWith(
            `installingDependencies-${pkg1Dir}`,
            expect.objectContaining({
              text: expect.stringContaining(
                path.relative(process.cwd(), pkg1Dir)
              ),
            })
          );

          expect(SpinniesManager.succeed).toHaveBeenCalledWith(
            `installingDependencies-${pkg1Dir}`,
            expect.any(Object)
          );
        });

        it('should report errors with correct directory even when using workspace root', async () => {
          execMock = vi.fn().mockImplementation(() => {
            throw new Error('Installation failed');
          });
          util.promisify = mockedPromisify(execMock);

          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);
          mockedFs.existsSync.mockReturnValue(true);

          await expect(
            installPackages({
              packages: ['test'],
              installLocations: [pkg1Dir],
            })
          ).rejects.toThrowError();

          expect(SpinniesManager.fail).toHaveBeenCalledWith(
            `installingDependencies-${pkg1Dir}`,
            expect.any(Object)
          );
        });
      });
    });

    describe('updatePackages()', () => {
      describe('workspace detection', () => {
        it('should return workspace root when directory matches workspace pattern', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);

          await updatePackages({
            packages: ['lodash'],
            installLocations: [pkg1Dir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith(
            `npm update --workspace=packages/pkg-a lodash`,
            { cwd: workspaceRoot }
          );
        });

        it('should handle packages without workspaces field as non-workspace', async () => {
          mockedWalk.mockResolvedValue([
            path.join(standaloneDir, 'package.json'),
          ]);
          mockedFs.readFileSync.mockReturnValue(
            JSON.stringify({ name: 'standalone' })
          );

          await updatePackages({
            packages: ['react'],
            installLocations: [standaloneDir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith('npm update react', {
            cwd: standaloneDir,
          });
        });

        it('should handle empty workspaces array as non-workspace', async () => {
          mockedWalk.mockResolvedValue([
            path.join(workspaceRoot, 'package.json'),
          ]);
          mockedFs.readFileSync.mockReturnValue(
            JSON.stringify({
              name: 'workspace-root',
              workspaces: [],
            })
          );

          await updatePackages({
            packages: ['test'],
            installLocations: [workspaceRoot],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith('npm update test', {
            cwd: workspaceRoot,
          });
        });

        it('should match nested glob patterns like packages/**/*', async () => {
          const nestedDir = path.join(
            workspaceRoot,
            'packages',
            'frontend',
            'ui'
          );
          mockWorkspaceSetup(workspaceRoot, ['packages/**/*'], [nestedDir]);

          await updatePackages({
            packages: ['axios'],
            installLocations: [nestedDir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith(
            `npm update --workspace=packages/frontend/ui axios`,
            { cwd: workspaceRoot }
          );
        });

        it('should match against multiple workspace patterns', async () => {
          const appsDir = path.join(workspaceRoot, 'apps', 'web');
          mockWorkspaceSetup(
            workspaceRoot,
            ['packages/*', 'apps/*'],
            [pkg1Dir, appsDir]
          );

          await updatePackages({
            packages: ['typescript'],
            installLocations: [pkg1Dir, appsDir],
          });

          expect(execMock).toHaveBeenCalledTimes(2);
          expect(execMock).toHaveBeenCalledWith(
            `npm update --workspace=packages/pkg-a typescript`,
            { cwd: workspaceRoot }
          );
          expect(execMock).toHaveBeenCalledWith(
            `npm update --workspace=apps/web typescript`,
            { cwd: workspaceRoot }
          );
        });

        it('should return null when directory does not match workspace patterns', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], []);
          mockedWalk.mockResolvedValue([
            path.join(workspaceRoot, 'package.json'),
            path.join(standaloneDir, 'package.json'),
          ]);
          mockedFs.readFileSync.mockImplementation(filePath => {
            const pathStr = filePath.toString();
            if (pathStr === path.join(workspaceRoot, 'package.json')) {
              return JSON.stringify({
                name: 'workspace',
                workspaces: ['packages/*'],
              });
            }
            return JSON.stringify({ name: 'standalone' });
          });

          await updatePackages({
            packages: ['test'],
            installLocations: [standaloneDir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith('npm update test', {
            cwd: standaloneDir,
          });
        });
      });

      describe('update behavior without specific packages', () => {
        it('should update at workspace root when no packages and directory is in workspace', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir, pkg2Dir]);

          await updatePackages({
            installLocations: [pkg1Dir, pkg2Dir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith('npm update ', {
            cwd: workspaceRoot,
          });
        });

        it('should update in each directory when not in workspace', async () => {
          const dir1 = path.join(projectDir, 'dir1');
          const dir2 = path.join(projectDir, 'dir2');
          mockedWalk.mockResolvedValue([
            path.join(dir1, 'package.json'),
            path.join(dir2, 'package.json'),
          ]);
          mockedFs.readFileSync.mockReturnValue(
            JSON.stringify({ name: 'standalone' })
          );

          await updatePackages({
            installLocations: [dir1, dir2],
          });

          expect(execMock).toHaveBeenCalledTimes(2);
          expect(execMock).toHaveBeenCalledWith('npm update ', { cwd: dir1 });
          expect(execMock).toHaveBeenCalledWith('npm update ', { cwd: dir2 });
        });

        it('should update at workspace roots and non-workspace directories', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);
          mockedWalk.mockResolvedValue([
            path.join(workspaceRoot, 'package.json'),
            path.join(pkg1Dir, 'package.json'),
            path.join(standaloneDir, 'package.json'),
          ]);
          mockedFs.readFileSync.mockImplementation(filePath => {
            const pathStr = filePath.toString();
            if (pathStr === path.join(workspaceRoot, 'package.json')) {
              return JSON.stringify({
                name: 'workspace',
                workspaces: ['packages/*'],
              });
            }
            return JSON.stringify({ name: 'pkg' });
          });

          await updatePackages({
            installLocations: [pkg1Dir, standaloneDir],
          });

          expect(execMock).toHaveBeenCalledTimes(2);
          expect(execMock).toHaveBeenCalledWith('npm update ', {
            cwd: workspaceRoot,
          });
          expect(execMock).toHaveBeenCalledWith('npm update ', {
            cwd: standaloneDir,
          });
        });
      });

      describe('update behavior with specific packages', () => {
        it('should use --workspace flag when updating packages in workspace', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);

          await updatePackages({
            packages: ['lodash', 'axios'],
            installLocations: [pkg1Dir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith(
            `npm update --workspace=packages/pkg-a lodash axios`,
            { cwd: workspaceRoot }
          );
        });

        it('should update packages normally in non-workspace directories', async () => {
          mockedWalk.mockResolvedValue([
            path.join(standaloneDir, 'package.json'),
          ]);
          mockedFs.readFileSync.mockReturnValue(
            JSON.stringify({ name: 'standalone' })
          );

          await updatePackages({
            packages: ['react', 'react-dom'],
            installLocations: [standaloneDir],
          });

          expect(execMock).toHaveBeenCalledTimes(1);
          expect(execMock).toHaveBeenCalledWith('npm update react react-dom', {
            cwd: standaloneDir,
          });
        });

        it('should handle multiple workspace packages with separate commands', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir, pkg2Dir]);

          await updatePackages({
            packages: ['typescript'],
            installLocations: [pkg1Dir, pkg2Dir],
          });

          expect(execMock).toHaveBeenCalledTimes(2);
          expect(execMock).toHaveBeenCalledWith(
            `npm update --workspace=packages/pkg-a typescript`,
            { cwd: workspaceRoot }
          );
          expect(execMock).toHaveBeenCalledWith(
            `npm update --workspace=packages/pkg-b typescript`,
            { cwd: workspaceRoot }
          );
        });

        it('should handle mixed workspace and non-workspace updates', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);
          mockedWalk.mockResolvedValue([
            path.join(workspaceRoot, 'package.json'),
            path.join(pkg1Dir, 'package.json'),
            path.join(standaloneDir, 'package.json'),
          ]);
          mockedFs.readFileSync.mockImplementation(filePath => {
            const pathStr = filePath.toString();
            if (pathStr === path.join(workspaceRoot, 'package.json')) {
              return JSON.stringify({
                name: 'workspace',
                workspaces: ['packages/*'],
              });
            }
            return JSON.stringify({ name: 'pkg' });
          });

          await updatePackages({
            packages: ['lodash'],
            installLocations: [pkg1Dir, standaloneDir],
          });

          expect(execMock).toHaveBeenCalledTimes(2);
          expect(execMock).toHaveBeenCalledWith(
            `npm update --workspace=packages/pkg-a lodash`,
            { cwd: workspaceRoot }
          );
          expect(execMock).toHaveBeenCalledWith('npm update lodash', {
            cwd: standaloneDir,
          });
        });
      });

      describe('command construction', () => {
        it('should execute npm commands in workspace root directory for workspace packages', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);

          await updatePackages({
            packages: ['test'],
            installLocations: [pkg1Dir],
          });

          expect(execMock).toHaveBeenCalledWith(expect.any(String), {
            cwd: workspaceRoot,
          });
        });

        it('should execute npm commands in package directory for non-workspace packages', async () => {
          mockedWalk.mockResolvedValue([
            path.join(standaloneDir, 'package.json'),
          ]);
          mockedFs.readFileSync.mockReturnValue(
            JSON.stringify({ name: 'standalone' })
          );

          await updatePackages({
            packages: ['test'],
            installLocations: [standaloneDir],
          });

          expect(execMock).toHaveBeenCalledWith(expect.any(String), {
            cwd: standaloneDir,
          });
        });
      });

      describe('edge cases', () => {
        it('should correctly calculate relative paths for deeply nested packages', async () => {
          const deeplyNestedDir = path.join(
            workspaceRoot,
            'packages',
            'frontend',
            'components',
            'ui'
          );
          mockWorkspaceSetup(
            workspaceRoot,
            ['packages/**/*'],
            [deeplyNestedDir]
          );

          await updatePackages({
            packages: ['test'],
            installLocations: [deeplyNestedDir],
          });

          expect(execMock).toHaveBeenCalledWith(
            `npm update --workspace=packages/frontend/components/ui test`,
            { cwd: workspaceRoot }
          );
        });

        it('should handle invalid package.json gracefully', async () => {
          mockedWalk.mockResolvedValue([
            path.join(workspaceRoot, 'package.json'),
          ]);
          mockedFs.readFileSync.mockReturnValue('invalid json{');

          await updatePackages({
            packages: ['test'],
            installLocations: [workspaceRoot],
          });

          expect(execMock).toHaveBeenCalledWith('npm update test', {
            cwd: workspaceRoot,
          });
        });

        it('should show spinner for package directory not workspace root', async () => {
          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);

          await updatePackages({
            packages: ['lodash'],
            installLocations: [pkg1Dir],
          });

          expect(SpinniesManager.add).toHaveBeenCalledWith(
            `updatingDependencies-${pkg1Dir}`,
            expect.objectContaining({
              text: expect.stringContaining(
                path.relative(process.cwd(), pkg1Dir)
              ),
            })
          );

          expect(SpinniesManager.succeed).toHaveBeenCalledWith(
            `updatingDependencies-${pkg1Dir}`,
            expect.any(Object)
          );
        });

        it('should report errors with correct directory even when using workspace root', async () => {
          execMock = vi.fn().mockImplementation(() => {
            throw new Error('Update failed');
          });
          util.promisify = mockedPromisify(execMock);

          mockWorkspaceSetup(workspaceRoot, ['packages/*'], [pkg1Dir]);
          mockedFs.existsSync.mockReturnValue(true);

          await expect(
            updatePackages({
              packages: ['test'],
              installLocations: [pkg1Dir],
            })
          ).rejects.toThrowError();

          expect(SpinniesManager.fail).toHaveBeenCalledWith(
            `updatingDependencies-${pkg1Dir}`,
            expect.any(Object)
          );
        });
      });
    });
  });
});
