import { uiLogger } from '../ui/logger.js';
import {
  getAccountId,
  getCWDAccountOverride,
} from '@hubspot/local-dev-lib/config';

import SpinniesManager from '../ui/SpinniesManager.js';
import { hasMissingPackages } from '../dependencyManagement.js';
import { getLatestCliVersion } from '../npm.js';
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
  authorizedScopesForPortalAndUser,
  scopesOnAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import { ScopeGroupAuthorization } from '@hubspot/local-dev-lib/types/Accounts';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import pkg from '../../package.json' with { type: 'json' };

import { lib } from '../../lang/en.js';
import { uiLink } from '../ui/index.js';
const minMajorNodeVersion = 18;

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
    SpinniesManager.init();
    this.accountId = getAccountId();
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

  private performProjectChecks(): Array<Promise<void>> {
    return [
      this.checkIfNpmInstallRequired(),
      this.checkProjectConfigJsonFiles(),
      this.checkIfPortsAreAvailable(),
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
      this.diagnosis?.addDefaultAccountOverrideFileSection({
        type: 'warning',
        message: lib.doctor.defaultAccountOverrideFileChecks.overrideActive(
          this.diagnosticInfo.defaultAccountOverrideFile
        ),
      });
      this.diagnosis?.addDefaultAccountOverrideFileSection({
        type: 'warning',
        message: lib.doctor.defaultAccountOverrideFileChecks.overrideAccountId(
          getCWDAccountOverride()!
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

      const pakScopes = new Set(await scopesOnAccessToken(this.accountId!));
      const missingScopes = (
        await authorizedScopesForPortalAndUser(this.accountId!)
      ).filter(
        (data: ScopeGroupAuthorization) =>
          data.userAuthorized && !pakScopes.has(data.scopeGroup.name)
      );

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

      if (missingScopes.length > 0) {
        this.diagnosis?.addCLIConfigSection({
          type: 'warning',
          message: lib.doctor.accountChecks.pak.incomplete,
          secondaryMessaging:
            lib.doctor.accountChecks.pak.incompleteSecondary(linkToPakUI),
        });
      } else {
        this.diagnosis?.addCLIConfigSection({
          type: 'success',
          message: lib.doctor.accountChecks.pak.valid(linkToPakUI),
        });
      }
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
    let latestCLIVersion;
    let nextCliVersion;

    try {
      const { latest, next } = await getLatestCliVersion();
      latestCLIVersion = latest;
      nextCliVersion = next;
    } catch (e) {
      return this.diagnosis?.addCliSection({
        type: 'error',
        message: lib.doctor.hsChecks.unableToDetermine,
        secondaryMessaging: lib.doctor.hsChecks.unableToDetermineSecondary(
          'hs --version',
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

        uiLogger.debug(e instanceof Error ? e.message : String(e));
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
      secondaryMessaging: lib.doctor.port.inUseSecondary('hs project dev'),
    });
  }
}
