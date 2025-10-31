import { Doctor } from '../Doctor.js';
import { hasMissingPackages as _hasMissingPackages } from '../../dependencyManagement.js';
import { isPortManagerPortAvailable as _isPortManagerPortAvailable } from '@hubspot/local-dev-lib/portManager';
import {
  DiagnosticInfo,
  DiagnosticInfoBuilder,
} from '../DiagnosticInfoBuilder.js';
import {
  accessTokenForPersonalAccessKey as _accessTokenForPersonalAccessKey,
  authorizedScopesForPortalAndUser as _authorizedScopesForPortalAndUser,
  scopesOnAccessToken as _scopesOnAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import { HubSpotHttpError } from '@hubspot/local-dev-lib/models/HubSpotHttpError';
import { AxiosError } from 'axios';
import { isSpecifiedError as _isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { promisify as _promisify } from 'util';

vi.mock('../../ui/logger.js');
vi.mock('../Diagnosis');
vi.mock('../../ui/SpinniesManager');
vi.mock('../DiagnosticInfoBuilder');
vi.mock('../../dependencyManagement');
vi.mock('../../npm');
vi.mock('@hubspot/local-dev-lib/portManager');
vi.mock('@hubspot/local-dev-lib/personalAccessKey');
vi.mock('@hubspot/local-dev-lib/errors/index');
vi.mock('util');

const hasMissingPackages = vi.mocked(_hasMissingPackages);
const isPortManagerPortAvailable = vi.mocked(_isPortManagerPortAvailable);
const utilPromisify = vi.mocked(_promisify);
const accessTokenForPersonalAccessKey = vi.mocked(
  _accessTokenForPersonalAccessKey
);
const authorizedScopesForPortalAndUser = vi.mocked(
  _authorizedScopesForPortalAndUser
);
const scopesOnAccessToken = vi.mocked(_scopesOnAccessToken);
const isSpecifiedError = vi.mocked(_isSpecifiedError);

describe('lib/doctor/Doctor', () => {
  let doctor: Doctor;

  // @ts-ignore
  const diagnosticInfo: DiagnosticInfo = {
    account: {},
    arch: 'x64',
    config: 'path/to/config',
    configSettings: { httpUseLocalhost: false },
    configFiles: ['src/serverless.json'],
    diagnosis: '',
    envFiles: [],
    files: [],
    jsonFiles: ['src/serverless.json', 'src/extension.json'],
    packageFiles: ['src/package.json'],
    packageLockFiles: ['src/package-lock.json'],
    path: '',
    platform: 'darwin',
    project: {
      config: {
        projectDir: '/path/to/project',
        projectConfig: {
          name: 'my-project',
          srcDir: '/path/to/project',
          platformVersion: 'test',
        },
      },
    },
    versions: {
      node: '18.1.2',
      '@hubspot/cli': '6.0.0',
      npm: '6.14.13',
    },
  };

  beforeEach(() => {
    doctor = new Doctor({
      generateDiagnosticInfo: vi.fn().mockResolvedValue({
        ...diagnosticInfo,
      }),
    } as unknown as DiagnosticInfoBuilder);

    utilPromisify.mockReturnValue(
      vi.fn().mockImplementation((filename: string) => {
        if (filename.includes('invalid')) {
          return 'not-valid-json';
        }
        return JSON.stringify({ valid: true });
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('CLI Checks', () => {
    describe('node version', () => {
      it('should add success section if node version is valid', async () => {
        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCliSection).toHaveBeenCalledWith({
          type: 'success',
          message: `node v${diagnosticInfo.versions.node} is installed`,
        });
      });

      it('should add error section if node version is not available', async () => {
        doctor = new Doctor({
          generateDiagnosticInfo: vi.fn().mockResolvedValue({
            ...diagnosticInfo,
            versions: {},
          }),
        } as unknown as DiagnosticInfoBuilder);

        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCliSection).toHaveBeenCalledWith({
          type: 'error',
          message: 'Unable to determine what version of node is installed',
        });
      });

      it('should add error section if minimum node version is not met', async () => {
        doctor = new Doctor({
          generateDiagnosticInfo: vi.fn().mockResolvedValue({
            ...diagnosticInfo,
            versions: { node: '1.0.0' },
          }),
        } as unknown as DiagnosticInfoBuilder);

        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCliSection).toHaveBeenCalledWith({
          type: 'warning',
          message: expect.stringMatching(/Minimum Node version is not met/),
        });
      });
    });

    describe('npm version', () => {
      it('should add success section if npm is installed', async () => {
        await doctor.diagnose();
        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCliSection).toHaveBeenCalledWith({
          type: 'success',
          message: `npm v${diagnosticInfo.versions.npm} is installed`,
        });
      });

      it('should add error section if npm is not installed', async () => {
        doctor = new Doctor({
          generateDiagnosticInfo: vi.fn().mockResolvedValue({
            ...diagnosticInfo,
            versions: {},
          }),
        } as unknown as DiagnosticInfoBuilder);

        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCliSection).toHaveBeenCalledWith({
          type: 'error',
          message: expect.any(String),
        });
      });
    });
  });

  describe('CLI Config Checks', () => {
    describe('Personal Access Key', () => {
      it('should add success sections if the access token is valid', async () => {
        scopesOnAccessToken.mockResolvedValueOnce(['scope1']);
        authorizedScopesForPortalAndUser.mockResolvedValueOnce([
          {
            scopeGroup: {
              name: 'scope1',
              shortDescription: 'scope1',
              longDescription: 'scope1',
            },
            portalAuthorized: true,
            userAuthorized: true,
          },
        ]);

        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCLIConfigSection).toHaveBeenCalledWith({
          type: 'success',
          message: 'Default account active',
        });

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCLIConfigSection).toHaveBeenCalledWith({
          type: 'success',
          message: expect.stringMatching(/Personal Access Key is valid./),
        });
      });

      it('should add an error section if it is unable to determine if the portal is active', async () => {
        accessTokenForPersonalAccessKey.mockRejectedValueOnce(
          new HubSpotHttpError('Invalid token', { cause: new AxiosError() })
        );

        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCLIConfigSection).toHaveBeenCalledWith({
          type: 'error',
          message: 'Unable to determine if the portal is active',
        });
      });

      it('should add an error section if the portal is inactive', async () => {
        accessTokenForPersonalAccessKey.mockRejectedValueOnce(
          new HubSpotHttpError('Invalid token')
        );
        isSpecifiedError.mockImplementation((err, fields) => {
          return (
            fields.statusCode === 401 &&
            fields.category === 'INVALID_AUTHENTICATION' &&
            fields?.subCategory === 'LocalDevAuthErrorType.PORTAL_NOT_ACTIVE'
          );
        });
        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCLIConfigSection).toHaveBeenCalledWith({
          type: 'error',
          message: "Default account isn't active",
          secondaryMessaging: expect.stringMatching(
            /to remove inactive accounts from your CLI config/
          ),
        });
      });

      it('should add an error section if the portal is not found', async () => {
        accessTokenForPersonalAccessKey.mockRejectedValueOnce(
          new HubSpotHttpError('Not found')
        );
        isSpecifiedError.mockImplementation((err, fields) => {
          return (
            fields.statusCode === 404 &&
            fields.category === 'INVALID_AUTHENTICATION' &&
            fields?.subCategory === 'LocalDevAuthErrorType.INVALID_PORTAL_ID'
          );
        });
        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCLIConfigSection).toHaveBeenCalledWith({
          type: 'error',
          message: "Default account isn't active",
          secondaryMessaging: expect.stringMatching(
            /to remove inactive accounts from your CLI config/
          ),
        });
      });

      it('should add multiple sections if token is invalid but the portal is active', async () => {
        accessTokenForPersonalAccessKey.mockRejectedValueOnce(
          new HubSpotHttpError('Not found')
        );
        isSpecifiedError.mockImplementation((err, fields) => {
          return (
            fields.statusCode === 401 &&
            fields.category === 'INVALID_AUTHENTICATION' &&
            fields?.subCategory ===
              'LocalDevAuthErrorType.FAILED_TO_SIGN_REFRESH_TOKEN_DECODE'
          );
        });
        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCLIConfigSection).toHaveBeenCalledWith({
          type: 'success',
          message: 'Default account active',
        });

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCLIConfigSection).toHaveBeenCalledWith({
          type: 'error',
          message: 'Personal access key is invalid',
          secondaryMessaging: expect.stringMatching(/To get a new key, run/),
        });
      });

      it('should add an error section if we are unable to determine if the portal is active', async () => {
        accessTokenForPersonalAccessKey.mockRejectedValueOnce(
          new HubSpotHttpError('Not found')
        );
        isSpecifiedError.mockReturnValue(false);
        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addCLIConfigSection).toHaveBeenCalledWith({
          type: 'error',
          message: 'Unable to determine if the portal is active',
        });
      });

      it('should warn when there are missing authorized scopes', async () => {
        scopesOnAccessToken.mockResolvedValueOnce(['scope1', 'scope2']);
        authorizedScopesForPortalAndUser.mockResolvedValueOnce([
          {
            scopeGroup: {
              name: 'scope1',
              shortDescription: 'scope1',
              longDescription: 'scope1',
            },
            portalAuthorized: true,
            userAuthorized: true,
          },
          {
            scopeGroup: {
              name: 'scope2',
              shortDescription: 'scope2',
              longDescription: 'scope2',
            },
            portalAuthorized: true,
            userAuthorized: true,
          },
          {
            scopeGroup: {
              name: 'scope3',
              shortDescription: 'scope3',
              longDescription: 'scope3',
            },
            portalAuthorized: true,
            userAuthorized: true,
          },
        ]);

        await doctor.diagnose();
        expect(doctor['diagnosis']?.addCLIConfigSection).toHaveBeenCalledWith({
          type: 'warning',
          message:
            'Personal access key is valid, but there are more scopes available to your user that are not included in your key.',
          secondaryMessaging: expect.any(String),
        });
      });

      it('should not warn when the missing scope is not authorized', async () => {
        scopesOnAccessToken.mockResolvedValueOnce(['scope1']);
        authorizedScopesForPortalAndUser.mockResolvedValueOnce([
          {
            scopeGroup: {
              name: 'scope1',
              shortDescription: 'scope1',
              longDescription: 'scope1',
            },
            portalAuthorized: true,
            userAuthorized: true,
          },
          {
            scopeGroup: {
              name: 'scope2',
              shortDescription: 'scope2',
              longDescription: 'scope2',
            },
            portalAuthorized: true,
            userAuthorized: false,
          },
        ]);

        await doctor.diagnose();
        expect(doctor['diagnosis']?.addCLIConfigSection).toHaveBeenCalledWith({
          type: 'success',
          message: expect.stringMatching(/Personal Access Key is valid./),
        });
      });
    });
  });

  describe('Project Checks', () => {
    describe('Dependencies', () => {
      it('should add warning section if dependencies are missing', async () => {
        hasMissingPackages.mockResolvedValue(true);

        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addProjectSection).toHaveBeenCalledWith({
          type: 'warning',
          message: expect.stringMatching(/missing dependencies in/),
          secondaryMessaging: expect.stringMatching(
            /to install all project dependencies locally/
          ),
        });
      });

      it('should add success section if no dependencies are missing', async () => {
        hasMissingPackages.mockResolvedValue(false);
        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addProjectSection).toHaveBeenCalledWith({
          type: 'success',
          message: 'App dependencies are installed and up to date',
        });
      });

      it('should add error section if the package.json file is invalid JSON', async () => {
        hasMissingPackages.mockImplementationOnce(() => {
          throw new Error('Uh oh');
        });
        utilPromisify.mockReturnValueOnce(
          vi.fn().mockImplementation((filename: string) => {
            if (filename.endsWith('package.json')) {
              return 'not-valid-json';
            }
            return JSON.stringify({ valid: true });
          })
        );

        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addProjectSection).toHaveBeenCalledWith({
          type: 'error',
          message: expect.stringMatching(/Invalid JSON in/),
        });
      });

      it('should add error section if it is unable to determine if dependencies need installed', async () => {
        hasMissingPackages.mockImplementationOnce(() => {
          throw new Error('Uh oh');
        });
        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addProjectSection).toHaveBeenCalledWith({
          type: 'error',
          message: expect.stringMatching(
            /Unable to determine if dependencies are installed/
          ),
        });
      });
    });

    describe('Port', () => {
      it('should add warning section if port is in use', async () => {
        isPortManagerPortAvailable.mockResolvedValue(false);
        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis?.addProjectSection).toHaveBeenCalledWith({
          type: 'warning',
          message: 'Port 8080 is in use',
          secondaryMessaging: expect.stringMatching(
            /Make sure it is available before running/
          ),
        });
      });

      it('should add success section if port is available', async () => {
        isPortManagerPortAvailable.mockResolvedValue(true);

        await doctor.diagnose();
        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addProjectSection).toHaveBeenCalledWith({
          type: 'success',
          message: 'Port 8080 available for local development',
        });
      });
    });

    describe('JSON Files', () => {
      it('should add success section if project json files are valid', async () => {
        utilPromisify.mockReturnValueOnce(
          vi.fn().mockResolvedValue(JSON.stringify({ valid: true }))
        );
        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addProjectSection).toHaveBeenCalledWith({
          type: 'success',
          message: 'JSON files valid',
        });
      });

      it('should add error section if project json files are invalid', async () => {
        utilPromisify.mockReturnValueOnce(
          vi.fn().mockResolvedValue('not-valid-json')
        );
        await doctor.diagnose();

        // @ts-expect-error Testing private method
        expect(doctor.diagnosis.addProjectSection).toHaveBeenCalledWith({
          type: 'error',
          message: expect.stringMatching(/Invalid JSON in/),
        });
      });
    });
  });
});
