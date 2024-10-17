import { logger } from '@hubspot/local-dev-lib/logger';
import { getAccountId } from '../commonOpts';

import SpinniesManager from '../ui/SpinniesManager';
import {
  isGloballyInstalled,
  packagesNeedInstalled,
} from '../dependencyManagement';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { cyan } from 'chalk';
import { orange } from '../interpolationHelpers';
import { Diagnosis } from './Diagnosis';
import {
  DiagnosticInfo,
  DiagnosticInfoBuilder,
  ProjectConfig,
} from './DiagnosticInfo';
import { getConfigPath } from '@hubspot/local-dev-lib/config';

const minMajorNodeVersion = 18;

export class Doctor {
  accountId: number | null;
  private diagnosis?: Diagnosis;
  private projectConfig?: ProjectConfig;
  private diagnosticInfo?: DiagnosticInfo;

  constructor() {
    SpinniesManager.init();
    this.accountId = getAccountId();
  }

  async diagnose() {
    SpinniesManager.add('runningDiagnostics', {
      text: 'Running diagnostics...',
    });

    this.diagnosticInfo = await new DiagnosticInfoBuilder().generateDiagnosticInfo();
    this.projectConfig = this.diagnosticInfo?.project.config;

    this.diagnosis = new Diagnosis({
      diagnosticInfo: this.diagnosticInfo,
      accountId: this.accountId,
    });

    await Promise.all([
      ...this.performCliChecks(),
      ...this.performCliConfigChecks(),
      ...this.performProjectChecks(),
    ]);

    SpinniesManager.succeed('runningDiagnostics', {
      text: 'Diagnostics successful...',
    });

    this.diagnosticInfo!.diagnosis = this.diagnosis.toString();

    return this.diagnosticInfo;
  }

  performCliChecks(): Array<Promise<void>> {
    return [this.checkIfNodeIsInstalled(), this.checkIfNpmIsInstalled()];
  }

  performProjectChecks(): Array<Promise<void>> {
    return [this.checkIfNpmInstallRequired(), this.validateProjectJsonFiles()];
  }

  performCliConfigChecks(): Array<Promise<void>> {
    return [];
  }

  async checkIfNodeIsInstalled() {
    try {
      if (!this.diagnosticInfo?.versions.node) {
        return this.diagnosis?.addCliSection({
          type: 'error',
          message: 'Unable to determine what version of node is installed',
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
          message: `Minimum Node version is not met, ${this.diagnosticInfo?.versions.node}`,
        });
      }
      this.diagnosis?.addCliSection({
        type: 'success',
        message: `node v${this.diagnosticInfo?.versions.node} is installed`,
      });
    } catch (e) {
      this.diagnosis?.addCliSection({
        type: 'error',
        message: 'Unable to determine if node is installed',
      });
      logger.debug(e);
    }
  }

  async checkIfNpmIsInstalled() {
    try {
      if (!this.diagnosticInfo?.versions?.npm) {
        return this.diagnosis?.addCliSection({
          type: 'error',
          message: 'npm is not installed',
        });
      }

      this.diagnosis?.addCliSection({
        type: 'success',
        message: `npm v${this.diagnosticInfo?.versions?.npm} is installed`,
      });
    } catch (e) {
      this.diagnosis?.addCliSection({
        type: 'error',
        message: 'Unable to determine if npm is installed',
      });
      logger.debug(e);
    }
  }

  async checkIfNpmInstallRequired() {
    let foundError = false;

    for (const packageFile of this.diagnosticInfo?.packageFiles || []) {
      const packageDirName = path.dirname(packageFile);
      try {
        const needsInstall = await packagesNeedInstalled(
          path.join(this.projectConfig?.projectDir!, packageDirName)
        );

        if (needsInstall) {
          foundError = true;
          this.diagnosis?.addProjectSection({
            type: 'warning',
            message: `missing dependencies in ${cyan(packageDirName)}`,
            secondaryMessaging: `Run ${orange(
              '`hs project install-deps`'
            )} to install all project dependencies locally`,
          });
        }
      } catch (e) {
        foundError = true;
        if (!(await this.isValidJsonFile(packageFile))) {
          this.diagnosis?.addProjectSection({
            type: 'error',
            message: `invalid JSON in ${cyan(packageDirName)}`,
          });
        } else {
          this.diagnosis?.addProjectSection({
            type: 'error',
            message: `Unable to determine if dependencies are installed ${packageDirName}`,
          });
        }
        logger.debug(e);
      }
    }

    if (!foundError) {
      this.diagnosis?.addProjectSection({
        type: 'success',
        message: `App dependencies are installed an up to date`,
      });
    }
  }

  async isValidJsonFile(filename: string) {
    const readFile = util.promisify(fs.readFile);
    try {
      const fileContents = await readFile(filename);
      JSON.parse(fileContents.toString());
    } catch (e) {
      return false;
    }
    return true;
  }

  async validateProjectJsonFiles() {
    let foundError = false;
    for (const jsonFile of this.diagnosticInfo?.configFiles || []) {
      try {
        if (
          !(await this.isValidJsonFile(
            path.join(this.projectConfig?.projectDir!, jsonFile)
          ))
        ) {
          foundError = true;
          this.diagnosis?.addProjectSection({
            type: 'error',
            message: `invalid JSON in ${cyan(jsonFile)}`,
          });
        }
      } catch (e) {
        logger.debug(e);
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
}
