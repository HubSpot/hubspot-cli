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
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import {
  AccessToken,
  AccountType,
  AuthType,
} from '@hubspot/local-dev-lib/types/Accounts';
import { Project } from '@hubspot/local-dev-lib/types/Project';

const minMajorNodeVersion = 18;

interface DiagnosisOptions {
  configFilePath: string;
  defaultAccount: string;
  projectDir: string;
  projectName: string;
}

interface Section {
  type: 'error' | 'warning' | 'success';
  message: string;
  secondaryMessaging?: string;
}

interface DiagnosisCategory {
  header: string;
  subheaders?: string[];
  sections: Section[];
}

interface DiagnosisCategories {
  cli: DiagnosisCategory;
  project: DiagnosisCategory;
  cliConfig: DiagnosisCategory;
}

type ProjectConfig = Awaited<ReturnType<typeof getProjectConfig>>;

interface DiagnosticInfo {
  path?: string;
  files: string[];
  envFiles: string[];
  configFiles: string[];
  packageFiles: string[];
  packageLockFiles: string[];
  jsonFiles: string[];

  versions: { '@hubspot/cli': string; node: string; npm: string | null };
  project: {
    details?: Project;
    config?: ProjectConfig;
  };
  arch: typeof process.arch;
  platform: typeof process.platform;
  account: {
    name?: string;
    accountId?: number | null;
    scopeGroups?: AccessToken['scopeGroups'];
    enabledFeatures?: AccessToken['enabledFeatures'];
    accountType?: AccessToken['accountType'];
    authType?: AuthType;
  };
  diagnosis?: string;
}

export class Diagnosis {
  private succeedPrefix: string;
  private readonly failPrefix: string;
  private warnPrefix: string;
  private readonly diagnosis: DiagnosisCategories;

  constructor({
    configFilePath,
    defaultAccount,
    projectDir,
    projectName,
  }: DiagnosisOptions) {
    const { succeedPrefix, failPrefix } = prefixOptions({} as any);
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
        subheaders: [
          `Project dir: ${cyan(projectDir)}`,
          `Project name: ${cyan(projectName)}`,
        ],
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

  addCliSection(section: Section) {
    this.diagnosis.cli.sections.push(section);
  }

  addProjectSection(section: Section) {
    this.diagnosis.project.sections.push(section);
  }

  addCLIConfigError(section: Section) {
    this.diagnosis.cliConfig.sections.push(section);
  }

  toString() {
    const output = [];
    for (const [__key, value] of Object.entries(this.diagnosis)) {
      output.push(this.generateSections(value));
    }

    return output.join('\n');
  }

  generateSections(section: DiagnosisCategory) {
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
  accountId: number | null;
  private readonly env: Environment | undefined;
  private readonly authType: AuthType | undefined;
  private readonly accountType: AccountType | undefined;
  private readonly personalAccessKey: string | undefined;
  private diagnosis?: Diagnosis;
  private projectConfig?: ProjectConfig;
  private diagnosticInfo?: DiagnosticInfo;
  private accessToken?: AccessToken;
  private projectDetails?: Project;
  private files?: string[];

  constructor() {
    SpinniesManager.init();
    this.accountId = getAccountId();
    const accountConfig = getAccountConfig(this.accountId!);
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
      configFilePath: '',
      defaultAccount: '',
      projectDir: this.projectConfig?.projectDir!,
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

    this.diagnosticInfo!.diagnosis = this.diagnosis.toString();

    return this.diagnosticInfo;
  }

  async checkIfNodeIsInstalled() {
    try {
      if (!this.diagnosticInfo?.versions.node) {
        this.diagnosis?.addCliSection({
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
        this.diagnosis?.addCliSection({
          type: 'error',
          message: `Minimum Node version is not met, ${this.diagnosticInfo?.versions.node}`,
        });
      }
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
      const npmInstalled = await isGloballyInstalled('npm');
      if (!npmInstalled) {
        this.diagnosis?.addCliSection({
          type: 'error',
          message: 'npm is not installed',
        });
      }
    } catch (e) {
      this.diagnosis?.addCliSection({
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
              path.join(this.projectConfig?.projectDir!, packageDirName)
            );
            if (needsInstall) {
              this.diagnosis?.addProjectSection({
                type: 'error',
                message: `missing dependencies in ${cyan(packageDirName)}`,
                secondaryMessaging: `Run ${orange(
                  '`hs project install-deps`'
                )} to install all project dependencies locally`,
              });
            }
          } catch (e) {
            if (!(await this.isValidJsonFile(packageFile))) {
              this.diagnosis?.addProjectSection({
                type: 'error',
                message: `invalid JSON in ${cyan(packageDirName)}`,
              });
              return;
            }
            this.diagnosis?.addProjectSection({
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
        this.accountId!,
        this.projectConfig?.projectConfig?.name
      );
      this.projectDetails = data;
    } catch (e) {
      logger.debug(e);
    }
  }

  async getAccessToken() {
    try {
      this.accessToken = await getAccessToken(
        this.personalAccessKey!,
        this.env,
        this.accountId!
      );
    } catch (e) {
      // TODO find the data returned from this
      this.diagnosis?.addCLIConfigError({
        type: 'error',
        message: 'Unable to fetch access token',
      });
      logger.debug(e);
    }
  }

  async loadProjectFiles() {
    try {
      this.files = (await walk(this.projectConfig?.projectDir!))
        .filter(file => !path.dirname(file).includes('node_modules'))
        .map(filename =>
          path.relative(this.projectConfig?.projectDir!, filename)
        );
    } catch (e) {
      logger.debug(e);
    }
  }

  async gatherDiagnosticInfo(): Promise<DiagnosticInfo> {
    const {
      platform,
      arch,
      versions: { node },
      mainModule,
    } = process;

    return {
      platform,
      arch,
      path: mainModule?.path,
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
        config: this.projectConfig,
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

  validateProjectJsonFiles() {
    const checks = [];
    for (const jsonFile of this.diagnosticInfo?.configFiles || []) {
      checks.push(
        (async () => {
          try {
            if (
              !(await this.isValidJsonFile(
                path.join(this.projectConfig?.projectDir!, jsonFile)
              ))
            ) {
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
        })()
      );
    }
    return checks;
  }
}
