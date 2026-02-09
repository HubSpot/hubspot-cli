import fs from 'fs';
import path from 'path';
import util from 'util';
import { uiLogger } from '../../ui/logger.js';
import * as dependencyManagement from '../../dependencyManagement.js';
import {
  isEslintInstalled,
  areAllLintPackagesInstalled,
  getMissingLintPackages,
  lintPackages,
  lintPackagesInDirectory,
  displayLintResults,
  hasEslintConfig,
  hasDeprecatedEslintConfig,
  getDeprecatedEslintConfigFiles,
  createEslintConfig,
} from '../uieLinting.js';
import { clearPackageJsonCache } from '../../npm/packageJson.js';

vi.mock('fs');
vi.mock('../../dependencyManagement.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../dependencyManagement.js')
  >('../../dependencyManagement.js');
  return {
    ...actual,
    getProjectPackageJsonLocations: vi.fn(),
  };
});
vi.mock('node:child_process');
vi.mock('util');

const readFileSyncSpy = vi.spyOn(fs, 'readFileSync');
const existsSyncSpy = vi.spyOn(fs, 'existsSync');
const getProjectPackageJsonLocationsSpy = vi.spyOn(
  dependencyManagement,
  'getProjectPackageJsonLocations'
);

// Mock exec function
const mockExec = vi.fn();
vi.mocked(util.promisify).mockReturnValue(
  mockExec as ReturnType<typeof util.promisify>
);

describe('lib/linting', () => {
  afterEach(() => {
    clearPackageJsonCache();
  });

  describe('isEslintInstalled', () => {
    it('should return true if eslint is in package.json and node_modules', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            eslint: '^8.0.0',
          },
        })
      );
      existsSyncSpy.mockReturnValueOnce(true);

      const result = isEslintInstalled(directory);

      expect(result).toBe(true);
      expect(existsSyncSpy).toHaveBeenCalledWith(
        path.join(directory, 'node_modules', 'eslint')
      );
    });

    it('should return false if eslint is in package.json but not in node_modules', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            eslint: '^8.0.0',
          },
        })
      );
      existsSyncSpy.mockReturnValueOnce(false);

      const result = isEslintInstalled(directory);

      expect(result).toBe(false);
    });

    it('should return false if eslint is not in package.json', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            typescript: '^5.0.0',
          },
        })
      );
      existsSyncSpy.mockReturnValueOnce(false);

      const result = isEslintInstalled(directory);

      expect(result).toBe(false);
    });

    it('should return false if eslint is only in node_modules (no package.json entry)', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            typescript: '^5.0.0',
          },
        })
      );
      existsSyncSpy.mockReturnValueOnce(true);

      const result = isEslintInstalled(directory);

      expect(result).toBe(false);
    });

    it('should return true if eslint is in both node_modules and package.json', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          devDependencies: {
            eslint: '^9.0.0',
          },
        })
      );
      existsSyncSpy.mockReturnValueOnce(true);

      const result = isEslintInstalled(directory);

      expect(result).toBe(true);
    });
  });

  describe('areAllLintPackagesInstalled', () => {
    it('should return true if all packages are installed', () => {
      const directory = '/test/project/component1';
      const packageJson = JSON.stringify({
        devDependencies: {
          eslint: '^9.0.0',
          '@typescript-eslint/eslint-plugin': '^8.46.4',
          '@typescript-eslint/parser': '^8.46.4',
          'typescript-eslint': '^8.46.4',
          jiti: '^2.6.1',
        },
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(() => true);

      const result = areAllLintPackagesInstalled(directory);

      expect(result).toBe(true);
    });

    it('should return false if eslint is missing', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockImplementation(() =>
        JSON.stringify({ dependencies: {} })
      );
      existsSyncSpy.mockImplementation(() => false);

      const result = areAllLintPackagesInstalled(directory);

      expect(result).toBe(false);
    });

    it('should return false if @typescript-eslint/eslint-plugin is missing', () => {
      const directory = '/test/project/component1';
      const packageJson = JSON.stringify({
        devDependencies: {
          eslint: '^9.0.0',
          '@typescript-eslint/parser': '^8.46.4',
          // @typescript-eslint/eslint-plugin is missing
        },
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(path => {
        // Only @typescript-eslint/eslint-plugin is missing from node_modules
        return !String(path).includes('@typescript-eslint/eslint-plugin');
      });

      const result = areAllLintPackagesInstalled(directory);

      expect(result).toBe(false);
    });

    it('should return false if @typescript-eslint/parser is missing', () => {
      const directory = '/test/project/component1';
      const packageJson = JSON.stringify({
        devDependencies: {
          eslint: '^9.0.0',
          '@typescript-eslint/eslint-plugin': '^8.46.4',
          // @typescript-eslint/parser is missing
        },
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(path => {
        // Only @typescript-eslint/parser is missing from node_modules
        return !String(path).includes('@typescript-eslint/parser');
      });

      const result = areAllLintPackagesInstalled(directory);

      expect(result).toBe(false);
    });

    it('should return false if typescript-eslint is missing', () => {
      const directory = '/test/project/component1';
      const packageJson = JSON.stringify({
        devDependencies: {
          eslint: '^9.0.0',
          '@typescript-eslint/eslint-plugin': '^8.46.4',
          '@typescript-eslint/parser': '^8.46.4',
          // typescript-eslint is missing
        },
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(path => {
        // Only typescript-eslint is missing from node_modules
        return !String(path).includes('typescript-eslint');
      });

      const result = areAllLintPackagesInstalled(directory);

      expect(result).toBe(false);
    });

    it('should return false if jiti is missing', () => {
      const directory = '/test/project/component1';
      const packageJson = JSON.stringify({
        devDependencies: {
          eslint: '^9.0.0',
          '@typescript-eslint/eslint-plugin': '^8.46.4',
          '@typescript-eslint/parser': '^8.46.4',
          'typescript-eslint': '^8.46.4',
          // jiti is missing
        },
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(path => {
        // Only jiti is missing from node_modules
        return !String(path).includes('jiti');
      });

      const result = areAllLintPackagesInstalled(directory);

      expect(result).toBe(false);
    });
  });

  describe('getMissingLintPackages', () => {
    it('should return empty array if all packages are installed with correct versions', () => {
      const directory = '/test/project/component1';
      const packageJson = JSON.stringify({
        devDependencies: {
          eslint: '^9.0.0',
          '@typescript-eslint/eslint-plugin': '^8.46.4',
          '@typescript-eslint/parser': '^8.46.4',
          'typescript-eslint': '^8.46.4',
          jiti: '^2.6.1',
        },
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(() => true);

      const result = getMissingLintPackages(directory);

      expect(result).toEqual({
        missingPackages: [],
      });
    });

    it('should return packages that are in package.json but not installed', () => {
      const directory = '/test/project/component1';
      const packageJson = JSON.stringify({
        devDependencies: {
          eslint: '^9.0.0',
          '@typescript-eslint/eslint-plugin': '^8.46.4',
          '@typescript-eslint/parser': '^8.46.4',
          'typescript-eslint': '^8.46.4',
          jiti: '^2.6.1',
        },
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(() => false);

      const result = getMissingLintPackages(directory);

      expect(result).toEqual({
        missingPackages: [
          'eslint',
          '@typescript-eslint/eslint-plugin',
          '@typescript-eslint/parser',
          'typescript-eslint',
          'jiti',
        ],
      });
    });

    it('should return packages that are not in package.json', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValue(JSON.stringify({ dependencies: {} }));
      existsSyncSpy.mockReturnValue(false);

      const result = getMissingLintPackages(directory);

      expect(result).toEqual({
        missingPackages: [
          'eslint',
          '@typescript-eslint/eslint-plugin',
          '@typescript-eslint/parser',
          'typescript-eslint',
          'jiti',
        ],
      });
    });

    it('should return packages that are missing in mixed scenarios', () => {
      const directory = '/test/project/component1';
      let readCount = 0;
      readFileSyncSpy.mockImplementation(() => {
        readCount++;
        if (readCount === 1) {
          // eslint in package.json
          return JSON.stringify({ devDependencies: { eslint: '^9.0.0' } });
        }
        // Others not in package.json
        return JSON.stringify({ dependencies: {} });
      });

      existsSyncSpy.mockReturnValue(false);

      const result = getMissingLintPackages(directory);

      expect(result).toEqual({
        missingPackages: [
          'eslint',
          '@typescript-eslint/eslint-plugin',
          '@typescript-eslint/parser',
          'typescript-eslint',
          'jiti',
        ],
      });
    });

    it('should return packages that are in node_modules but not in package.json', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValue(JSON.stringify({ dependencies: {} }));
      existsSyncSpy.mockReturnValue(true);

      const result = getMissingLintPackages(directory);

      expect(result).toEqual({
        missingPackages: [
          'eslint',
          '@typescript-eslint/eslint-plugin',
          '@typescript-eslint/parser',
          'typescript-eslint',
          'jiti',
        ],
      });
    });

    it('should return packages that have versions below minimum', () => {
      const directory = '/test/project/component1';
      const packageJson = JSON.stringify({
        devDependencies: {
          eslint: '^8.0.0',
          '@typescript-eslint/eslint-plugin': '^7.0.0',
          '@typescript-eslint/parser': '^8.0.0',
          'typescript-eslint': '^8.0.0',
          jiti: '^2.0.0',
        },
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(() => true);

      const result = getMissingLintPackages(directory);

      expect(result).toEqual({
        missingPackages: [
          'eslint',
          '@typescript-eslint/eslint-plugin',
          '@typescript-eslint/parser',
          'typescript-eslint',
          'jiti',
        ],
      });
    });

    it('should return only packages with wrong versions when others are correct', () => {
      const directory = '/test/project/component1';
      const packageJson = JSON.stringify({
        devDependencies: {
          eslint: '^8.0.0',
          '@typescript-eslint/eslint-plugin': '^8.46.4',
          '@typescript-eslint/parser': '^8.46.4',
          'typescript-eslint': '^8.46.4',
          jiti: '^2.6.1',
        },
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(() => true);

      const result = getMissingLintPackages(directory);

      expect(result).toEqual({
        missingPackages: ['eslint'],
      });
    });
  });

  describe('hasEslintConfig', () => {
    it('should return true if eslint.config.mts exists', () => {
      const directory = '/test/project/component1';
      existsSyncSpy.mockReturnValueOnce(true);

      const result = hasEslintConfig(directory);

      expect(result).toBe(true);
    });

    it('should return true if eslint.config.ts exists', () => {
      const directory = '/test/project/component1';
      existsSyncSpy
        .mockReturnValueOnce(false) // eslint.config.mts
        .mockReturnValueOnce(true); // eslint.config.ts

      const result = hasEslintConfig(directory);

      expect(result).toBe(true);
    });

    it('should return true if eslint.config.cts exists', () => {
      const directory = '/test/project/component1';
      existsSyncSpy
        .mockReturnValueOnce(false) // eslint.config.mts
        .mockReturnValueOnce(false) // eslint.config.ts
        .mockReturnValueOnce(true); // eslint.config.cts

      const result = hasEslintConfig(directory);

      expect(result).toBe(true);
    });

    it('should return true if eslint.config.js exists', () => {
      const directory = '/test/project/component1';
      existsSyncSpy
        .mockReturnValueOnce(false) // eslint.config.mts
        .mockReturnValueOnce(false) // eslint.config.ts
        .mockReturnValueOnce(false) // eslint.config.cts
        .mockReturnValueOnce(true); // eslint.config.js

      const result = hasEslintConfig(directory);

      expect(result).toBe(true);
    });

    it('should return true if eslint.config.mjs exists', () => {
      const directory = '/test/project/component1';
      existsSyncSpy
        .mockReturnValueOnce(false) // eslint.config.mts
        .mockReturnValueOnce(false) // eslint.config.ts
        .mockReturnValueOnce(false) // eslint.config.cts
        .mockReturnValueOnce(false) // eslint.config.js
        .mockReturnValueOnce(true); // eslint.config.mjs

      const result = hasEslintConfig(directory);

      expect(result).toBe(true);
    });

    it('should return true if eslint.config.cjs exists', () => {
      const directory = '/test/project/component1';
      existsSyncSpy
        .mockReturnValueOnce(false) // eslint.config.mts
        .mockReturnValueOnce(false) // eslint.config.ts
        .mockReturnValueOnce(false) // eslint.config.cts
        .mockReturnValueOnce(false) // eslint.config.js
        .mockReturnValueOnce(false) // eslint.config.mjs
        .mockReturnValueOnce(true); // eslint.config.cjs

      const result = hasEslintConfig(directory);

      expect(result).toBe(true);
    });

    it('should return false if no modern config file exists', () => {
      const directory = '/test/project/component1';
      existsSyncSpy.mockReturnValue(false);

      const result = hasEslintConfig(directory);

      expect(result).toBe(false);
    });

    it('should return false if only deprecated config files exist', () => {
      const directory = '/test/project/component1';
      existsSyncSpy.mockReturnValue(false); // No modern config files

      const result = hasEslintConfig(directory);

      expect(result).toBe(false);
    });
  });

  describe('hasDeprecatedEslintConfig', () => {
    it('should return true if .eslintrc.js exists', () => {
      const directory = '/test/project/component1';
      existsSyncSpy.mockReturnValueOnce(true);

      const result = hasDeprecatedEslintConfig(directory);

      expect(result).toBe(true);
    });

    it('should return true if .eslintrc.json exists', () => {
      const directory = '/test/project/component1';
      existsSyncSpy
        .mockReturnValueOnce(false) // .eslintrc.js
        .mockReturnValueOnce(false) // .eslintrc.cjs
        .mockReturnValueOnce(false) // .eslintrc.yaml
        .mockReturnValueOnce(false) // .eslintrc.yml
        .mockReturnValueOnce(true); // .eslintrc.json

      const result = hasDeprecatedEslintConfig(directory);

      expect(result).toBe(true);
    });

    it('should return false if no deprecated config file exists', () => {
      const directory = '/test/project/component1';
      existsSyncSpy.mockReturnValue(false);

      const result = hasDeprecatedEslintConfig(directory);

      expect(result).toBe(false);
    });
  });

  describe('getDeprecatedEslintConfigFiles', () => {
    it('should return array of deprecated config files that exist', () => {
      const directory = '/test/project/component1';
      existsSyncSpy
        .mockReturnValueOnce(true) // .eslintrc.js
        .mockReturnValueOnce(false) // .eslintrc.cjs
        .mockReturnValueOnce(false) // .eslintrc.yaml
        .mockReturnValueOnce(false) // .eslintrc.yml
        .mockReturnValueOnce(true) // .eslintrc.json
        .mockReturnValueOnce(false); // .eslintrc

      const result = getDeprecatedEslintConfigFiles(directory);

      expect(result).toEqual(['.eslintrc.js', '.eslintrc.json']);
    });

    it('should return empty array if no deprecated config files exist', () => {
      const directory = '/test/project/component1';
      existsSyncSpy.mockReturnValue(false);

      const result = getDeprecatedEslintConfigFiles(directory);

      expect(result).toEqual([]);
    });
  });

  describe('createEslintConfig', () => {
    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync');

    it('should create eslint.config.mts with template content', () => {
      const directory = '/test/project/component1';

      const result = createEslintConfig(directory);

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join(directory, 'eslint.config.mts'),
        expect.stringContaining('@typescript-eslint/parser'),
        'utf-8'
      );
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join(directory, 'eslint.config.mts'),
        expect.stringContaining('"no-console": ["warn"'),
        'utf-8'
      );
      // Result is a relative path from process.cwd() to the config file
      expect(result).toContain('eslint.config.mts');
    });

    it('should log error if write fails', () => {
      const directory = '/test/project/component1';
      writeFileSyncSpy.mockImplementationOnce(() => {
        throw new Error('Write failed');
      });

      expect(() => createEslintConfig(directory)).toThrow();
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create ESLint configuration')
      );
    });
  });

  describe('lintPackagesInDirectory', () => {
    it('should execute eslint and return success with output', async () => {
      const directory = '/test/project/component1';
      mockExec.mockResolvedValueOnce({
        stdout: 'All files passed!',
        stderr: '',
      });

      const result = await lintPackagesInDirectory(directory);

      expect(mockExec).toHaveBeenCalledWith('npx eslint . --color', {
        cwd: directory,
        maxBuffer: 10 * 1024 * 1024,
      });
      expect(result.success).toBe(true);
      expect(result.output).toContain('/test/project/component1');
      expect(result.output).toContain('All files passed!');
    });

    it('should use relative path when projectDir is provided', async () => {
      const directory = '/test/project/component1';
      const projectDir = '/test/project';
      mockExec.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await lintPackagesInDirectory(directory, projectDir);

      expect(result.output).toContain('component1:');
      expect(result.output).toContain('No linting issues found.');
    });

    it('should return false and include errors in output when eslint fails', async () => {
      const directory = '/test/project/component1';
      const error = {
        stdout:
          'Error: Linting failed\n  /test/file.ts\n    1:1  error  Missing semicolon',
        stderr: '',
        code: 1,
      };
      mockExec.mockRejectedValueOnce(error);

      const result = await lintPackagesInDirectory(directory);

      expect(result.success).toBe(false);
      expect(result.output).toContain(error.stdout);
    });

    it('should handle errors with stderr', async () => {
      const directory = '/test/project/component1';
      const error = {
        stdout: '',
        stderr: 'ESLint configuration error',
        code: 2,
      };
      mockExec.mockRejectedValueOnce(error);

      const result = await lintPackagesInDirectory(directory);

      expect(result.success).toBe(false);
      expect(result.output).toContain(error.stderr);
    });
  });

  describe('lintPackages', () => {
    it('should return success true when all directories pass linting', async () => {
      const locations = [
        '/test/project/component1',
        '/test/project/component2',
      ];
      mockExec.mockResolvedValue({ stdout: '', stderr: '' });

      const result = await lintPackages(locations);

      expect(mockExec).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
    });

    it('should return success false when some directories fail', async () => {
      const locations = [
        '/test/project/component1',
        '/test/project/component2',
      ];
      const projectDir = '/test/project';

      mockExec
        .mockResolvedValueOnce({ stdout: '', stderr: '' }) // component1 passes
        .mockRejectedValueOnce({ stdout: 'errors', stderr: '', code: 1 }); // component2 fails

      const result = await lintPackages(locations, projectDir);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].location).toBe('component1');
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].location).toBe('component2');
      expect(result.results[1].success).toBe(false);
    });

    it('should handle multiple failures', async () => {
      const locations = [
        '/test/project/component1',
        '/test/project/component2',
        '/test/project/component3',
      ];
      const projectDir = '/test/project';

      mockExec
        .mockRejectedValueOnce({ stdout: 'errors', stderr: '', code: 1 })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockRejectedValueOnce({ stdout: 'errors', stderr: '', code: 1 });

      const result = await lintPackages(locations, projectDir);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(3);
      expect(result.results[0].success).toBe(false);
      expect(result.results[1].success).toBe(true);
      expect(result.results[2].success).toBe(false);
    });

    it('should get package.json locations if none provided', async () => {
      const locations = ['/test/project/component1'];
      getProjectPackageJsonLocationsSpy.mockResolvedValueOnce(locations);
      mockExec.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await lintPackages();

      expect(getProjectPackageJsonLocationsSpy).toHaveBeenCalledTimes(1);
      expect(mockExec).toHaveBeenCalledWith('npx eslint . --color', {
        cwd: locations[0],
        maxBuffer: 10 * 1024 * 1024,
      });
    });

    it('should handle empty locations array', async () => {
      const result = await lintPackages([]);

      expect(mockExec).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
    });
  });

  describe('displayLintResults', () => {
    it('should display output and summary for all passing results', () => {
      const results = [
        {
          location: 'component1',
          success: true,
          output: '\ncomponent1:\n  No linting issues found.\n',
        },
        {
          location: 'component2',
          success: true,
          output: '\ncomponent2:\n  No linting issues found.\n',
        },
      ];

      displayLintResults(results);

      expect(uiLogger.log).toHaveBeenCalledWith(results[0].output);
      expect(uiLogger.log).toHaveBeenCalledWith(results[1].output);
      expect(uiLogger.success).toHaveBeenCalledWith(
        'Linting passed in 2 directories:'
      );
      expect(uiLogger.log).toHaveBeenCalledWith('  ✓ component1');
      expect(uiLogger.log).toHaveBeenCalledWith('  ✓ component2');
    });

    it('should display output and summary with mixed results', () => {
      const results = [
        {
          location: 'component1',
          success: true,
          output: '\ncomponent1:\n  No linting issues found.\n',
        },
        {
          location: 'component2',
          success: false,
          output: '\ncomponent2:\n  Linting errors found.\n',
        },
      ];

      displayLintResults(results);

      expect(uiLogger.success).toHaveBeenCalledWith(
        'Linting passed in 1 directory:'
      );
      expect(uiLogger.log).toHaveBeenCalledWith('  ✓ component1');
      expect(uiLogger.error).toHaveBeenCalledWith(
        'Linting failed in 1 directory:'
      );
      expect(uiLogger.log).toHaveBeenCalledWith('  ✗ component2');
    });

    it('should display only failures when all fail', () => {
      const results = [
        {
          location: 'component1',
          success: false,
          output: '\ncomponent1:\n  Errors.\n',
        },
        {
          location: 'component2',
          success: false,
          output: '\ncomponent2:\n  Errors.\n',
        },
      ];

      displayLintResults(results);

      expect(uiLogger.error).toHaveBeenCalledWith(
        'Linting failed in 2 directories:'
      );
      expect(uiLogger.log).toHaveBeenCalledWith('  ✗ component1');
      expect(uiLogger.log).toHaveBeenCalledWith('  ✗ component2');
    });
  });
});
