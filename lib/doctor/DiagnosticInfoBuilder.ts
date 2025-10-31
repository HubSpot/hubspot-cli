import { getProjectConfig } from '../projects/config.js';
import { fetchProject } from '@hubspot/local-dev-lib/api/projects';
import path from 'path';
import { pkg } from '../jsonLoader.js';
import { uiLogger } from '../ui/logger.js';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import {
  AccessToken,
  AccountType,
  AuthType,
} from '@hubspot/local-dev-lib/types/Accounts';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import {
  getAccountId,
  getDefaultAccountOverrideFilePath,
  isConfigFlagEnabled,
} from '@hubspot/local-dev-lib/config';
import { getAccountConfig, getConfigPath } from '@hubspot/local-dev-lib/config';
import { getAccessToken } from '@hubspot/local-dev-lib/personalAccessKey';
import { walk } from '@hubspot/local-dev-lib/fs';
import util from 'util';
import { exec as execAsync } from 'node:child_process';
import process from 'process';
import {
  CMS_ASSETS_FILE,
  LEGACY_PRIVATE_APP_FILE,
  LEGACY_PUBLIC_APP_FILE,
  LEGACY_SERVERLESS_FILE,
  PROJECT_CONFIG_FILE,
  THEME_FILE,
} from '../constants.js';

export type ProjectConfig = Awaited<ReturnType<typeof getProjectConfig>>;

// This needs to be hardcoded since we are using it in the TS type
const hubspotCli = '@hubspot/cli';

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
  versions: { [hubspotCli]: string; node: string; npm: string | null };
  config: string | null;
  defaultAccountOverrideFile: string | null | undefined;
  configSettings: { [key: string]: unknown };
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
  errorCount?: number;
  warningCount?: number;
}

const configFiles = [
  LEGACY_SERVERLESS_FILE,
  PROJECT_CONFIG_FILE,
  LEGACY_PRIVATE_APP_FILE,
  LEGACY_PUBLIC_APP_FILE,
  THEME_FILE,
  CMS_ASSETS_FILE,
];

export class DiagnosticInfoBuilder {
  accountId: number | null;
  readonly configSettings: { [key: string]: unknown };
  readonly env?: Environment;
  readonly authType?: AuthType;
  readonly accountType?: AccountType;
  readonly personalAccessKey?: string;
  private _projectConfig?: ProjectConfig;
  private accessToken?: AccessToken;
  private projectDetails?: Project;
  private files?: string[];
  readonly processInfo: NodeJS.Process;

  constructor(processInfo: NodeJS.Process) {
    this.accountId = getAccountId();
    const accountConfig = getAccountConfig(this.accountId!);
    this.configSettings = {
      httpUseLocalhost: isConfigFlagEnabled('httpUseLocalhost'),
    };
    this.env = accountConfig?.env;
    this.authType = accountConfig?.authType;
    this.accountType = accountConfig?.accountType;
    this.personalAccessKey = accountConfig?.personalAccessKey;
    this.processInfo = processInfo;
  }

  async generateDiagnosticInfo(): Promise<DiagnosticInfo> {
    this._projectConfig = await getProjectConfig();

    if (this._projectConfig?.projectConfig) {
      await this.fetchProjectDetails();
      await this.fetchAccessToken();
    }

    if (this._projectConfig?.projectDir) {
      await this.fetchProjectFilenames();
    }

    const {
      platform,
      arch,
      versions: { node },
      mainModule,
    } = this.processInfo;

    return {
      platform,
      arch,
      path: mainModule?.path,
      config: getConfigPath(),
      defaultAccountOverrideFile: getDefaultAccountOverrideFilePath(),
      configSettings: this.configSettings,
      versions: {
        [hubspotCli]: pkg.version,
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

  private async fetchProjectDetails(): Promise<void> {
    try {
      const { data } = await fetchProject(
        this.accountId!,
        // We check that config exists before running this function
        this._projectConfig!.projectConfig!.name
      );
      this.projectDetails = data;
    } catch (e) {
      uiLogger.debug(e);
    }
  }

  async fetchAccessToken(): Promise<AccessToken | undefined> {
    try {
      this.accessToken = await getAccessToken(
        this.personalAccessKey!,
        this.env,
        this.accountId!
      );
    } catch (e) {
      uiLogger.debug(e);
    }

    return this.accessToken;
  }

  private async fetchProjectFilenames(): Promise<void> {
    try {
      // We check that projectDir exists before running this function
      this.files = (await walk(this._projectConfig!.projectDir!))
        .filter(file => !path.dirname(file).includes('node_modules'))
        .map(filename =>
          path.relative(this._projectConfig!.projectDir!, filename)
        );
    } catch (e) {
      uiLogger.debug(e);
    }
  }

  private async getNpmVersion(): Promise<string | null> {
    const exec = util.promisify(execAsync);
    try {
      const { stdout } = await exec('npm --version');
      return stdout.toString().trim();
    } catch (e) {
      uiLogger.debug(e);
      return null;
    }
  }

  private generateFilesArrays(): FilesInfo {
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

    return this.files.reduce((acc: FilesInfo, file) => {
      const { base } = path.parse(file);

      if (base === 'package.json') {
        acc.packageFiles.push(file);
      } else if (configFiles.includes(base)) {
        acc.configFiles.push(file);
        if (file.endsWith('.json')) {
          acc.jsonFiles.push(file);
        }
      } else if (base === 'package-lock.json') {
        acc.packageLockFiles.push(file);
      } else if (file.endsWith('.env')) {
        acc.envFiles.push(file);
      } else if (file.endsWith('.json')) {
        acc.jsonFiles.push(file);
      }

      return acc;
    }, output);
  }
}
