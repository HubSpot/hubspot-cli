import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountId } from '../commonOpts';

import SpinniesManager from '../ui/SpinniesManager';
import { packagesNeedInstalled } from '../dependencyManagement';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { cyan } from 'chalk';
import { Diagnosis } from './Diagnosis';
import {
  DiagnosticInfoBuilder,
  DiagnosticInfo,
  ProjectConfig,
} from './DiagnosticInfoBuilder';
import { isPortManagerServerRunning } from '@hubspot/local-dev-lib/portManager';
import { PORT_MANAGER_SERVER_PORT } from '@hubspot/local-dev-lib/constants/ports';
import { accessTokenForPersonalAccessKey } from '@hubspot/local-dev-lib/personalAccessKey';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
const { i18n } = require('../lang');
const { uiLink } = require('../ui');

const minMajorNodeVersion = 18;

const i18nKey = `lib.doctor`;

export class Doctor {
  accountId: number | null;
  private diagnosis?: Diagnosis;
  private projectConfig?: ProjectConfig;
  private diagnosticInfo?: DiagnosticInfo;
  private diagnosticInfoBuilder?: DiagnosticInfoBuilder;

  constructor() {
    SpinniesManager.init();
    this.accountId = getAccountId();
  }

  async diagnose() {
    SpinniesManager.add('runningDiagnostics', {
      text: i18n(`${i18nKey}.runningDiagnostics`),
    });

    this.diagnosticInfoBuilder = new DiagnosticInfoBuilder();
    this.diagnosticInfo = await this.diagnosticInfoBuilder.generateDiagnosticInfo();

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
      text: i18n(`${i18nKey}.diagnosticsComplete`),
      succeedColor: 'white',
    });

    this.diagnosticInfo!.diagnosis = this.diagnosis.toString();

    return this.diagnosticInfo;
  }

  private performCliChecks(): Array<Promise<void>> {
    return [this.checkIfNodeIsInstalled(), this.checkIfNpmIsInstalled()];
  }

  private performProjectChecks(): Array<Promise<void>> {
    return [
      this.checkIfNpmInstallRequired(),
      this.checkProjectConfigJsonFiles(),
      this.checkIfPortsAreAvailable(),
    ];
  }

  private performCliConfigChecks(): Array<Promise<void>> {
    return [this.checkIfAccessTokenValid()];
  }

  private async checkIfAccessTokenValid(): Promise<void> {
    const localI18nKey = `${i18nKey}.accountChecks`;
    try {
      await accessTokenForPersonalAccessKey(this.accountId!, true);
      this.diagnosis?.addCLIConfigSection({
        type: 'success',
        message: i18n(`${localI18nKey}.active`),
      });
      this.diagnosis?.addCLIConfigSection({
        type: 'success',
        message: i18n(`${localI18nKey}.pak.valid`, {
          link: uiLink(
            i18n(`${localI18nKey}.pak.viewScopes`),
            `${getHubSpotWebsiteOrigin(
              this.diagnosticInfoBuilder?.env || 'PROD'
            )}/personal-access-key/${this.diagnosticInfo?.account.accountId}`
          ),
        }),
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
          message: i18n(`${localI18nKey}.inactive`),
          secondaryMessaging: i18n(`${localI18nKey}.inactiveSecondary`),
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
          message: i18n(`${localI18nKey}.active`),
        });
        this.diagnosis?.addCLIConfigSection({
          type: 'error',
          message: i18n(`${localI18nKey}.pak.invalid`),
        });
      } else {
        this.diagnosis?.addCLIConfigSection({
          type: 'error',
          message: i18n(`${localI18nKey}.unableToDetermine`),
        });
      }
    }
  }

  private async checkIfNodeIsInstalled() {
    const localI18nKey = `${i18nKey}.nodeChecks`;
    try {
      if (!this.diagnosticInfo?.versions.node) {
        return this.diagnosis?.addCliSection({
          type: 'error',
          message: i18n(`${localI18nKey}.unableToDetermine`),
        });
      }

      const nodeVersion = this.diagnosticInfo?.versions.node?.split('.');
      const currentNodeMajor = nodeVersion?.[0];

      if (
        !currentNodeMajor ||
        parseInt(currentNodeMajor) < minMajorNodeVersion
      ) {
        return this.diagnosis?.addCliSection({
          type: 'warning',
          message: i18n(`${localI18nKey}.minimumNotMet`, {
            nodeVersion: this.diagnosticInfo?.versions.node,
          }),
        });
      }
      this.diagnosis?.addCliSection({
        type: 'success',
        message: i18n(`${localI18nKey}.success`, {
          nodeVersion: this.diagnosticInfo?.versions.node,
        }),
      });
    } catch (e) {
      this.diagnosis?.addCliSection({
        type: 'error',
        message: i18n(`${localI18nKey}.unableToDetermine`),
      });
      logger.debug(e);
    }
  }

  private async checkIfNpmIsInstalled() {
    const localI18nKey = `${i18nKey}.npmChecks`;
    try {
      const npmVersion = this.diagnosticInfo?.versions?.npm;
      if (!npmVersion) {
        return this.diagnosis?.addCliSection({
          type: 'error',
          message: i18n(`${localI18nKey}.notInstalled`),
        });
      }

      this.diagnosis?.addCliSection({
        type: 'success',
        message: i18n(`${localI18nKey}.installed`, {
          npmVersion,
        }),
      });
    } catch (e) {
      this.diagnosis?.addCliSection({
        type: 'error',
        message: i18n(`${localI18nKey}.unableToDetermine`),
      });
      logger.debug(e);
    }
  }

  private async checkIfNpmInstallRequired() {
    let foundError = false;
    const localI18nKey = `${i18nKey}.projectDependenciesChecks`;

    for (const packageFile of this.diagnosticInfo?.packageFiles || []) {
      const packageDirName = path.dirname(packageFile);
      try {
        const needsInstall = await packagesNeedInstalled(
          path.join(this.projectConfig?.projectDir, packageDirName)
        );

        if (needsInstall) {
          foundError = true;

          this.diagnosis?.addProjectSection({
            type: 'warning',
            message: i18n(`${localI18nKey}.missingDependencies`, {
              dir: packageDirName,
            }),
            secondaryMessaging: i18n(
              `${localI18nKey}.missingDependenciesSecondary`
            ),
          });
        }
      } catch (e) {
        foundError = true;

        if (!(await this.isValidJsonFile(packageFile))) {
          this.diagnosis?.addProjectSection({
            type: 'error',
            message: i18n(`${i18nKey}.files.invalidJson`, {
              filename: packageFile,
            }),
          });
        } else {
          this.diagnosis?.addProjectSection({
            type: 'error',
            message: i18n(`${localI18nKey}.unableToDetermine`, {
              dir: packageDirName,
            }),
          });
        }

        logger.debug(e);
      }
    }

    if (!foundError) {
      this.diagnosis?.addProjectSection({
        type: 'success',
        message: i18n(`${localI18nKey}.success`),
      });
    }
  }

  private async isValidJsonFile(filename: string) {
    try {
      const readFile = util.promisify(fs.readFile);
      const fileContents = await readFile(filename);
      JSON.parse(fileContents.toString());
    } catch (e) {
      return false;
    }
    return true;
  }

  private async checkProjectConfigJsonFiles() {
    let foundError = false;
    for (const jsonFile of this.diagnosticInfo?.configFiles || []) {
      const fileToCheck = path.join(this.projectConfig?.projectDir, jsonFile);
      if (!(await this.isValidJsonFile(fileToCheck))) {
        foundError = true;
        this.diagnosis?.addProjectSection({
          type: 'error',
          message: `invalid JSON in ${cyan(jsonFile)}`,
        });
      }
    }

    if (!foundError) {
      this.diagnosis?.addProjectSection({
        type: 'success',
        message: `Config files are valid JSON`,
      });
    }
  }

  private async checkIfPortsAreAvailable() {
    if (await isPortManagerServerRunning()) {
      this.diagnosis?.addProjectSection({
        type: 'warning',
        message: `Port ${PORT_MANAGER_SERVER_PORT} is in use`,
        secondaryMessaging:
          'Make sure it is available if before running `hs project dev`',
      });
    } else {
      this.diagnosis?.addProjectSection({
        type: 'success',
        message: `Port ${PORT_MANAGER_SERVER_PORT} available for local development`,
      });
    }
  }
}
