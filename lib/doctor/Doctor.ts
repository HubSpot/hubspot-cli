import { uiLogger } from '../ui/logger.js';
import {
  getConfigDefaultAccountIfExists,
  getAllConfigAccounts,
} from '@hubspot/local-dev-lib/config';
import { getDefaultAccountOverrideAccountId } from '@hubspot/local-dev-lib/config/defaultAccountOverride';
import { getErrorMessage } from '../errorHandlers/index.js';

import SpinniesManager from '../ui/SpinniesManager.js';
import { hasMissingPackages } from '../dependencyManagement.js';
import { getLatestCliVersion } from '../cliUpgradeUtils.js';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { Diagnosis } from './Diagnosis.js';
import {
  DiagnosticInfoBuilder,
  DiagnosticInfo,
  ProjectConfig,
} from './DiagnosticInfoBuilder.js';
import { isPortManagerPortAvailable } from '@hubspot/local-dev-lib/portManager';
import { PORT_MANAGER_SERVER_PORT } from '@hubspot/local-dev-lib/constants/ports';
import {
  accessTokenForPersonalAccessKey,
  // scopesOnAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
// import { fetchScopeAuthorizationData } from '@hubspot/local-dev-lib/api/localDevAuth';
// import { ScopeGroupAuthorization } from '@hubspot/local-dev-lib/types/Accounts';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import {
  getHubSpotApiOrigin,
  getHubSpotWebsiteOrigin,
} from '@hubspot/local-dev-lib/urls';
import { pkg } from '../jsonLoader.js';
import { lib } from '../../lang/en.js';
import { uiLink } from '../ui/index.js';
import { isServerRunningAtUrl } from '../http.js';
import { WEBHOOKS_KEY, APP_KEY } from '@hubspot/project-parsing-lib/constants';
import { validateProjectConfig } from '../projects/config.js';
import { ProjectConfig as ProjectConfigType } from '../../types/Projects.js';
import {
  validateSourceDirectory,
  handleTranslate,
} from '../projects/upload.js';
import { isV2Project } from '../projects/platformVersion.js';
import { validateProjectForProfile } from '../projects/projectProfiles.js';
import { getAllHsProfiles } from '@hubspot/project-parsing-lib/profiles';

const minMajorNodeVersion = 20;

export class Doctor {
  accountId: number | null;
  private diagnosis?: Diagnosis;
  private projectConfig?: ProjectConfig;
  private diagnosticInfo?: DiagnosticInfo;
  readonly diagnosticInfoBuilder: DiagnosticInfoBuilder;

  constructor(
    diagnosticInfoBuilder: DiagnosticInfoBuilder = new DiagnosticInfoBuilder(
      process
    )
  ) {
    this.accountId = getConfigDefaultAccountIfExists()?.accountId ?? null;
    this.diagnosticInfoBuilder = diagnosticInfoBuilder;
  }

  async diagnose(): Promise<DiagnosticInfo> {
    SpinniesManager.add('runningDiagnostics', {
      text: lib.doctor.runningDiagnostics,
    });

    this.diagnosticInfo =
      await this.diagnosticInfoBuilder.generateDiagnosticInfo();

    this.projectConfig = this.diagnosticInfo?.project.config;

    this.diagnosis = new Diagnosis({
      diagnosticInfo: this.diagnosticInfo!,
      accountId: this.accountId,
    });

    await Promise.all([
      ...this.performCliChecks(),
      ...this.performCliConfigChecks(),
      ...this.performNetworkingChecks(),
      ...(this.projectConfig?.projectConfig ? this.performProjectChecks() : []),
    ]);

    this.performDefaultAccountOverrideFileChecks();
    this.performCliConfigSettingsChecks();

    SpinniesManager.succeed('runningDiagnostics', {
      text: lib.doctor.diagnosticsComplete,
      succeedColor: 'white',
    });

    this.diagnosticInfo.diagnosis = this.diagnosis.toString();
    this.diagnosticInfo.errorCount = this.diagnosis.getErrorCount();
    this.diagnosticInfo.warningCount = this.diagnosis.getWarningCount();

    return this.diagnosticInfo;
  }

  private performCliChecks(): Array<Promise<void>> {
    return [
      this.checkIfNodeIsInstalled(),
      this.checkIfNpmIsInstalled(),
      this.checkCLIVersion(),
    ];
  }

  private performNetworkingChecks(): Array<Promise<void>> {
    return [this.checkNetworkConnectivity()];
  }

  private performProjectChecks(): Array<Promise<void>> {
    return [
      this.checkIfNpmInstallRequired(),
      this.checkProjectConfigJsonFiles(),
      this.checkIfPortsAreAvailable(),
      this.checkWebhookEndpoints(),
      this.checkAppRedirectUrls(),
      this.checkProjectValidation(),
    ];
  }

  private performCliConfigChecks(): Array<Promise<void>> {
    if (!this.diagnosticInfo?.config) {
      this.diagnosis?.addCLIConfigSection({
        type: 'error',
        message: lib.doctor.diagnosis.cliConfig.noConfigFile,
        secondaryMessaging:
          lib.doctor.diagnosis.cliConfig.noConfigFileSecondary('hs init'),
      });
      return [];
    }

    return [this.checkIfAccessTokenValid()];
  }

  private performDefaultAccountOverrideFileChecks(): void {
    if (this.diagnosticInfo?.defaultAccountOverrideFile) {
      const accounts = getAllConfigAccounts();
      this.diagnosis?.addDefaultAccountOverrideFileSection({
        type: 'warning',
        message: lib.doctor.defaultAccountOverrideFileChecks.overrideActive(
          this.diagnosticInfo.defaultAccountOverrideFile
        ),
      });
      this.diagnosis?.addDefaultAccountOverrideFileSection({
        type: 'warning',
        message: lib.doctor.defaultAccountOverrideFileChecks.overrideAccountId(
          getDefaultAccountOverrideAccountId(accounts)!
        ),
      });
    }
  }

  private performCliConfigSettingsChecks(): void {
    if (this.diagnosticInfo?.configSettings.httpUseLocalhost) {
      this.diagnosis?.addCLIConfigSection({
        type: 'warning',
        message: lib.doctor.diagnosis.cliConfig.settings.httpUseLocalhost,
        secondaryMessaging:
          lib.doctor.diagnosis.cliConfig.settings.httpUseLocalhostSecondary,
      });
    }
  }

  private async checkIfAccessTokenValid(): Promise<void> {
    try {
      await accessTokenForPersonalAccessKey(this.accountId!, true);

      // @TODO Restore PAK scope check functionality once endpoint is fixed
      // const pakScopes = new Set(await scopesOnAccessToken(this.accountId!));
      // const scopeAuthResponse = await fetchScopeAuthorizationData(
      //   this.accountId!
      // );
      // const missingScopes = scopeAuthResponse.data.results.filter(
      //   (data: ScopeGroupAuthorization) =>
      //     data.userAuthorized && !pakScopes.has(data.scopeGroup.name)
      // );

      this.diagnosis?.addCLIConfigSection({
        type: 'success',
        message: lib.doctor.accountChecks.active,
      });

      const linkToPakUI = uiLink(
        lib.doctor.accountChecks.pak.viewScopes,
        `${getHubSpotWebsiteOrigin(
          this.diagnosticInfoBuilder?.env || 'PROD'
        )}/personal-access-key/${this.diagnosticInfo?.account.accountId}`
      );

      // if (missingScopes.length > 0) {
      //   this.diagnosis?.addCLIConfigSection({
      //     type: 'warning',
      //     message: lib.doctor.accountChecks.pak.incomplete,
      //     secondaryMessaging:
      //       lib.doctor.accountChecks.pak.incompleteSecondary(linkToPakUI),
      //   });
      // } else {

      this.diagnosis?.addCLIConfigSection({
        type: 'success',
        message: lib.doctor.accountChecks.pak.valid(linkToPakUI),
      });

      // }
    } catch (error) {
      const portalNotActive =
        isSpecifiedError(error, {
          statusCode: 401,
          category: 'INVALID_AUTHENTICATION',
          subCategory: 'LocalDevAuthErrorType.PORTAL_NOT_ACTIVE',
        }) ||
        isSpecifiedError(error, {
          statusCode: 404,
          category: 'INVALID_AUTHENTICATION',
          subCategory: 'LocalDevAuthErrorType.INVALID_PORTAL_ID',
        });
      if (portalNotActive) {
        this.diagnosis?.addCLIConfigSection({
          type: 'error',
          message: lib.doctor.accountChecks.inactive,
          secondaryMessaging:
            lib.doctor.accountChecks.inactiveSecondary('hs accounts clean'),
        });
      } else if (
        isSpecifiedError(error, {
          statusCode: 401,
          category: 'INVALID_AUTHENTICATION',
          subCategory:
            'LocalDevAuthErrorType.FAILED_TO_SIGN_REFRESH_TOKEN_DECODE',
        })
      ) {
        this.diagnosis?.addCLIConfigSection({
          type: 'success',
          message: lib.doctor.accountChecks.active,
        });
        this.diagnosis?.addCLIConfigSection({
          type: 'error',
          message: lib.doctor.accountChecks.pak.invalid,
          secondaryMessaging: lib.doctor.accountChecks.pak.invalidSecondary,
        });
      } else {
        this.diagnosis?.addCLIConfigSection({
          type: 'error',
          message: lib.doctor.accountChecks.unableToDetermine,
        });
      }
    }
  }

  private async checkIfNodeIsInstalled(): Promise<void> {
    if (!this.diagnosticInfo?.versions.node) {
      return this.diagnosis?.addCliSection({
        type: 'error',
        message: lib.doctor.nodeChecks.unableToDetermine,
      });
    }

    const nodeVersion = this.diagnosticInfo?.versions.node?.split('.');
    const currentNodeMajor = nodeVersion?.[0];

    if (!currentNodeMajor || parseInt(currentNodeMajor) < minMajorNodeVersion) {
      return this.diagnosis?.addCliSection({
        type: 'warning',
        message: lib.doctor.nodeChecks.minimumNotMet(
          this.diagnosticInfo?.versions.node
        ),
      });
    }
    this.diagnosis?.addCliSection({
      type: 'success',
      message: lib.doctor.nodeChecks.success(
        this.diagnosticInfo?.versions.node
      ),
    });
  }

  private async checkIfNpmIsInstalled(): Promise<void> {
    const npmVersion = this.diagnosticInfo?.versions?.npm;
    if (!npmVersion) {
      return this.diagnosis?.addCliSection({
        type: 'error',
        message: lib.doctor.npmChecks.notInstalled,
      });
    }

    this.diagnosis?.addCliSection({
      type: 'success',
      message: lib.doctor.npmChecks.installed(npmVersion),
    });
  }

  private async checkCLIVersion(): Promise<void> {
    const { latest, next } = await getLatestCliVersion();
    const latestCLIVersion = latest;
    const nextCliVersion = next;

    if (!latestCLIVersion || !nextCliVersion) {
      return this.diagnosis?.addCliSection({
        type: 'error',
        message: lib.doctor.hsChecks.unableToDetermine,
        secondaryMessaging: lib.doctor.hsChecks.unableToDetermineSecondary(
          `https://www.npmjs.com/package/${pkg.name}?activeTab=versions`
        ),
      });
    }

    if (latestCLIVersion !== pkg.version && nextCliVersion !== pkg.version) {
      const onNextTag = pkg.version.includes('beta');
      this.diagnosis?.addCliSection({
        type: 'warning',
        message: lib.doctor.hsChecks.notLatest(pkg.version),
        secondaryMessaging: lib.doctor.hsChecks.notLatestSecondary(
          `npm install -g ${pkg.name}`,
          onNextTag ? nextCliVersion : latestCLIVersion
        ),
      });
    } else {
      this.diagnosis?.addCliSection({
        type: 'success',
        message: lib.doctor.hsChecks.latest(pkg.version),
      });
    }
  }

  private async checkIfNpmInstallRequired(): Promise<void> {
    let foundError = false;

    for (const packageFile of this.diagnosticInfo?.packageFiles || []) {
      const packageDirName = path.dirname(packageFile);
      try {
        const needsInstall = await hasMissingPackages(
          path.join(this.projectConfig?.projectDir || '', packageDirName)
        );

        if (needsInstall) {
          foundError = true;

          this.diagnosis?.addProjectSection({
            type: 'warning',
            message:
              lib.doctor.projectDependenciesChecks.missingDependencies(
                packageDirName
              ),
            secondaryMessaging:
              lib.doctor.projectDependenciesChecks.missingDependenciesSecondary(
                'hs project install-deps'
              ),
          });
        }
      } catch (e) {
        foundError = true;

        if (!(await this.isValidJsonFile(packageFile))) {
          this.diagnosis?.addProjectSection({
            type: 'error',
            message: lib.doctor.files.invalidJson(packageFile),
          });
        } else {
          this.diagnosis?.addProjectSection({
            type: 'error',
            message:
              lib.doctor.projectDependenciesChecks.unableToDetermine(
                packageDirName
              ),
          });
        }

        uiLogger.debug(getErrorMessage(e));
      }
    }

    if (!foundError) {
      this.diagnosis?.addProjectSection({
        type: 'success',
        message: lib.doctor.projectDependenciesChecks.success,
      });
    }
  }

  private async isValidJsonFile(filename: string): Promise<boolean> {
    try {
      const readFile = util.promisify(fs.readFile);
      const fileContents = await readFile(filename);
      JSON.parse(fileContents.toString());
    } catch (e) {
      return false;
    }
    return true;
  }

  private async checkProjectConfigJsonFiles(): Promise<void> {
    let foundError = false;
    for (const jsonFile of this.diagnosticInfo?.jsonFiles || []) {
      const fileToCheck = path.join(
        this.projectConfig?.projectDir || '',
        jsonFile
      );
      if (!(await this.isValidJsonFile(fileToCheck))) {
        foundError = true;
        this.diagnosis?.addProjectSection({
          type: 'error',
          message: lib.doctor.files.invalidJson(jsonFile),
        });
      }
    }

    if (!foundError) {
      this.diagnosis?.addProjectSection({
        type: 'success',
        message: lib.doctor.files.validJson,
      });
    }
  }

  private async checkIfPortsAreAvailable(): Promise<void> {
    if (await isPortManagerPortAvailable()) {
      this.diagnosis?.addProjectSection({
        type: 'success',
        message: lib.doctor.port.available(PORT_MANAGER_SERVER_PORT),
      });
      return;
    }

    this.diagnosis?.addProjectSection({
      type: 'warning',
      message: lib.doctor.port.inUse(PORT_MANAGER_SERVER_PORT),
      secondaryMessaging: lib.doctor.port.inUseSecondary,
    });
  }

  private async checkNetworkConnectivity(): Promise<void> {
    const checks = [
      {
        url: getHubSpotApiOrigin(),
        successMessage: lib.doctor.networkChecks.hubspotApiReachable,
        errorMessage: lib.doctor.networkChecks.hubspotApiUnreachable,
        errorSecondary: lib.doctor.networkChecks.hubspotApiUnreachableSecondary,
        errorType: 'error' as const,
      },
      {
        url: 'https://registry.npmjs.org',
        successMessage: lib.doctor.networkChecks.npmRegistryReachable,
        errorMessage: lib.doctor.networkChecks.npmRegistryUnreachable,
        errorSecondary:
          lib.doctor.networkChecks.npmRegistryUnreachableSecondary,
        errorType: 'warning' as const,
      },
    ];

    try {
      const results = await Promise.all(
        checks.map(check => isServerRunningAtUrl(check.url))
      );

      checks.forEach((check, index) => {
        this.diagnosis?.addNetworkingSection({
          type: results[index] ? 'success' : check.errorType,
          message: results[index] ? check.successMessage : check.errorMessage,
          secondaryMessaging: results[index] ? undefined : check.errorSecondary,
        });
      });
    } catch (error) {
      this.diagnosis?.addNetworkingSection({
        type: 'error',
        message: lib.doctor.networkChecks.hubspotApiUnreachable,
        secondaryMessaging:
          lib.doctor.networkChecks.hubspotApiUnreachableSecondary,
      });
      uiLogger.debug(error instanceof Error ? error.message : `${error}`);
    }
  }

  private async checkUrlEndpoints(
    urls: string[],
    successMessage: (url: string) => string,
    errorMessage: (url: string) => string,
    errorSecondary: string,
    checkType: string
  ): Promise<void> {
    const checks = urls.map(async url => {
      try {
        const isReachable = await isServerRunningAtUrl(url);

        this.diagnosis?.addProjectSection({
          type: isReachable ? 'success' : 'warning',
          message: isReachable ? successMessage(url) : errorMessage(url),
          secondaryMessaging: isReachable ? undefined : errorSecondary,
        });
      } catch (error) {
        this.diagnosis?.addProjectSection({
          type: 'warning',
          message: errorMessage(url),
          secondaryMessaging: errorSecondary,
        });
        uiLogger.debug(
          `${checkType} check failed for ${url}: ${error instanceof Error ? error.message : `${error}`}`
        );
      }
    });

    await Promise.allSettled(checks);
  }

  private async checkWebhookEndpoints(): Promise<void> {
    const webhookUrls = await this.extractWebhookUrls();

    if (webhookUrls.length === 0) {
      return;
    }

    await this.checkUrlEndpoints(
      webhookUrls,
      url => lib.doctor.webhookChecks.endpointReachable(url),
      url => lib.doctor.webhookChecks.endpointUnreachable(url),
      lib.doctor.webhookChecks.endpointUnreachableSecondary,
      'Webhook'
    );
  }

  private async extractWebhookUrls(): Promise<string[]> {
    const webhookUrls: string[] = [];

    try {
      // Check project configuration files for webhook URLs
      const hsMetaFiles = this.diagnosticInfo?.hsMetaFiles || [];

      for (const metaFiles of hsMetaFiles) {
        try {
          const content = await fs.promises.readFile(
            path.join(this.projectConfig?.projectDir || '', metaFiles),
            'utf8'
          );
          const contents = JSON.parse(content);

          if (
            contents.type === WEBHOOKS_KEY &&
            contents.config?.settings?.targetUrl
          ) {
            webhookUrls.push(contents.config.settings.targetUrl);
          }
        } catch (error) {}
      }
    } catch (error) {
      uiLogger.debug(
        `Error extracting webhook URLs: ${error instanceof Error ? error.message : `${error}`}`
      );
    }

    // Remove duplicates and return
    return [...new Set(webhookUrls)];
  }

  private async checkAppRedirectUrls(): Promise<void> {
    const redirectUrls = await this.extractAppRedirectUrls();

    if (redirectUrls.length === 0) {
      return;
    }

    await this.checkUrlEndpoints(
      redirectUrls,
      url => lib.doctor.appRedirectChecks.redirectUrlReachable(url),
      url => lib.doctor.appRedirectChecks.redirectUrlUnreachable(url),
      lib.doctor.appRedirectChecks.redirectUrlUnreachableSecondary,
      'App redirect URL'
    );
  }

  private async extractAppRedirectUrls(): Promise<string[]> {
    const redirectUrls: string[] = [];

    try {
      const hsMetaFiles = this.diagnosticInfo?.hsMetaFiles || [];

      for (const metaFile of hsMetaFiles) {
        try {
          const content = await fs.promises.readFile(
            path.join(this.projectConfig?.projectDir || '', metaFile),
            'utf8'
          );
          const contents = JSON.parse(content);

          if (
            contents.type === APP_KEY &&
            Array.isArray(contents.config?.auth?.redirectUrls)
          ) {
            redirectUrls.push(...contents.config?.auth?.redirectUrls);
          }
        } catch (error) {
          // Skip files that can't be read or parsed
        }
      }
    } catch (error) {
      uiLogger.debug(
        `Error extracting app redirect URLs: ${error instanceof Error ? error.message : `${error}`}`
      );
    }

    // Remove duplicates and return
    return [...new Set(redirectUrls)];
  }

  private validateProjectConfigWrapper(
    projectConfig: ProjectConfigType,
    projectDir: string
  ): boolean {
    try {
      validateProjectConfig(projectConfig, projectDir);
      return true;
    } catch (error) {
      this.diagnosis?.addProjectSection({
        type: 'error',
        message: lib.doctor.projectValidation.configInvalid,
        secondaryMessaging: error instanceof Error ? error.message : `${error}`,
      });
      return false;
    }
  }

  private async validateProjectSourceDirectory(
    projectConfig: ProjectConfigType,
    projectDir: string
  ): Promise<boolean> {
    try {
      const srcDir = path.resolve(projectDir, projectConfig.srcDir);
      await validateSourceDirectory(srcDir, projectConfig, projectDir);
      return true;
    } catch (error) {
      this.diagnosis?.addProjectSection({
        type: 'error',
        message: lib.doctor.projectValidation.sourceDirectoryInvalid,
        secondaryMessaging: error instanceof Error ? error.message : `${error}`,
      });
      return false;
    }
  }

  private async validateProfiles(
    profiles: string[],
    projectConfig: ProjectConfigType,
    projectDir: string
  ): Promise<boolean> {
    let validationSucceeded = true;

    for (const profileName of profiles) {
      const validationErrors = await validateProjectForProfile({
        projectConfig,
        projectDir,
        profileName,
        derivedAccountId: this.accountId!,
        indentSpinners: false,
        silent: true,
      });

      if (validationErrors.length > 0) {
        validationSucceeded = false;
        this.diagnosis?.addProjectSection({
          type: 'error',
          message:
            lib.doctor.projectValidation.profileValidationFailed(profileName),
          secondaryMessaging: lib.doctor.projectValidation.validationDetails,
        });
      }
    }

    return validationSucceeded;
  }

  private async validateProjectWithoutProfile(
    projectConfig: ProjectConfigType,
    projectDir: string
  ): Promise<boolean> {
    try {
      await handleTranslate({
        projectDir,
        projectConfig,
        accountId: this.accountId!,
        skipValidation: false,
      });
      return true;
    } catch (error) {
      this.diagnosis?.addProjectSection({
        type: 'warning',
        message: lib.doctor.projectValidation.translationFailed,
        secondaryMessaging: lib.doctor.projectValidation.validationDetails,
      });
      return false;
    }
  }

  private async checkProjectValidation(): Promise<void> {
    if (
      !this.projectConfig?.projectConfig ||
      !this.projectConfig?.projectDir ||
      !this.accountId
    ) {
      return;
    }

    const { projectConfig, projectDir } = this.projectConfig;

    try {
      if (!this.validateProjectConfigWrapper(projectConfig, projectDir)) {
        return;
      }

      if (!isV2Project(projectConfig.platformVersion)) {
        this.diagnosis?.addProjectSection({
          type: 'success',
          message: lib.doctor.projectValidation.valid,
        });
        return;
      }

      if (
        !(await this.validateProjectSourceDirectory(projectConfig, projectDir))
      ) {
        return;
      }

      const profiles = await getAllHsProfiles(
        path.join(projectDir, projectConfig.srcDir)
      );

      const validationSucceeded =
        profiles.length > 0
          ? await this.validateProfiles(profiles, projectConfig, projectDir)
          : await this.validateProjectWithoutProfile(projectConfig, projectDir);

      if (validationSucceeded) {
        this.diagnosis?.addProjectSection({
          type: 'success',
          message: lib.doctor.projectValidation.valid,
        });
      }
    } catch (error) {
      this.diagnosis?.addProjectSection({
        type: 'error',
        message: lib.doctor.projectValidation.configInvalid,
        secondaryMessaging: error instanceof Error ? error.message : `${error}`,
      });
    }
  }
}
