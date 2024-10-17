import { getProjectConfig } from '../projects';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import path from 'path';
import pkg from '../../package.json';
import { logger } from '@hubspot/local-dev-lib/logger';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import {
  AccessToken,
  AccountType,
  AuthType,
} from '@hubspot/local-dev-lib/types/Accounts';
import { Diagnosis } from './Diagnosis';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { getAccountId } from '../commonOpts';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { walk } from '@hubspot/local-dev-lib/fs';
import util from 'util';
import { exec as execAsync } from 'child_process';
import * as process from 'node:process';

export type ProjectConfig = Awaited<ReturnType<typeof getProjectConfig>>;

interface FilesInfo {
  files: string[];
  configFiles: string[];
  packageFiles: string[];
  packageLockFiles: string[];
  envFiles: string[];
  jsonFiles: string[];
}

export interface DiagnosticInfo extends FilesInfo {
  path?: string;
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

export class DiagnosticInfoBuilder {
  get projectConfig(): ProjectConfig {
    return this._projectConfig;
  }

  set projectConfig(value: ProjectConfig) {
    this._projectConfig = value;
  }
  accountId: number | null;
  private readonly env: Environment | undefined;
  private readonly authType: AuthType | undefined;
  private readonly accountType: AccountType | undefined;
  private readonly personalAccessKey: string | undefined;
  private diagnosis?: Diagnosis;
  private _projectConfig?: ProjectConfig;
  private accessToken?: AccessToken;
  private projectDetails?: Project;
  private files?: string[];

  constructor() {
    this.accountId = getAccountId();
    const accountConfig = getAccountConfig(this.accountId!);
    this.env = accountConfig?.env;
    this.authType = accountConfig?.authType;
    this.accountType = accountConfig?.accountType;
    this.personalAccessKey = accountConfig?.personalAccessKey;
  }

  async fetchProjectDetails() {
    try {
      const { data } = await fetchProject(
        this.accountId!,
        this._projectConfig?.projectConfig?.name
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
      this.files = (await walk(this._projectConfig?.projectDir!))
        .filter(file => !path.dirname(file).includes('node_modules'))
        .map(filename =>
          path.relative(this._projectConfig?.projectDir!, filename)
        );
    } catch (e) {
      logger.debug(e);
    }
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

  generateFilesArrays(): FilesInfo {
    const output: FilesInfo = {
      files: this.files || [],
      configFiles: [],
      packageFiles: [],
      packageLockFiles: [],
      envFiles: [],
      jsonFiles: [],
    };

    if (!this.files) {
      return output;
    }
    return this.files?.reduce((acc: FilesInfo, file) => {
      const { base } = path.parse(file);
      if (base === 'package.json') {
        acc.packageFiles.push(file);
      }

      if (
        [
          'serverless.json',
          'hsproject.json',
          'app.json',
          'public-app.json',
        ].includes(base)
      ) {
        acc.configFiles.push(file);
      }

      if (base === 'package-local.json') {
        acc.packageLockFiles.push(file);
      }

      if (file.endsWith('.env')) {
        acc.envFiles.push();
      }

      if (file.endsWith('.json')) {
        acc.envFiles.push();
      }

      return acc;
    }, output);
  }

  async generateDiagnosticInfo(): Promise<DiagnosticInfo> {
    this._projectConfig = await getProjectConfig(null);

    if (this._projectConfig?.projectConfig) {
      await this.fetchProjectDetails();
      await this.getAccessToken();
      await this.loadProjectFiles();
    }

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
        config: this._projectConfig,
        details: this.projectDetails,
      },
      ...this.generateFilesArrays(),
      files: this.files || [],
    };
  }
}
