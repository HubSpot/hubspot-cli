import util from 'util';

jest.mock('@hubspot/local-dev-lib/fs');
jest.mock('@hubspot/local-dev-lib/config');
jest.mock('@hubspot/local-dev-lib/personalAccessKey');
jest.mock('../../projects/config');
jest.mock('@hubspot/local-dev-lib/api/projects');
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../package.json', () => ({
  version: '1.0.0',
}));

import { DiagnosticInfoBuilder, ProjectConfig } from '../DiagnosticInfoBuilder';
import {
  getAccountId as _getAccountId,
  getAccountConfig as _getAccountConfig,
  getConfigPath as _getConfigPath,
  getDefaultAccountOverrideFilePath as _getDefaultAccountOverrideFilePath,
  isConfigFlagEnabled as _isConfigFlagEnabled,
} from '@hubspot/local-dev-lib/config';
import { getAccessToken as _getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { walk as _walk } from '@hubspot/local-dev-lib/fs';
import { AccessToken, CLIAccount } from '@hubspot/local-dev-lib/types/Accounts';
import { getProjectConfig as _getProjectConfig } from '../../projects/config';
import { fetchProject as _fetchProject } from '@hubspot/local-dev-lib/api/projects';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';

const walk = _walk as jest.MockedFunction<typeof _walk>;
const getAccessToken = _getAccessToken as jest.MockedFunction<
  typeof _getAccessToken
>;
const getAccountConfig = _getAccountConfig as jest.MockedFunction<
  typeof _getAccountConfig
>;
const getConfigPath = _getConfigPath as jest.MockedFunction<
  typeof _getConfigPath
>;
const getDefaultAccountOverrideFilePath =
  _getDefaultAccountOverrideFilePath as jest.MockedFunction<
    typeof _getDefaultAccountOverrideFilePath
  >;
const getAccountId = _getAccountId as jest.MockedFunction<typeof _getAccountId>;
const getProjectConfig = _getProjectConfig as jest.MockedFunction<
  typeof _getProjectConfig
>;
const isConfigFlagEnabled = _isConfigFlagEnabled as jest.MockedFunction<
  typeof _isConfigFlagEnabled
>;
const fetchProject = _fetchProject as jest.MockedFunction<typeof _fetchProject>;

const utilPromisify = util.promisify as jest.MockedFunction<
  typeof util.promisify
>;

describe('lib/doctor/DiagnosticInfo', () => {
  const accountId = 898989;
  const accountConfig: CLIAccount = {
    env: 'prod',
    authType: 'personalaccesskey',
    accountType: 'STANDARD',
    personalAccessKey: 'super-secret-key',
  };
  const nodeVersion = 'v18.17.0';
  const processInfo = {
    platform: 'darwin',
    arch: 'x64',
    versions: { node: nodeVersion },
    mainModule: { path: '/path/to/main/module' },
  } as NodeJS.Process;

  const projectDir = '/Users/test/project';
  const projectFiles = [
    `${projectDir}/.gitignore`,
    `${projectDir}/README.md`,
    // Config files
    `${projectDir}/hsproject.json`,
    `${projectDir}/src/app/app.json`,
    `${projectDir}/src/app/public-app.json`,
    // Serverless files
    `${projectDir}/src/app/app.functions/.env`,
    `${projectDir}/src/app/app.functions/function.js`,
    `${projectDir}/src/app/app.functions/serverless.json`,
    `${projectDir}/src/app/app.functions/package.json`,
    `${projectDir}/src/app/app.functions/package-lock.json`,
    // Extension files
    `${projectDir}/src/app/extensions/extension.js`,
    `${projectDir}/src/app/extensions/extension.json`,
    `${projectDir}/src/app/extensions/package.json`,
    `${projectDir}/src/app/extension/package-lock.json`,
    `${projectDir}/src/app/app.functions/node_modules/axios`,
  ];

  beforeEach(() => {
    getAccountId.mockReturnValue(accountId);
    getAccountConfig.mockReturnValue(accountConfig);
    walk.mockResolvedValue(projectFiles);
    isConfigFlagEnabled.mockReturnValue(false);
  });

  it('should initialize the required state on creation', () => {
    const builder = new DiagnosticInfoBuilder(processInfo);

    expect(getAccountId).toHaveBeenCalledTimes(1);
    expect(getAccountConfig).toHaveBeenCalledTimes(1);

    expect(builder.accountId).toEqual(accountId);

    expect(builder.env).toEqual(accountConfig.env);
    expect(builder.authType).toEqual(accountConfig.authType);
    expect(builder.accountType).toEqual(accountConfig.accountType);
    expect(builder.personalAccessKey).toEqual(accountConfig.personalAccessKey);
    expect(builder.processInfo).toEqual(processInfo);
  });

  describe('generateDiagnosticInfo', () => {
    let builder: DiagnosticInfoBuilder;
    let projectConfig: ProjectConfig;
    let projectDetails: Project;
    let accessToken: AccessToken;

    const npmVersion = 'v8.17.0';
    const configPath = '/path/to/config';
    const defaultAccountOverrideFile =
      'path/to/default/account/override/.hsaccount';

    beforeEach(() => {
      builder = new DiagnosticInfoBuilder(processInfo);

      projectConfig = {
        projectDir,
        projectConfig: {
          name: 'My project',
          srcDir: 'project-dir',
          platformVersion: 'test',
        },
      };

      projectDetails = {
        createdAt: 12345,
        deletedAt: 0,
        deployedBuildId: 1,
        id: 8989898,
        isLocked: false,
        name: projectConfig!.projectConfig!.name,
        portalId: accountId,
        updatedAt: 12345,
      };

      accessToken = {
        accessToken: 'super-secret-dont-put-this-in-a-unit-test',
        accountType: 'STANDARD',
        encodedOAuthRefreshToken: '',
        expiresAt: '',
        hubName: projectConfig!.projectConfig!.name,
        portalId: accountId,
        scopeGroups: [],
        enabledFeatures: {},
      };

      getProjectConfig.mockResolvedValue(projectConfig);
      fetchProject.mockResolvedValue({
        data: projectDetails,
      } as unknown as HubSpotPromise<Project>);
      getAccessToken.mockResolvedValue(accessToken);
      getConfigPath.mockReturnValue(configPath);
      getDefaultAccountOverrideFilePath.mockReturnValue(
        defaultAccountOverrideFile
      );
      utilPromisify.mockReturnValue(jest.fn().mockResolvedValue(npmVersion));
    });

    it('should gather the required data and generate the diagnostic', async () => {
      const diagnosticInfo = await builder.generateDiagnosticInfo();

      expect(getProjectConfig).toHaveBeenCalledTimes(1);

      expect(fetchProject).toHaveBeenCalledTimes(1);
      expect(fetchProject).toHaveBeenCalledWith(
        accountId,
        projectConfig!.projectConfig!.name
      );

      expect(getAccessToken).toHaveBeenCalledTimes(1);
      expect(getAccessToken).toHaveBeenCalledWith(
        accountConfig.personalAccessKey,
        accountConfig.env,
        accountId
      );

      // @ts-expect-error Accessing private field
      expect(builder._projectConfig).toEqual(projectConfig);

      expect(diagnosticInfo).toMatchSnapshot();
    });

    it('should handle errors when fetching project details', async () => {
      fetchProject.mockRejectedValue(
        new Error('Failed to fetch project details')
      );

      const diagnosticInfo = await builder.generateDiagnosticInfo();

      expect(fetchProject).toHaveBeenCalledTimes(1);
      expect(diagnosticInfo.project.details).toBeUndefined();
    });

    it('should handle errors when fetching access token', async () => {
      getAccessToken.mockRejectedValue(
        new Error('Failed to fetch access token')
      );

      const diagnosticInfo = await builder.generateDiagnosticInfo();

      expect(getAccessToken).toHaveBeenCalledTimes(1);
      expect(diagnosticInfo.account.name).toBeUndefined();
      expect(diagnosticInfo.account.scopeGroups).toBeUndefined();
      expect(diagnosticInfo.account.enabledFeatures).toBeUndefined();
    });

    it('should handle errors when fetching project filenames', async () => {
      walk.mockRejectedValue(new Error('Failed to walk project directory'));

      const diagnosticInfo = await builder.generateDiagnosticInfo();

      expect(walk).toHaveBeenCalledTimes(1);
      expect(diagnosticInfo.files).toEqual([]);
    });
  });
});
