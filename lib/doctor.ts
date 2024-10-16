import { exec as execAsync } from 'child_process';
import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import { getAccountId } from './commonOpts';
import { getProjectConfig } from './projects';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';

import pkg from '../package.json';
import { walk } from '@hubspot/local-dev-lib/fs';
import SpinniesManager from './ui/SpinniesManager';
import {
  isGloballyInstalled,
  packagesNeedInstalled,
} from './dependencyManagement';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { prefixOptions } from './ui/spinniesUtils';
import { red, green, cyan, bold } from 'chalk';
import { orange } from './interpolationHelpers';

const minMajorNodeVersion = 18;

export class Diagnosis {
  constructor({ configFilePath, defaultAccount, projectDir, projectName }) {
    const { succeedPrefix, failPrefix } = prefixOptions({});
    this.succeedPrefix = green(succeedPrefix);
    this.failPrefix = red(failPrefix);
    this.warnPrefix = orange('!');
    this.diagnosis = {
      cli: {
        header: 'HubSpot CLI install',
        sections: [],
      },
      cliConfig: {
        header: 'CLI configuration',
        subheaders: [],
        sections: [],
      },
      project: {
        header: 'Project configuration',
        subheaders: [
          `Project dir: ${cyan(projectDir)}`,
          `Project name: ${cyan(projectName)}`,
        ],
        sections: [],
      },
    };
  }

  addCliSection(cliError) {
    this.diagnosis.cli.sections.push(cliError);
  }

  addProjectError(cliError) {
    this.diagnosis.project.sections.push(cliError);
  }

  addCLIConfigError(cliError) {
    this.diagnosis.cliConfig.sections.push(cliError);
  }

  toString() {
    const output = [];
    for (const [__key, value] of Object.entries(this.diagnosis)) {
      output.push(this.generateSections(value));
    }

    return output.join('\n');
  }

  generateSections(section) {
    const output = [];

    if (section.sections && section.sections.length === 0) {
      return '';
    }

    output.push(`\n${bold(section.header)}`);

    (section.subheaders || []).forEach(subheader => {
      output.push(`${subheader}`);
    });

    section.sections.forEach(error => {
      output.push(`    ${this.failPrefix} ${error.message}`);
      if (error.secondaryMessaging) {
        output.push(`      - ${error.secondaryMessaging}`);
      }
    });

    return output.join('\n');
  }
}

export class Doctor {
  constructor() {
    SpinniesManager.init();
    this.accountId = getAccountId();
    const accountConfig = getAccountConfig(this.accountId);
    this.env = accountConfig?.env;
    this.authType = accountConfig?.authType;
    this.accountType = accountConfig?.accountType;
    this.personalAccessKey = accountConfig?.personalAccessKey;
  }

  async diagnose() {
    SpinniesManager.add('runningDiagnostics', {
      text: 'Running diagnostics...',
    });

    this.projectConfig = await getProjectConfig();

    if (this.projectConfig?.projectConfig) {
      await this.fetchProjectDetails();
      await this.getAccessToken();
      await this.loadProjectFiles();
    }

    this.diagnosticInfo = await this.gatherDiagnosticInfo();

    this.diagnosis = new Diagnosis({
      projectDir: this.projectConfig?.projectDir,
      projectName: this.projectConfig?.projectConfig?.name,
    });

    await Promise.all([
      this.checkIfNodeIsInstalled(),
      this.checkIfNpmIsInstalled(),
      ...this.checkIfNpmInstallRequired(),
      ...this.validateProjectJsonFiles(),
    ]);

    SpinniesManager.succeed('runningDiagnostics', {
      text: 'Diagnostics successful...',
    });

    this.diagnosticInfo.diagnosis = this.diagnosis.toString();

    return this.diagnosticInfo;
  }

  async checkIfNodeIsInstalled() {
    try {
      if (!this.diagnosticInfo.versions.node) {
        this.diagnosis.addCliSection({
          type: 'error',
          message: 'Unable to determine what version of node is installed',
        });
      }

      const [currentNodeMajor] = this.diagnosticInfo.versions.node.split('.');

      if (parseInt(currentNodeMajor) < minMajorNodeVersion) {
        this.diagnosis.addCliSection({
          type: 'error',
          message: `Minimum Node version is not met, ${this.diagnosticInfo.versions.node}`,
        });
      }
    } catch (e) {
      this.diagnosis.addCliSection({
        type: 'error',
        message: 'Unable to determine if node is installed',
      });
      logger.debug(e);
    }
  }

  async checkIfNpmIsInstalled() {
    try {
      const npmInstalled = await isGloballyInstalled('npm');
      if (!npmInstalled) {
        this.diagnosis.addCliSection({
          type: 'error',
          message: 'npm is not installed',
        });
      }
    } catch (e) {
      this.diagnosis.addCliSection({
        type: 'error',
        message: 'Unable to determine if npm is installed',
      });
      logger.debug(e);
    }
  }

  checkIfNpmInstallRequired() {
    const checks = [];
    for (const packageFile of this.diagnosticInfo?.packageFiles || []) {
      const packageDirName = path.dirname(packageFile);
      checks.push(
        (async () => {
          try {
            const needsInstall = await packagesNeedInstalled(
              path.join(this.projectConfig.projectDir, packageDirName)
            );
            if (needsInstall) {
              this.diagnosis.addProjectError({
                type: 'error',
                message: `missing dependencies in ${cyan(packageDirName)}`,
                secondaryMessaging: `Run ${orange(
                  '`hs project install-deps`'
                )} to install all project dependencies locally`,
              });
            }
          } catch (e) {
            if (!(await this.isValidJsonFile(packageFile))) {
              this.diagnosis.addProjectError({
                type: 'error',
                message: `invalid JSON in ${cyan(packageDirName)}`,
              });
              return;
            }
            this.diagnosis.addProjectError({
              type: 'error',
              message: `Unable to determine if dependencies are installed ${packageDirName}`,
            });
            logger.debug(e);
          }
        })()
      );
    }
    return checks;
  }

  async getNpmVersion() {
    const exec = util.promisify(execAsync);
    try {
      const { stdout } = await exec('npm --version');
      return stdout.toString().trim();
    } catch (e) {
      logger.debug(e);
      return null;
    }
  }

  async fetchProjectDetails() {
    try {
      const { data } = await fetchProject(
        this.accountId,
        this.projectConfig?.projectConfig?.name
      );
      this.projectDetails = data;
      delete this.projectDetails?.deployedBuild;
      delete this.projectDetails?.latestBuild;
      delete this.projectDetails?.portalId;
    } catch (e) {
      logger.debug(e);
    }
  }

  async getAccessToken() {
    try {
      this.accessToken = await getAccessToken(
        this.personalAccessKey,
        this.env,
        this.accountId
      );
    } catch (e) {
      // TODO find the data returned from this
      this.diagnosis.addCLIConfigError({
        type: 'error',
        message: 'Unable to fetch access token',
      });
      logger.debug(e);
    }
  }

  async loadProjectFiles() {
    try {
      this.files = (await walk(this.projectConfig?.projectDir))
        .filter(file => !path.dirname(file).includes('node_modules'))
        .map(filename =>
          path.relative(this.projectConfig?.projectDir, filename)
        );
    } catch (e) {
      logger.debug(e);
    }
  }

  async gatherDiagnosticInfo() {
    const {
      platform,
      arch,
      versions: { node },
      mainModule: { path: modulePath },
    } = process;

    return {
      platform,
      arch,
      path: modulePath,
      versions: {
        '@hubspot/cli': pkg.version,
        node,
        npm: await this.getNpmVersion(),
      },
      account: {
        accountId: this.accountId,
        accountType: this.accountType,
        authType: this.authType,
        name: this.accessToken?.hubName,
        scopeGroups: this.accessToken?.scopeGroups,
        enabledFeatures: this.accessToken?.enabledFeatures,
      },
      project: {
        config:
          this.projectConfig && this.projectConfig.projectConfig
            ? this.projectConfig
            : undefined,
        details: this.projectDetails,
      },
      packageFiles:
        this.files?.filter(file => {
          return path.parse(file).base === 'package.json';
        }) || [],
      configFiles:
        this.files?.filter(file => {
          return [
            'serverless.json',
            'hsproject.json',
            'app.json',
            'public-app.json',
          ].includes(path.parse(file).base);
        }) || [],
      packageLockFiles:
        this.files?.filter(file => {
          return path.parse(file).base === 'package-lock.json';
        }) || [],
      envFiles: this.files?.filter(file => file.endsWith('.env')) || [],
      jsonFiles:
        this.files?.filter(file => path.extname(file) === '.json') || [],
      files: this.files || [],
    };
  }

  async isValidJsonFile(filename) {
    const readFile = util.promisify(fs.readFile);
    try {
      const fileContents = await readFile(filename);
      JSON.parse(fileContents.toString());
    } catch (e) {
      return false;
    }
    return true;
  }

  validateProjectJsonFiles() {
    const checks = [];
    for (const jsonFile of this.diagnosticInfo?.configFiles || []) {
      checks.push(
        (async () => {
          try {
            if (
              !(await this.isValidJsonFile(
                path.join(this.projectConfig.projectDir, jsonFile)
              ))
            ) {
              this.diagnosis.addProjectError({
                type: 'error',
                message: `invalid JSON in ${cyan(jsonFile)}`,
              });
            }
          } catch (e) {
            logger.debug(e);
            this.diagnosis.addProjectError({
              type: 'error',
              message: `invalid JSON in ${cyan(jsonFile)}`,
            });
          }
        })()
      );
    }
    return checks;
  }
}
