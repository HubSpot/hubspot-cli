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
import {
  accessTokenForPersonalAccessKey,
  authorizedScopesForPortalAndUser,
  scopesOnAccessToken,
} from '@hubspot/local-dev-lib/personalAccessKey';
import { isSpecifiedError } from '@hubspot/local-dev-lib/errors/index';
import { getHubSpotWebsiteOrigin } from '@hubspot/local-dev-lib/urls';
import { uiCommandReference } from '../ui';
import pkg from '../../package.json';

const { i18n } = require('../lang');
const { uiLink } = require('../ui');
const minMajorNodeVersion = 18;

const i18nKey = `lib.doctor`;

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
      text: i18n(`${i18nKey}.runningDiagnostics`),
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
      text: i18n(`${i18nKey}.diagnosticsComplete`),
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
        message: i18n(`${i18nKey}.diagnosis.cliConfig.noConfigFile`),
        secondaryMessaging: i18n(
          `${i18nKey}.diagnosis.cliConfig.noConfigFileSecondary`,
          {
            command: uiCommandReference('hs init'),
          }
        ),
      });
      return [];
    }
    return [this.checkIfAccessTokenValid()];
  }

  private async checkIfAccessTokenValid(): Promise<void> {
    const localI18nKey = `${i18nKey}.accountChecks`;
    try {
      await accessTokenForPersonalAccessKey(this.accountId!, true);
      const pakScopes = new Set(await scopesOnAccessToken(this.accountId!));
      const missingScopes = (
        await authorizedScopesForPortalAndUser(this.accountId!)
      )
        .filter(
          data => data.userAuthorized && !pakScopes.has(data.scopeGroup.name)
        )
        .map(data => data.scopeGroup.name);

      this.diagnosis?.addCLIConfigSection({
        type: 'success',
        message: i18n(`${localI18nKey}.active`),
      });

      if (missingScopes.length > 0) {
        this.diagnosis?.addCLIConfigSection({
          type: 'warning',
          message: i18n(
            `${localI18nKey}.pak.incomplete${missingScopes.length == 1 ? '.one' : '.other'}`,
            {
              count: missingScopes.length,
            }
          ),
          secondaryMessaging: i18n(`${localI18nKey}.pak.incompleteSecondary`, {
            link: uiLink(
              i18n(`${localI18nKey}.pak.viewScopes`),
              `${getHubSpotWebsiteOrigin(
                this.diagnosticInfoBuilder?.env || 'PROD'
              )}/personal-access-key/${this.diagnosticInfo?.account.accountId}`
            ),
          }),
        });
      } else {
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
          message: i18n(`${localI18nKey}.inactive`),
          secondaryMessaging: i18n(`${localI18nKey}.inactiveSecondary`, {
            command: uiCommandReference(`hs accounts clean`),
          }),
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
          secondaryMessaging: i18n(`${localI18nKey}.pak.invalidSecondary`, {
            command: uiCommandReference(`hs auth`),
          }),
        });
      } else {
        this.diagnosis?.addCLIConfigSection({
          type: 'error',
          message: i18n(`${localI18nKey}.unableToDetermine`),
        });
      }
    }
  }

  private async checkIfNodeIsInstalled(): Promise<void> {
    const localI18nKey = `${i18nKey}.nodeChecks`;
    if (!this.diagnosticInfo?.versions.node) {
      return this.diagnosis?.addCliSection({
        type: 'error',
        message: i18n(`${localI18nKey}.unableToDetermine`),
      });
    }

    const nodeVersion = this.diagnosticInfo?.versions.node?.split('.');
    const currentNodeMajor = nodeVersion?.[0];

    if (!currentNodeMajor || parseInt(currentNodeMajor) < minMajorNodeVersion) {
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
  }

  private async checkIfNpmIsInstalled(): Promise<void> {
    const localI18nKey = `${i18nKey}.npmChecks`;
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
        message: i18n(`${i18nKey}.hsChecks.unableToDetermine`),
        secondaryMessaging: i18n(
          `${i18nKey}.hsChecks.unableToDetermineSecondary`,
          {
            command: uiCommandReference(`hs --version`),
            link: uiLink(
              i18n(`${i18nKey}.hsChecks.unableToDetermineSecondaryLink`),
              `https://www.npmjs.com/package/${pkg.name}?activeTab=versions`
            ),
          }
        ),
      });
    }

    if (latestCLIVersion !== pkg.version && nextCliVersion !== pkg.version) {
      const onNextTag = pkg.version.includes('beta');
      this.diagnosis?.addCliSection({
        type: 'warning',
        message: i18n(`${i18nKey}.hsChecks.notLatest`, {
          hsVersion: pkg.version,
        }),
        secondaryMessaging: i18n(`${i18nKey}.hsChecks.notLatestSecondary`, {
          hsVersion: onNextTag ? nextCliVersion : latestCLIVersion,
          command: uiCommandReference(`npm install -g ${pkg.name}`),
        }),
      });
    } else {
      this.diagnosis?.addCliSection({
        type: 'success',
        message: i18n(`${i18nKey}.hsChecks.latest`, {
          hsVersion: latestCLIVersion,
        }),
      });
    }
  }

  private async checkIfNpmInstallRequired(): Promise<void> {
    let foundError = false;
    const localI18nKey = `${i18nKey}.projectDependenciesChecks`;

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
            message: i18n(`${localI18nKey}.missingDependencies`, {
              dir: packageDirName,
            }),
            secondaryMessaging: i18n(
              `${localI18nKey}.missingDependenciesSecondary`,
              {
                command: uiCommandReference('hs project install-deps'),
              }
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
          message: i18n(`${i18nKey}.files.invalidJson`, {
            filename: jsonFile,
          }),
        });
      }
    }

    if (!foundError) {
      this.diagnosis?.addProjectSection({
        type: 'success',
        message: i18n(`${i18nKey}.files.validJson`),
      });
    }
  }

  private async checkIfPortsAreAvailable(): Promise<void> {
    const localI18nKey = `${i18nKey}.port`;

    if (await isPortManagerPortAvailable()) {
      this.diagnosis?.addProjectSection({
        type: 'success',
        message: i18n(`${localI18nKey}.available`, {
          port: PORT_MANAGER_SERVER_PORT,
        }),
      });
      return;
    }

    this.diagnosis?.addProjectSection({
      type: 'warning',
      message: i18n(`${localI18nKey}.inUse`, {
        port: PORT_MANAGER_SERVER_PORT,
      }),
      secondaryMessaging: i18n(`${localI18nKey}.inUseSecondary`, {
        command: uiCommandReference('hs project dev'),
      }),
    });
  }
}
