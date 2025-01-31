import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountId } from '@hubspot/local-dev-lib/config';

import SpinniesManager from '../ui/SpinniesManager';
import {
  getLatestCliVersion,
  hasMissingPackages,
} from '../dependencyManagement';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { Diagnosis } from './Diagnosis';
import {
  DiagnosticInfoBuilder,
  DiagnosticInfo,
  ProjectConfig,
} from './DiagnosticInfoBuilder';
import { isPortManagerPortAvailable } from '@hubspot/local-dev-lib/portManager';
import { PORT_MANAGER_SERVER_PORT } from '@hubspot/local-dev-lib/constants/ports';
import { accessTokenForPersonalAccessKey } from '@hubspot/local-dev-lib/personalAccessKey';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { uiCommandReference } from '../ui';
import pkg from '../../package.json';
import { doctor } from '../../lang/constants';

const { uiLink } = require('../ui');
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
      text: doctor.runningDiagnostics,
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

    SpinniesManager.succeed('runningDiagnostics', {
      text: doctor.diagnosticsComplete,
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
        message: doctor.diagnosis.cliConfig.noConfigFile,
        secondaryMessaging: doctor.diagnosis.cliConfig.noConfigFileSecondary(
          uiCommandReference('hs init')
        ),
      });
      return [];
    }
    return [this.checkIfAccessTokenValid()];
  }

  private async checkIfAccessTokenValid(): Promise<void> {
    try {
      await accessTokenForPersonalAccessKey(this.accountId!, true);
      this.diagnosis?.addCLIConfigSection({
        type: 'success',
        message: doctor.accountChecks.active,
      });
      this.diagnosis?.addCLIConfigSection({
        type: 'success',
        message: doctor.pak.valid(
          uiLink(
            doctor.pak.viewScopes,
            `${getHubSpotWebsiteOrigin(
              this.diagnosticInfoBuilder?.env || 'PROD'
            )}/personal-access-key/${this.diagnosticInfo?.account.accountId}`
          )
        ),
      });
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
          message: doctor.accountChecks.inactive,
          secondaryMessaging: doctor.accountChecks.inactiveSecondary(
            uiCommandReference(`hs accounts clean`)
          ),
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
          message: doctor.accountChecks.active,
        });
        this.diagnosis?.addCLIConfigSection({
          type: 'error',
          message: doctor.pak.invalid,
          secondaryMessaging: doctor.pak.invalidSecondary(
            uiCommandReference(`hs auth`)
          ),
        });
      } else {
        this.diagnosis?.addCLIConfigSection({
          type: 'error',
          message: doctor.accountChecks.unableToDetermine,
        });
      }
    }
  }

  private async checkIfNodeIsInstalled(): Promise<void> {
    if (!this.diagnosticInfo?.versions.node) {
      return this.diagnosis?.addCliSection({
        type: 'error',
        message: doctor.nodeChecks.unableToDetermine,
      });
    }

    const nodeVersion = this.diagnosticInfo?.versions.node?.split('.');
    const currentNodeMajor = nodeVersion?.[0];

    if (!currentNodeMajor || parseInt(currentNodeMajor) < minMajorNodeVersion) {
      return this.diagnosis?.addCliSection({
        type: 'warning',
        message: doctor.nodeChecks.minimumNotMet(
          this.diagnosticInfo?.versions.node
        ),
      });
    }
    this.diagnosis?.addCliSection({
      type: 'success',
      message: doctor.nodeChecks.success(this.diagnosticInfo?.versions.node),
    });
  }

  private async checkIfNpmIsInstalled(): Promise<void> {
    const npmVersion = this.diagnosticInfo?.versions?.npm;
    if (!npmVersion) {
      return this.diagnosis?.addCliSection({
        type: 'error',
        message: doctor.npmChecks.notInstalled,
      });
    }

    this.diagnosis?.addCliSection({
      type: 'success',
      message: doctor.npmChecks.installed(npmVersion),
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
        message: doctor.hsChecks.unableToDetermine,
        secondaryMessaging: doctor.hsChecks.unableToDetermineSecondary(
          uiCommandReference(`hs --version`),
          uiLink(
            doctor.hsChecks.unableToDetermineSecondaryLink,
            `https://www.npmjs.com/package/${pkg.name}?activeTab=versions`
          )
        ),
      });
    }

    if (latestCLIVersion !== pkg.version && nextCliVersion !== pkg.version) {
      const onNextTag = pkg.version.includes('beta');
      this.diagnosis?.addCliSection({
        type: 'warning',
        message: doctor.hsChecks.notLatest(latestCLIVersion),
        secondaryMessaging: doctor.hsChecks.notLatestSecondary(
          uiCommandReference(`npm install -g ${pkg.name}`),
          onNextTag ? nextCliVersion : latestCLIVersion
        ),
      });
    } else {
      this.diagnosis?.addCliSection({
        type: 'success',
        message: doctor.hsChecks.latest(latestCLIVersion),
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
              doctor.projectDependencyChecks.missingDependencies(
                packageDirName
              ),
            secondaryMessaging:
              doctor.projectDependencyChecks.missingDependenciesSecondary(
                uiCommandReference('hs project install-deps')
              ),
          });
        }
      } catch (e) {
        foundError = true;

        if (!(await this.isValidJsonFile(packageFile))) {
          this.diagnosis?.addProjectSection({
            type: 'error',
            message: doctor.files.invalidJson(packageFile),
          });
        } else {
          this.diagnosis?.addProjectSection({
            type: 'error',
            message:
              doctor.projectDependencyChecks.unableToDetermine(packageDirName),
          });
        }

        logger.debug(e);
      }
    }

    if (!foundError) {
      this.diagnosis?.addProjectSection({
        type: 'success',
        message: doctor.projectDependencyChecks.success,
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
          message: doctor.files.invalidJson(fileToCheck),
        });
      }
    }

    if (!foundError) {
      this.diagnosis?.addProjectSection({
        type: 'success',
        message: doctor.files.validJson,
      });
    }
  }

  private async checkIfPortsAreAvailable(): Promise<void> {
    if (await isPortManagerPortAvailable()) {
      this.diagnosis?.addProjectSection({
        type: 'success',
        message: doctor.port.available(PORT_MANAGER_SERVER_PORT),
      });
      return;
    }

    this.diagnosis?.addProjectSection({
      type: 'warning',
      message: doctor.port.inUse(PORT_MANAGER_SERVER_PORT),
      secondaryMessaging: doctor.port.inUseSecondary(
        uiCommandReference('hs project dev')
      ),
    });
  }
}
