import fs from 'fs';
import path from 'path';
import util from 'util';
import { fetchRepoFile } from '@hubspot/local-dev-lib/api/github';
import {
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
} from '../../constants.js';
import { uiLogger } from '../../ui/logger.js';
import * as dependencyManagement from '../../dependencyManagement.js';
import {
  isEslintInstalled,
  areAllLintPackagesInstalled,
  getMissingLintPackages,
  getMissingLintScripts,
  addLintScriptsToPackageJson,
  lintPackages,
  lintPackagesInDirectory,
  displayLintResults,
  hasEslintConfig,
  hasDeprecatedEslintConfig,
  getDeprecatedEslintConfigFiles,
  createEslintConfig,
  REQUIRED_PACKAGES_AND_MIN_VERSIONS,
} from '../uieLinting.js';
import { clearPackageJsonCache } from '../../npm/packageJson.js';

vi.mock('fs');
vi.mock('@hubspot/local-dev-lib/api/github', () => ({
  fetchRepoFile: vi.fn(),
}));
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
const mockedFetchRepoFile = vi.mocked(fetchRepoFile);
const getProjectPackageJsonLocationsSpy = vi.spyOn(
  dependencyManagement,
  'getProjectPackageJsonLocations'
);

const fullLintDevDependencies = {
  eslint: '^9.0.0',
  '@eslint/js': '^9.0.0',
  'typescript-eslint': '^8.46.4',
  '@hubspot/eslint-config-ui-extensions': '^1.0.0',
  'eslint-config-prettier': '^10.0.0',
  'eslint-plugin-react': '^7.0.0',
  'eslint-plugin-react-hooks': '^7.0.0',
  'eslint-plugin-unused-imports': '^4.0.0',
  prettier: '^3.0.0',
  jiti: '^2.6.1',
} as const;

const allLintPackageNames = Object.keys(
  REQUIRED_PACKAGES_AND_MIN_VERSIONS
) as string[];

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
        devDependencies: { ...fullLintDevDependencies },
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

    it('should return false if @eslint/js is missing', () => {
      const directory = '/test/project/component1';
      const rest: Record<string, string> = { ...fullLintDevDependencies };
      delete rest['@eslint/js'];
      const packageJson = JSON.stringify({
        devDependencies: rest,
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(p => {
        const s = String(p);
        if (
          s.includes('node_modules/@eslint/js') ||
          s.includes('node_modules\\@eslint\\js')
        ) {
          return false;
        }
        return true;
      });

      const result = areAllLintPackagesInstalled(directory);

      expect(result).toBe(false);
    });

    it('should return false if typescript-eslint is missing', () => {
      const directory = '/test/project/component1';
      const rest: Record<string, string> = { ...fullLintDevDependencies };
      delete rest['typescript-eslint'];
      const packageJson = JSON.stringify({
        devDependencies: rest,
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(path => {
        return !String(path).includes('typescript-eslint');
      });

      const result = areAllLintPackagesInstalled(directory);

      expect(result).toBe(false);
    });

    it('should return false if jiti is missing', () => {
      const directory = '/test/project/component1';
      const rest: Record<string, string> = { ...fullLintDevDependencies };
      delete rest.jiti;
      const packageJson = JSON.stringify({
        devDependencies: rest,
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(path => {
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
        devDependencies: { ...fullLintDevDependencies },
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
        devDependencies: { ...fullLintDevDependencies },
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(() => false);

      const result = getMissingLintPackages(directory);

      expect(result).toEqual({
        missingPackages: allLintPackageNames,
      });
    });

    it('should return packages that are not in package.json', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValue(JSON.stringify({ dependencies: {} }));
      existsSyncSpy.mockReturnValue(false);

      const result = getMissingLintPackages(directory);

      expect(result).toEqual({
        missingPackages: allLintPackageNames,
      });
    });

    it('should return packages that are missing in mixed scenarios', () => {
      const directory = '/test/project/component1';
      let readCount = 0;
      readFileSyncSpy.mockImplementation(() => {
        readCount++;
        if (readCount === 1) {
          return JSON.stringify({ devDependencies: { eslint: '^9.0.0' } });
        }
        return JSON.stringify({ dependencies: {} });
      });

      existsSyncSpy.mockReturnValue(false);

      const result = getMissingLintPackages(directory);

      expect(result).toEqual({
        missingPackages: allLintPackageNames,
      });
    });

    it('should return packages that are in node_modules but not in package.json', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValue(JSON.stringify({ dependencies: {} }));
      existsSyncSpy.mockReturnValue(true);

      const result = getMissingLintPackages(directory);

      expect(result).toEqual({
        missingPackages: allLintPackageNames,
      });
    });

    it('should return packages that have versions below minimum', () => {
      const directory = '/test/project/component1';
      const packageJson = JSON.stringify({
        devDependencies: {
          eslint: '^8.0.0',
          '@eslint/js': '^8.0.0',
          'typescript-eslint': '^7.0.0',
          '@hubspot/eslint-config-ui-extensions': '^0.1.0',
          'eslint-config-prettier': '^9.0.0',
          'eslint-plugin-react': '^6.0.0',
          'eslint-plugin-react-hooks': '^5.0.0',
          'eslint-plugin-unused-imports': '^3.0.0',
          prettier: '^2.0.0',
          jiti: '^2.0.0',
        },
      });

      readFileSyncSpy.mockImplementation(() => packageJson);
      existsSyncSpy.mockImplementation(() => true);

      const result = getMissingLintPackages(directory);

      expect(result).toEqual({
        missingPackages: allLintPackageNames,
      });
    });

    it('should return only packages with wrong versions when others are correct', () => {
      const directory = '/test/project/component1';
      const packageJson = JSON.stringify({
        devDependencies: {
          ...fullLintDevDependencies,
          eslint: '^8.0.0',
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

    beforeEach(() => {
      mockedFetchRepoFile.mockReset();
    });

    it('should create eslint.config.js with fetched content for v2 platform', async () => {
      const directory = '/test/project/component1';
      const remote = `import { defineConfig } from 'eslint/config';
export default defineConfig([]);`;

      mockedFetchRepoFile.mockResolvedValueOnce({ data: remote } as never);

      const result = await createEslintConfig(directory, '2026.03');

      expect(mockedFetchRepoFile).toHaveBeenCalledWith(
        HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
        '2026.03/components/cards/src/app/cards/eslint.config.js',
        DEFAULT_PROJECT_TEMPLATE_BRANCH
      );
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join(directory, 'eslint.config.js'),
        remote,
        'utf-8'
      );
      expect(result).toContain('eslint.config.js');
    });

    it('should reject when remote fetch fails', async () => {
      const directory = '/test/project/component1';

      mockedFetchRepoFile.mockRejectedValueOnce(new Error('network'));

      await expect(createEslintConfig(directory, '2026.03')).rejects.toThrow();

      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('2026.03')
      );
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
    });

    it('should reject when remote body is empty after trim', async () => {
      const directory = '/test/project/component1';

      mockedFetchRepoFile.mockResolvedValueOnce({ data: '  \n  ' } as never);

      await expect(createEslintConfig(directory, '2026.03')).rejects.toThrow();

      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('2026.03')
      );
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
    });

    it('should reject when platform is not v2', async () => {
      const directory = '/test/project/component1';

      await expect(createEslintConfig(directory, '2023.2')).rejects.toThrow();

      expect(mockedFetchRepoFile).not.toHaveBeenCalled();
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('2023.2')
      );
    });

    it('should reject when platformVersion is missing', async () => {
      const directory = '/test/project/component1';

      await expect(createEslintConfig(directory, null)).rejects.toThrow();

      expect(mockedFetchRepoFile).not.toHaveBeenCalled();
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('platformVersion')
      );
    });

    it('should log error if write fails', async () => {
      const directory = '/test/project/component1';
      mockedFetchRepoFile.mockResolvedValueOnce({
        data: 'export default [];',
      } as never);
      writeFileSyncSpy.mockImplementationOnce(() => {
        throw new Error('Write failed');
      });

      await expect(createEslintConfig(directory, '2026.03')).rejects.toThrow();
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

  describe('getMissingLintScripts', () => {
    it('should return both scripts when neither exists', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({ name: 'test', scripts: {} })
      );

      const result = getMissingLintScripts(directory);

      expect(result).toEqual(['lint', 'lint:fix']);
    });

    it('should return both scripts when scripts field is missing', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(JSON.stringify({ name: 'test' }));

      const result = getMissingLintScripts(directory);

      expect(result).toEqual(['lint', 'lint:fix']);
    });

    it('should return only lint:fix when lint already exists', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          name: 'test',
          scripts: { lint: 'eslint .' },
        })
      );

      const result = getMissingLintScripts(directory);

      expect(result).toEqual(['lint:fix']);
    });

    it('should return only lint when lint:fix already exists', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          name: 'test',
          scripts: { 'lint:fix': 'eslint . --fix' },
        })
      );

      const result = getMissingLintScripts(directory);

      expect(result).toEqual(['lint']);
    });

    it('should return empty array when both scripts exist', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          name: 'test',
          scripts: { lint: 'eslint .', 'lint:fix': 'eslint . --fix' },
        })
      );

      const result = getMissingLintScripts(directory);

      expect(result).toEqual([]);
    });

    it('should return empty array when package.json cannot be read', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockImplementationOnce(() => {
        throw new Error('File not found');
      });

      const result = getMissingLintScripts(directory);

      expect(result).toEqual([]);
    });

    it('should not consider custom lint scripts as missing', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({
          name: 'test',
          scripts: {
            lint: 'custom-linter run',
            'lint:fix': 'custom-linter fix',
          },
        })
      );

      const result = getMissingLintScripts(directory);

      expect(result).toEqual([]);
    });
  });

  describe('addLintScriptsToPackageJson', () => {
    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync');

    it('should add both lint scripts when neither exists', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({ name: 'test', scripts: { build: 'tsc' } }, null, 2)
      );

      const result = addLintScriptsToPackageJson(directory);

      expect(result.added).toEqual(['lint', 'lint:fix']);
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join(directory, 'package.json'),
        expect.stringContaining('"lint": "eslint ."'),
        'utf-8'
      );
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join(directory, 'package.json'),
        expect.stringContaining('"lint:fix": "eslint . --fix"'),
        'utf-8'
      );
    });

    it('should add only the missing script when one exists', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({ name: 'test', scripts: { lint: 'eslint .' } }, null, 2)
      );

      const result = addLintScriptsToPackageJson(directory);

      expect(result.added).toEqual(['lint:fix']);
    });

    it('should not write if both scripts already exist', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify(
          {
            name: 'test',
            scripts: { lint: 'eslint .', 'lint:fix': 'eslint . --fix' },
          },
          null,
          2
        )
      );

      const result = addLintScriptsToPackageJson(directory);

      expect(result.added).toEqual([]);
      expect(writeFileSyncSpy).not.toHaveBeenCalled();
    });

    it('should create scripts field if it does not exist', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({ name: 'test' }, null, 2)
      );

      const result = addLintScriptsToPackageJson(directory);

      expect(result.added).toEqual(['lint', 'lint:fix']);
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join(directory, 'package.json'),
        expect.stringContaining('"scripts"'),
        'utf-8'
      );
    });

    it('should preserve existing scripts', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify(
          { name: 'test', scripts: { build: 'tsc', test: 'vitest' } },
          null,
          2
        )
      );

      const result = addLintScriptsToPackageJson(directory);

      expect(result.added).toEqual(['lint', 'lint:fix']);
      const writtenContent = writeFileSyncSpy.mock.calls[0][1] as string;
      expect(writtenContent).toContain('"build": "tsc"');
      expect(writtenContent).toContain('"test": "vitest"');
    });

    it('should warn and return empty added array if write fails', () => {
      const directory = '/test/project/component1';
      readFileSyncSpy.mockReturnValueOnce(
        JSON.stringify({ name: 'test' }, null, 2)
      );
      writeFileSyncSpy.mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });

      const result = addLintScriptsToPackageJson(directory);

      expect(result.added).toEqual([]);
      expect(uiLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to add lint scripts')
      );
    });
  });
});
