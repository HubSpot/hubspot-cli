import yargs, { Argv, ArgumentsCamelCase } from 'yargs';
import path from 'path';
import { uiLogger } from '../../../lib/ui/logger.js';
import * as projectUtils from '../../../lib/projects/config.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';
import { trackCommandUsage } from '../../../lib/usageTracking.js';
import * as dependencyManagement from '../../../lib/dependencyManagement.js';
import * as promptUtils from '../../../lib/prompts/promptUtils.js';
import * as linting from '../../../lib/projects/uieLinting.js';
import { REQUIRED_PACKAGES_AND_MIN_VERSIONS } from '../../../lib/projects/uieLinting.js';
import projectLintCommand, { ProjectLintArgs } from '../lint.js';

vi.mock('../../../lib/ui/logger.js');
vi.mock('../../../lib/ui/SpinniesManager.js');
vi.mock('../../../lib/projects/config');
vi.mock('../../../lib/dependencyManagement');
vi.mock('../../../lib/prompts/promptUtils');
vi.mock('../../../lib/projects/uieLinting');
vi.mock('../../../lib/usageTracking');
vi.mock('../../../lib/commonOpts');

const exampleSpy = vi.spyOn(yargs as Argv, 'example');
const processExitSpy = vi.spyOn(process, 'exit');
const getProjectConfigSpy = vi.spyOn(projectUtils, 'getProjectConfig');
const getProjectPackageJsonLocationsSpy = vi.spyOn(
  dependencyManagement,
  'getProjectPackageJsonLocations'
);
const installPackagesSpy = vi.spyOn(dependencyManagement, 'installPackages');
const promptUserSpy = vi.spyOn(promptUtils, 'promptUser');
const areAllLintPackagesInstalledSpy = vi.spyOn(
  linting,
  'areAllLintPackagesInstalled'
);
const getMissingLintPackagesSpy = vi.spyOn(linting, 'getMissingLintPackages');
const lintPackagesSpy = vi.spyOn(linting, 'lintPackages');
const displayLintResultsSpy = vi.spyOn(linting, 'displayLintResults');
const hasEslintConfigSpy = vi.spyOn(linting, 'hasEslintConfig');
const hasDeprecatedEslintConfigSpy = vi.spyOn(
  linting,
  'hasDeprecatedEslintConfig'
);
const getDeprecatedEslintConfigFilesSpy = vi.spyOn(
  linting,
  'getDeprecatedEslintConfigFiles'
);
const createEslintConfigSpy = vi.spyOn(linting, 'createEslintConfig');

describe('commands/project/lint', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(projectLintCommand.command).toEqual('lint');
    });
  });

  describe('describe', () => {
    it('should provide a description', () => {
      expect(projectLintCommand.describe).toEqual(
        expect.stringMatching(
          /Lint the UI Extensions components in your project/
        )
      );
    });
  });

  describe('builder', () => {
    it('should provide examples', () => {
      projectLintCommand.builder(yargs as Argv);
      expect(exampleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handler', () => {
    let args: ArgumentsCamelCase<ProjectLintArgs>;

    beforeEach(() => {
      args = {
        derivedAccountId: 999999,
      } as ArgumentsCamelCase<ProjectLintArgs>;
      // @ts-expect-error Doesn't match the actual signature because then the linter complains about unused variables
      processExitSpy.mockImplementation(() => {});
      // Default to having config present unless overridden
      hasEslintConfigSpy.mockReturnValue(true);
      hasDeprecatedEslintConfigSpy.mockReturnValue(false);
      // Default to linting succeeding unless overridden
      lintPackagesSpy.mockResolvedValue({ success: true, results: [] });
      displayLintResultsSpy.mockImplementation(() => {});
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should track the command usage', async () => {
      getProjectConfigSpy.mockResolvedValue({
        projectDir: '/test/project',
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([]);

      await projectLintCommand.handler(args);

      expect(trackCommandUsage).toHaveBeenCalledTimes(1);
      expect(trackCommandUsage).toHaveBeenCalledWith(
        'project-lint',
        undefined,
        args.derivedAccountId
      );
    });

    it('should handle exceptions', async () => {
      const error = new Error('Something went super wrong');
      getProjectConfigSpy.mockImplementationOnce(() => {
        throw error;
      });

      await projectLintCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(uiLogger.error).toHaveBeenCalledWith(error.message);

      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when the project config is not defined', async () => {
      getProjectConfigSpy.mockResolvedValueOnce({
        projectDir: null,
        projectConfig: null,
      });
      await projectLintCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(uiLogger.error).toHaveBeenCalledWith(
        'No project detected. Run this command from a project directory.'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should log an error and exit when the project config has no projectDir', async () => {
      getProjectConfigSpy.mockResolvedValueOnce({
        projectDir: null,
        projectConfig: null,
      });
      await projectLintCommand.handler(args);

      expect(uiLogger.error).toHaveBeenCalledTimes(1);
      expect(uiLogger.error).toHaveBeenCalledWith(
        'No project detected. Run this command from a project directory.'
      );
      expect(processExitSpy).toHaveBeenCalledTimes(1);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should lint directories with all packages installed', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy.mockReturnValueOnce(true);

      await projectLintCommand.handler(args);

      expect(lintPackagesSpy).toHaveBeenCalledWith([lintLocation], projectDir);
      expect(promptUserSpy).not.toHaveBeenCalled();
      expect(installPackagesSpy).not.toHaveBeenCalled();
    });

    it('should prompt for packages that are in package.json but not in node_modules', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy
        .mockReturnValueOnce(false) // Initial check
        .mockReturnValueOnce(true); // After install
      getMissingLintPackagesSpy.mockReturnValueOnce({
        missingPackages: ['eslint', '@typescript-eslint/parser'],
      });
      promptUserSpy.mockResolvedValueOnce({
        shouldInstallPackages: true,
      });

      await projectLintCommand.handler(args);

      expect(promptUserSpy).toHaveBeenCalledWith([
        {
          name: 'shouldInstallPackages',
          type: 'confirm',
          message: expect.stringContaining('component1'),
          default: true,
        },
      ]);
      expect(installPackagesSpy).toHaveBeenCalledWith({
        packages: Object.entries(REQUIRED_PACKAGES_AND_MIN_VERSIONS).map(
          ([pkg, version]) => `${pkg}@^${version}`
        ),
        installLocations: [lintLocation],
        dev: true,
      });
      expect(lintPackagesSpy).toHaveBeenCalledWith([lintLocation], projectDir);
    });

    it('should prompt to install packages not in package.json', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy.mockReturnValue(false);
      getMissingLintPackagesSpy.mockReturnValueOnce({
        missingPackages: [
          'eslint',
          '@typescript-eslint/eslint-plugin',
          '@typescript-eslint/parser',
        ],
      });
      promptUserSpy.mockResolvedValueOnce({
        shouldInstallPackages: false,
      });

      await projectLintCommand.handler(args);

      expect(promptUserSpy).toHaveBeenCalledWith([
        {
          name: 'shouldInstallPackages',
          type: 'confirm',
          message: expect.stringContaining('The dependencies required'),
          default: true,
        },
      ]);
      expect(uiLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping linting for the following directory')
      );
      expect(lintPackagesSpy).not.toHaveBeenCalled();
    });

    it('should install packages when user confirms prompt', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy
        .mockReturnValueOnce(false) // Initial check
        .mockReturnValueOnce(true); // After install
      getMissingLintPackagesSpy.mockReturnValueOnce({
        missingPackages: ['@typescript-eslint/parser'],
      });
      promptUserSpy.mockResolvedValueOnce({
        shouldInstallPackages: true,
      });

      await projectLintCommand.handler(args);

      expect(installPackagesSpy).toHaveBeenCalledWith({
        packages: Object.entries(REQUIRED_PACKAGES_AND_MIN_VERSIONS).map(
          ([pkg, version]) => `${pkg}@^${version}`
        ),
        installLocations: [lintLocation],
        dev: true,
      });
      expect(lintPackagesSpy).toHaveBeenCalledWith([lintLocation], projectDir);
    });

    it('should handle mixed scenarios: some directories ready, some needing packages', async () => {
      const projectDir = '/test/project';
      const lintLocation1 = path.join(projectDir, 'component1'); // All installed
      const lintLocation2 = path.join(projectDir, 'component2'); // Needs packages
      const lintLocation3 = path.join(projectDir, 'component3'); // Needs packages

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([
        lintLocation1,
        lintLocation2,
        lintLocation3,
      ]);

      areAllLintPackagesInstalledSpy
        .mockReturnValueOnce(true) // component1 is ready
        .mockReturnValueOnce(false) // component2 needs work
        .mockReturnValueOnce(false); // component3 needs work

      getMissingLintPackagesSpy
        .mockReturnValueOnce({
          missingPackages: ['eslint'],
        }) // component2
        .mockReturnValueOnce({
          missingPackages: ['@typescript-eslint/parser'],
        }); // component3

      promptUserSpy.mockResolvedValueOnce({
        shouldInstallPackages: false,
      });

      await projectLintCommand.handler(args);

      // Should prompt for both component2 and component3
      expect(promptUserSpy).toHaveBeenCalledWith([
        {
          name: 'shouldInstallPackages',
          type: 'confirm',
          message: expect.stringContaining('The dependencies required'),
          default: true,
        },
      ]);

      // Should only lint component1 (user declined packages for 2 and 3)
      expect(lintPackagesSpy).toHaveBeenCalledWith([lintLocation1], projectDir);
    });

    it('should show correct message for single directory', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy.mockReturnValue(false);
      getMissingLintPackagesSpy.mockReturnValueOnce({
        missingPackages: ['eslint'],
      });
      promptUserSpy.mockResolvedValueOnce({
        shouldInstallPackages: false,
      });

      await projectLintCommand.handler(args);

      expect(promptUserSpy).toHaveBeenCalledWith([
        {
          name: 'shouldInstallPackages',
          type: 'confirm',
          message: expect.stringContaining('The dependencies required'),
          default: true,
        },
      ]);
    });

    it('should show correct message for multiple directories', async () => {
      const projectDir = '/test/project';
      const lintLocation1 = path.join(projectDir, 'component1');
      const lintLocation2 = path.join(projectDir, 'component2');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([
        lintLocation1,
        lintLocation2,
      ]);
      areAllLintPackagesInstalledSpy.mockReturnValue(false);
      getMissingLintPackagesSpy
        .mockReturnValueOnce({
          missingPackages: ['eslint', '@typescript-eslint/parser'],
        })
        .mockReturnValueOnce({
          missingPackages: ['eslint'],
        });
      promptUserSpy.mockResolvedValueOnce({
        shouldInstallPackages: false,
      });

      await projectLintCommand.handler(args);

      expect(promptUserSpy).toHaveBeenCalledWith([
        {
          name: 'shouldInstallPackages',
          type: 'confirm',
          message: expect.stringContaining('The dependencies required'),
          default: true,
        },
      ]);
    });

    it('should only lint directories where all packages are successfully installed', async () => {
      const projectDir = '/test/project';
      const lintLocation1 = path.join(projectDir, 'component1');
      const lintLocation2 = path.join(projectDir, 'component2');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([
        lintLocation1,
        lintLocation2,
      ]);

      areAllLintPackagesInstalledSpy
        .mockReturnValueOnce(false) // component1 initial
        .mockReturnValueOnce(false) // component2 initial
        .mockReturnValueOnce(true) // component1 after install (success)
        .mockReturnValueOnce(false); // component2 after install (failed)

      getMissingLintPackagesSpy
        .mockReturnValueOnce({
          missingPackages: ['eslint'],
        })
        .mockReturnValueOnce({
          missingPackages: ['eslint'],
        });

      promptUserSpy.mockResolvedValueOnce({
        shouldInstallPackages: true,
      });

      await projectLintCommand.handler(args);

      // Should only lint component1 since component2 failed installation
      expect(lintPackagesSpy).toHaveBeenCalledWith([lintLocation1], projectDir);
    });

    it('should not prompt if no packages need installation', async () => {
      const projectDir = '/test/project';
      const lintLocation1 = path.join(projectDir, 'component1');
      const lintLocation2 = path.join(projectDir, 'component2');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([
        lintLocation1,
        lintLocation2,
      ]);
      areAllLintPackagesInstalledSpy
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      await projectLintCommand.handler(args);

      expect(promptUserSpy).not.toHaveBeenCalled();
      expect(installPackagesSpy).not.toHaveBeenCalled();
      expect(lintPackagesSpy).toHaveBeenCalledWith(
        [lintLocation1, lintLocation2],
        projectDir
      );
    });

    it('should handle empty project (no packages)', async () => {
      const projectDir = '/test/project';

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([]);

      await projectLintCommand.handler(args);

      expect(lintPackagesSpy).not.toHaveBeenCalled();
      expect(promptUserSpy).not.toHaveBeenCalled();
      expect(installPackagesSpy).not.toHaveBeenCalled();
    });

    it('should use relative paths in prompt messages', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'src', 'app', 'component1');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy.mockReturnValue(false);
      getMissingLintPackagesSpy.mockReturnValueOnce({
        missingPackages: ['eslint'],
      });
      promptUserSpy.mockResolvedValueOnce({
        shouldInstallPackages: false,
      });

      await projectLintCommand.handler(args);

      expect(promptUserSpy).toHaveBeenCalledWith([
        {
          name: 'shouldInstallPackages',
          type: 'confirm',
          message: expect.stringContaining('src/app/component1'),
          default: true,
        },
      ]);
    });

    it('should prompt to create ESLint config if not present', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy.mockReturnValue(true);
      hasEslintConfigSpy.mockReturnValue(false);
      promptUserSpy.mockResolvedValueOnce({
        shouldCreateConfig: true,
      });

      await projectLintCommand.handler(args);

      expect(hasEslintConfigSpy).toHaveBeenCalledWith(lintLocation);
      expect(promptUserSpy).toHaveBeenCalledWith([
        {
          name: 'shouldCreateConfig',
          type: 'confirm',
          message: expect.stringContaining(
            'ESLint configuration file not found'
          ),
          default: true,
        },
      ]);
      expect(createEslintConfigSpy).toHaveBeenCalledWith(lintLocation);
      expect(lintPackagesSpy).toHaveBeenCalledWith([lintLocation], projectDir);
    });

    it('should exit if user declines to create ESLint config', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy.mockReturnValue(true);
      hasEslintConfigSpy.mockReturnValue(false);
      promptUserSpy.mockResolvedValueOnce({
        shouldCreateConfig: false,
      });

      await projectLintCommand.handler(args);

      expect(createEslintConfigSpy).not.toHaveBeenCalled();
      expect(lintPackagesSpy).not.toHaveBeenCalled();
      expect(uiLogger.error).toHaveBeenCalledWith(
        'ESLint configuration is required to run the lint command. Run the command again to create the configuration.'
      );
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });

    it('should not prompt for config if it already exists', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy.mockReturnValue(true);
      hasEslintConfigSpy.mockReturnValue(true);

      await projectLintCommand.handler(args);

      expect(promptUserSpy).not.toHaveBeenCalled();
      expect(createEslintConfigSpy).not.toHaveBeenCalled();
      expect(lintPackagesSpy).toHaveBeenCalledWith([lintLocation], projectDir);
    });

    it('should handle multiple directories without configs', async () => {
      const projectDir = '/test/project';
      const lintLocation1 = path.join(projectDir, 'component1');
      const lintLocation2 = path.join(projectDir, 'component2');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([
        lintLocation1,
        lintLocation2,
      ]);
      areAllLintPackagesInstalledSpy.mockReturnValue(true);
      hasEslintConfigSpy.mockReturnValue(false);
      promptUserSpy.mockResolvedValueOnce({
        shouldCreateConfig: true,
      });

      await projectLintCommand.handler(args);

      expect(createEslintConfigSpy).toHaveBeenCalledTimes(2);
      expect(createEslintConfigSpy).toHaveBeenCalledWith(lintLocation1);
      expect(createEslintConfigSpy).toHaveBeenCalledWith(lintLocation2);
    });

    it('should warn and create new config if deprecated config exists', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy.mockReturnValue(true);
      hasEslintConfigSpy.mockReturnValue(false); // No modern config initially
      hasDeprecatedEslintConfigSpy.mockReturnValue(true);
      getDeprecatedEslintConfigFilesSpy.mockReturnValue([
        '.eslintrc.js',
        '.eslintrc.json',
      ]);
      promptUserSpy.mockResolvedValueOnce({
        shouldCreateConfig: true,
      });

      await projectLintCommand.handler(args);

      expect(hasEslintConfigSpy).toHaveBeenCalledWith(lintLocation);
      expect(hasDeprecatedEslintConfigSpy).toHaveBeenCalledWith(lintLocation);
      expect(getDeprecatedEslintConfigFilesSpy).toHaveBeenCalledWith(
        lintLocation
      );
      expect(uiLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Deprecated ESLint configuration')
      );
      // Should prompt because !hasModernConfig is checked
      expect(promptUserSpy).toHaveBeenCalledWith([
        {
          name: 'shouldCreateConfig',
          type: 'confirm',
          message: expect.stringContaining('component1'),
          default: true,
        },
      ]);
      // Creates config once from prompt
      expect(createEslintConfigSpy).toHaveBeenCalledWith(lintLocation);
      expect(createEslintConfigSpy).toHaveBeenCalledTimes(1);
      expect(lintPackagesSpy).toHaveBeenCalledWith([lintLocation], projectDir);
    });

    it('should handle multiple directories with deprecated configs', async () => {
      const projectDir = '/test/project';
      const lintLocation1 = path.join(projectDir, 'component1');
      const lintLocation2 = path.join(projectDir, 'component2');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([
        lintLocation1,
        lintLocation2,
      ]);
      areAllLintPackagesInstalledSpy.mockReturnValue(true);
      hasEslintConfigSpy.mockReturnValue(false); // No modern configs initially
      hasDeprecatedEslintConfigSpy.mockReturnValue(true);
      getDeprecatedEslintConfigFilesSpy
        .mockReturnValueOnce(['.eslintrc.js'])
        .mockReturnValueOnce(['.eslintrc.json']);
      promptUserSpy.mockResolvedValueOnce({
        shouldCreateConfig: true,
      });

      await projectLintCommand.handler(args);

      expect(hasEslintConfigSpy).toHaveBeenCalledTimes(2);
      expect(hasDeprecatedEslintConfigSpy).toHaveBeenCalledTimes(2);
      expect(uiLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Deprecated ESLint configuration')
      );
      // Should prompt for both locations since both lack modern config
      expect(promptUserSpy).toHaveBeenCalledWith([
        {
          name: 'shouldCreateConfig',
          type: 'confirm',
          message: expect.stringContaining('component1'),
          default: true,
        },
      ]);
      // Creates configs from prompt
      expect(createEslintConfigSpy).toHaveBeenCalledTimes(2);
      expect(createEslintConfigSpy).toHaveBeenCalledWith(lintLocation1);
      expect(createEslintConfigSpy).toHaveBeenCalledWith(lintLocation2);
    });

    it('should not warn about deprecated configs if none exist', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy.mockReturnValue(true);
      hasDeprecatedEslintConfigSpy.mockReturnValue(false);
      hasEslintConfigSpy.mockReturnValue(true);

      await projectLintCommand.handler(args);

      expect(getDeprecatedEslintConfigFilesSpy).not.toHaveBeenCalled();
      expect(lintPackagesSpy).toHaveBeenCalledWith([lintLocation], projectDir);
    });

    it('should handle mixed scenario: some dirs with deprecated configs, others without any config', async () => {
      const projectDir = '/test/project';
      const lintLocation1 = path.join(projectDir, 'component1'); // Has deprecated config
      const lintLocation2 = path.join(projectDir, 'component2'); // Has no config

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([
        lintLocation1,
        lintLocation2,
      ]);
      areAllLintPackagesInstalledSpy.mockReturnValue(true);
      hasEslintConfigSpy.mockReturnValue(false); // No modern configs initially
      hasDeprecatedEslintConfigSpy.mockImplementation(dir => {
        return dir === lintLocation1; // Only location1 has deprecated config
      });
      getDeprecatedEslintConfigFilesSpy.mockReturnValue(['.eslintrc.js']);
      promptUserSpy.mockResolvedValueOnce({
        shouldCreateConfig: true,
      });

      await projectLintCommand.handler(args);

      // Should check both locations
      expect(hasEslintConfigSpy).toHaveBeenCalledTimes(2);
      expect(hasDeprecatedEslintConfigSpy).toHaveBeenCalledTimes(2);
      // Should warn about deprecated config in location1
      expect(uiLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Deprecated ESLint configuration')
      );
      // Should prompt for both locations (both lack modern config)
      expect(promptUserSpy).toHaveBeenCalledWith([
        {
          name: 'shouldCreateConfig',
          type: 'confirm',
          message: expect.stringContaining('component'),
          default: true,
        },
      ]);
      // Should create configs for both from prompt
      expect(createEslintConfigSpy).toHaveBeenCalledWith(lintLocation1);
      expect(createEslintConfigSpy).toHaveBeenCalledWith(lintLocation2);
      expect(createEslintConfigSpy).toHaveBeenCalledTimes(2);
      expect(lintPackagesSpy).toHaveBeenCalledWith(
        [lintLocation1, lintLocation2],
        projectDir
      );
    });

    it('should install missing packages without prompting when --install-missing-deps is true', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      args.installMissingDeps = true;

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy
        .mockReturnValueOnce(false) // Initial check
        .mockReturnValueOnce(true); // After install
      getMissingLintPackagesSpy.mockReturnValueOnce({
        missingPackages: ['eslint', '@typescript-eslint/parser'],
      });

      await projectLintCommand.handler(args);

      expect(promptUserSpy).not.toHaveBeenCalled();
      expect(installPackagesSpy).toHaveBeenCalledWith({
        packages: Object.entries(REQUIRED_PACKAGES_AND_MIN_VERSIONS).map(
          ([pkg, version]) => `${pkg}@^${version}`
        ),
        installLocations: [lintLocation],
        dev: true,
      });
      expect(lintPackagesSpy).toHaveBeenCalledWith([lintLocation], projectDir);
    });

    it('should skip installing missing packages without prompting when --install-missing-deps is false', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      args.installMissingDeps = false;

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy.mockReturnValueOnce(false);
      getMissingLintPackagesSpy.mockReturnValueOnce({
        missingPackages: ['eslint', '@typescript-eslint/parser'],
      });

      await projectLintCommand.handler(args);

      expect(promptUserSpy).not.toHaveBeenCalled();
      expect(installPackagesSpy).not.toHaveBeenCalled();
      expect(uiLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('component1')
      );
      expect(lintPackagesSpy).not.toHaveBeenCalled();
    });

    it('should prompt for installation when --install-missing-deps is not provided', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      // installMissingDeps is undefined

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy
        .mockReturnValueOnce(false) // Initial check
        .mockReturnValueOnce(true); // After install
      getMissingLintPackagesSpy.mockReturnValueOnce({
        missingPackages: ['eslint', '@typescript-eslint/parser'],
      });
      promptUserSpy.mockResolvedValueOnce({
        shouldInstallPackages: true,
      });

      await projectLintCommand.handler(args);

      expect(promptUserSpy).toHaveBeenCalledWith([
        {
          name: 'shouldInstallPackages',
          type: 'confirm',
          message: expect.stringContaining('component1'),
          default: true,
        },
      ]);
      expect(installPackagesSpy).toHaveBeenCalledWith({
        packages: Object.entries(REQUIRED_PACKAGES_AND_MIN_VERSIONS).map(
          ([pkg, version]) => `${pkg}@^${version}`
        ),
        installLocations: [lintLocation],
        dev: true,
      });
      expect(lintPackagesSpy).toHaveBeenCalledWith([lintLocation], projectDir);
    });

    it('should exit with error code when linting fails', async () => {
      const projectDir = '/test/project';
      const lintLocation = path.join(projectDir, 'component1');

      getProjectConfigSpy.mockResolvedValue({
        projectDir,
        projectConfig: null,
      });
      getProjectPackageJsonLocationsSpy.mockResolvedValue([lintLocation]);
      areAllLintPackagesInstalledSpy.mockReturnValue(true);
      lintPackagesSpy.mockResolvedValueOnce({ success: false, results: [] }); // Linting fails

      await projectLintCommand.handler(args);

      expect(lintPackagesSpy).toHaveBeenCalledWith([lintLocation], projectDir);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
    });
  });
});
