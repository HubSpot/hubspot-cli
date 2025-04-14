import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import chalk from 'chalk';
import { logger } from '@hubspot/local-dev-lib/logger';
import { fetchAppInstallationData } from '@hubspot/local-dev-lib/api/localDevAuth';
import {
  fetchPublicAppsForPortal,
  fetchPublicAppProductionInstallCounts,
} from '@hubspot/local-dev-lib/api/appsDev';
import {
  getAccountId,
  getConfigDefaultAccount,
} from '@hubspot/local-dev-lib/config';
import { Build } from '@hubspot/local-dev-lib/types/Build';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { mapToUserFriendlyName } from '@hubspot/project-parsing-lib';

import { APP_DISTRIBUTION_TYPES, PROJECT_CONFIG_FILE } from './constants';
import SpinniesManager from './ui/SpinniesManager';
import DevServerManagerV2 from './DevServerManagerV2';
import { EXIT_CODES } from './enums/exitCodes';
import { getProjectDetailUrl } from './projects/urls';
import { isAppIRNode } from './projects/structure';
import { ProjectConfig } from '../types/Projects';
import {
  UI_COLORS,
  uiCommandReference,
  uiAccountDescription,
  uiBetaTag,
  uiLink,
  uiLine,
} from './ui';
import { logError } from './errorHandlers/index';
import { installPublicAppPrompt } from './prompts/installPublicAppPrompt';
import { confirmPrompt } from './prompts/promptUtils';
import { i18n } from './lang';
import { handleKeypress } from './process';
import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/src/lib/types';
import { AppIRNode } from '../types/ProjectComponents';

const WATCH_EVENTS = {
  add: 'add',
  change: 'change',
  unlink: 'unlink',
  unlinkDir: 'unlinkDir',
};

const i18nKey = 'lib.LocalDevManager';

type LocalDevManagerConstructorOptions = {
  targetProjectAccountId: number;
  targetTestingAccountId: number;
  projectConfig: ProjectConfig;
  projectDir: string;
  projectId: number;
  debug?: boolean;
  deployedBuild?: Build;
  isGithubLinked: boolean;
  projectNodes: { [key: string]: IntermediateRepresentationNodeLocalDev };
  env: Environment;
};

class LocalDevManagerV2 {
  targetProjectAccountId: number;
  targetTestingAccountId: number;
  projectConfig: ProjectConfig;
  projectDir: string;
  projectId: number;
  debug: boolean;
  deployedBuild?: Build;
  isGithubLinked: boolean;
  watcher: FSWatcher | null;
  uploadWarnings: { [key: string]: boolean };
  projectNodes: { [key: string]: IntermediateRepresentationNodeLocalDev };
  activeApp: AppIRNode | null;
  activePublicAppData: PublicApp | null;
  env: Environment;
  publicAppActiveInstalls: number | null;
  projectSourceDir: string;
  mostRecentUploadWarning: string | null;

  constructor(options: LocalDevManagerConstructorOptions) {
    this.targetProjectAccountId = options.targetProjectAccountId;
    this.targetTestingAccountId = options.targetTestingAccountId;
    this.projectConfig = options.projectConfig;
    this.projectDir = options.projectDir;
    this.projectId = options.projectId;
    this.debug = options.debug || false;
    this.deployedBuild = options.deployedBuild;
    this.isGithubLinked = options.isGithubLinked;
    this.watcher = null;
    this.uploadWarnings = {};
    this.projectNodes = options.projectNodes;
    this.activeApp = null;
    this.activePublicAppData = null;
    this.env = options.env;
    this.publicAppActiveInstalls = null;
    this.mostRecentUploadWarning = null;

    this.projectSourceDir = path.join(
      this.projectDir,
      this.projectConfig.srcDir
    );

    if (
      !this.targetProjectAccountId ||
      !this.projectConfig ||
      !this.projectDir
    ) {
      logger.log(i18n(`${i18nKey}.failedToInitialize`));
      process.exit(EXIT_CODES.ERROR);
    }
  }

  async setActiveApp(appUid?: string): Promise<void> {
    if (!appUid) {
      logger.error(
        i18n(`${i18nKey}.missingUid`, {
          devCommand: uiCommandReference('hs project dev'),
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }
    const app =
      Object.values(this.projectNodes).find(
        component => component.uid === appUid
      ) || null;

    if (app && isAppIRNode(app)) {
      this.activeApp = app;

      if (app.config.distribution === APP_DISTRIBUTION_TYPES.MARKETPLACE) {
        try {
          await this.setActivePublicAppData();
          await this.checkActivePublicAppInstalls();
          await this.checkPublicAppInstallation();
        } catch (e) {
          logError(e);
        }
      }
    }

    return;
  }

  async setActivePublicAppData(): Promise<void> {
    const {
      data: { results: portalPublicApps },
    } = await fetchPublicAppsForPortal(this.targetProjectAccountId);

    const activePublicAppData = portalPublicApps.find(
      ({ sourceId }) => sourceId === this.activeApp?.uid
    );

    if (!activePublicAppData) {
      return;
    }

    const {
      data: { uniquePortalInstallCount },
    } = await fetchPublicAppProductionInstallCounts(
      activePublicAppData.id,
      this.targetProjectAccountId
    );

    this.activePublicAppData = activePublicAppData;
    this.publicAppActiveInstalls = uniquePortalInstallCount;
  }

  async checkActivePublicAppInstalls(): Promise<void> {
    if (
      !this.activePublicAppData ||
      !this.publicAppActiveInstalls ||
      this.publicAppActiveInstalls < 1
    ) {
      return;
    }
    uiLine();

    logger.warn(
      i18n(`${i18nKey}.activeInstallWarning.installCount`, {
        appName: this.activePublicAppData.name,
        installCount: this.publicAppActiveInstalls,
        accountText:
          this.publicAppActiveInstalls === 1 ? 'account' : 'accounts',
      })
    );
    logger.log(i18n(`${i18nKey}.activeInstallWarning.explanation`));
    uiLine();

    const proceed = await confirmPrompt(
      i18n(`${i18nKey}.activeInstallWarning.confirmationPrompt`),
      { defaultAnswer: false }
    );

    if (!proceed) {
      process.exit(EXIT_CODES.SUCCESS);
    }
  }

  async start(): Promise<void> {
    SpinniesManager.stopAll();
    SpinniesManager.init();

    // Local dev currently relies on the existence of a deployed build in the target account
    if (!this.deployedBuild) {
      logger.error(
        i18n(`${i18nKey}.noDeployedBuild`, {
          projectName: this.projectConfig.name,
          accountIdentifier: uiAccountDescription(this.targetProjectAccountId),
          uploadCommand: this.getUploadCommand(),
        })
      );
      logger.log();
      process.exit(EXIT_CODES.SUCCESS);
    }

    const setupSucceeded = await this.devServerSetup();

    if (!setupSucceeded) {
      process.exit(EXIT_CODES.ERROR);
    } else if (!this.debug) {
      console.clear();
    }

    uiBetaTag(i18n(`${i18nKey}.betaMessage`));

    logger.log(
      uiLink(
        i18n(`${i18nKey}.learnMoreLocalDevServer`),
        'https://developers.hubspot.com/docs/platform/project-cli-commands#start-a-local-development-server'
      )
    );

    logger.log();
    logger.log(
      chalk.hex(UI_COLORS.SORBET)(
        i18n(`${i18nKey}.running`, {
          accountIdentifier: uiAccountDescription(this.targetProjectAccountId),
          projectName: this.projectConfig.name,
        })
      )
    );
    logger.log(
      uiLink(
        i18n(`${i18nKey}.viewProjectLink`),
        getProjectDetailUrl(
          this.projectConfig.name,
          this.targetProjectAccountId
        ) || ''
      )
    );

    logger.log();
    logger.log(i18n(`${i18nKey}.quitHelper`));
    uiLine();
    logger.log();

    await this.devServerStart();

    // Initialize project file watcher to detect configuration file changes
    this.startWatching();

    this.updateKeypressListeners();

    this.monitorConsoleOutput();

    // Verify that there are no mismatches between components in the local project
    // and components in the deployed build of the project.
    this.compareLocalProjectToDeployed();
  }

  async stop(showProgress = true): Promise<void> {
    if (showProgress) {
      SpinniesManager.add('cleanupMessage', {
        text: i18n(`${i18nKey}.exitingStart`),
      });
    }
    await this.stopWatching();

    const cleanupSucceeded = await this.devServerCleanup();

    if (!cleanupSucceeded) {
      if (showProgress) {
        SpinniesManager.fail('cleanupMessage', {
          text: i18n(`${i18nKey}.exitingFail`),
        });
      }
      process.exit(EXIT_CODES.ERROR);
    }

    if (showProgress) {
      SpinniesManager.succeed('cleanupMessage', {
        text: i18n(`${i18nKey}.exitingSucceed`),
      });
    }
    process.exit(EXIT_CODES.SUCCESS);
  }

  async checkPublicAppInstallation(): Promise<void> {
    if (!this.activeApp || !this.activePublicAppData) {
      return;
    }

    const {
      data: { isInstalledWithScopeGroups, previouslyAuthorizedScopeGroups },
    } = await fetchAppInstallationData(
      this.targetTestingAccountId,
      this.projectId,
      this.activeApp.uid,
      this.activeApp.config.auth.requiredScopes,
      this.activeApp.config.auth.optionalScopes
    );
    const isReinstall = previouslyAuthorizedScopeGroups.length > 0;

    if (!isInstalledWithScopeGroups) {
      await installPublicAppPrompt(
        this.env,
        this.targetTestingAccountId,
        this.activePublicAppData.clientId,
        this.activeApp.config.auth.requiredScopes,
        this.activeApp.config.auth.redirectUrls,
        isReinstall
      );
    }
  }

  updateKeypressListeners(): void {
    handleKeypress(async key => {
      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        this.stop();
      }
    });
  }

  getUploadCommand(): string {
    const currentDefaultAccount = getConfigDefaultAccount() || undefined;

    return this.targetProjectAccountId !== getAccountId(currentDefaultAccount)
      ? uiCommandReference(
          `hs project upload --account=${this.targetProjectAccountId}`
        )
      : uiCommandReference('hs project upload');
  }

  logUploadWarning(reason?: string): void {
    let warning = reason;

    if (!warning) {
      warning =
        this.publicAppActiveInstalls && this.publicAppActiveInstalls > 0
          ? i18n(`${i18nKey}.uploadWarning.defaultMarketplaceAppWarning`, {
              installCount: this.publicAppActiveInstalls,
              accountText:
                this.publicAppActiveInstalls === 1 ? 'account' : 'accounts',
            })
          : i18n(`${i18nKey}.uploadWarning.defaultWarning`);
    }

    // Avoid logging the warning to the console if it is currently the most
    // recently logged warning. We do not want to spam the console with the same message.
    if (!this.uploadWarnings[warning]) {
      logger.log();
      logger.warn(i18n(`${i18nKey}.uploadWarning.header`, { warning }));
      logger.log(
        i18n(`${i18nKey}.uploadWarning.stopDev`, {
          command: uiCommandReference('hs project dev'),
        })
      );
      if (this.isGithubLinked) {
        logger.log(i18n(`${i18nKey}.uploadWarning.pushToGithub`));
      } else {
        logger.log(
          i18n(`${i18nKey}.uploadWarning.runUpload`, {
            command: this.getUploadCommand(),
          })
        );
      }
      logger.log(
        i18n(`${i18nKey}.uploadWarning.restartDev`, {
          command: uiCommandReference('hs project dev'),
        })
      );

      this.mostRecentUploadWarning = warning;
      this.uploadWarnings[warning] = true;
    }
  }

  monitorConsoleOutput(): void {
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);

    type StdoutCallback = (err?: Error) => void;

    // Need to provide both overloads for process.stdout.write to satisfy TS
    function customStdoutWrite(
      this: LocalDevManagerV2,
      buffer: Uint8Array | string,
      cb?: StdoutCallback
    ): boolean;
    function customStdoutWrite(
      this: LocalDevManagerV2,
      str: Uint8Array | string,
      encoding?: BufferEncoding,
      cb?: StdoutCallback
    ): boolean;
    function customStdoutWrite(
      this: LocalDevManagerV2,
      chunk: Uint8Array | string,
      encoding?: BufferEncoding | StdoutCallback,
      callback?: StdoutCallback
    ) {
      // Reset the most recently logged warning
      if (
        this.mostRecentUploadWarning &&
        this.uploadWarnings[this.mostRecentUploadWarning]
      ) {
        delete this.uploadWarnings[this.mostRecentUploadWarning];
      }

      if (typeof encoding === 'function') {
        return originalStdoutWrite(chunk, callback);
      }
      return originalStdoutWrite(chunk, encoding, callback);
    }

    customStdoutWrite.bind(this);

    process.stdout.write = customStdoutWrite;
  }

  compareLocalProjectToDeployed(): void {
    const deployedComponentNames = this.deployedBuild!.subbuildStatuses.map(
      subbuildStatus => subbuildStatus.buildName
    );

    const missingProjectNodes: string[] = [];

    Object.values(this.projectNodes).forEach(node => {
      if (!deployedComponentNames.includes(node.uid)) {
        const userFriendlyName = mapToUserFriendlyName(node.componentType);
        const label = userFriendlyName ? `[${userFriendlyName}] ` : '';
        missingProjectNodes.push(`${label}${node.uid}`);
      }
    });

    if (missingProjectNodes.length) {
      this.logUploadWarning(
        i18n(`${i18nKey}.uploadWarning.missingComponents`, {
          missingComponents: missingProjectNodes.join(', '),
        })
      );
    }
  }

  startWatching(): void {
    this.watcher = chokidar.watch(this.projectDir, {
      ignoreInitial: true,
    });

    const configPaths = Object.values(this.projectNodes).map(
      component => component.localDev.componentConfigPath
    );

    const projectConfigPath = path.join(this.projectDir, PROJECT_CONFIG_FILE);
    configPaths.push(projectConfigPath);

    this.watcher.on('add', filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.add, configPaths);
    });
    this.watcher.on('change', filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.change, configPaths);
    });
    this.watcher.on('unlink', filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.unlink, configPaths);
    });
    this.watcher.on('unlinkDir', filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.unlinkDir, configPaths);
    });
  }

  async stopWatching(): Promise<void> {
    await this.watcher?.close();
  }

  handleWatchEvent(
    filePath: string,
    event: string,
    configPaths: string[]
  ): void {
    if (configPaths.includes(filePath)) {
      this.logUploadWarning();
    } else {
      this.devServerFileChange(filePath, event);
    }
  }

  async devServerSetup(): Promise<boolean> {
    try {
      await DevServerManagerV2.setup({
        projectNodes: this.projectNodes,
        accountId: this.targetTestingAccountId,
        setActiveApp: this.setActiveApp.bind(this),
      });
      return true;
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }

      logger.error(
        i18n(`${i18nKey}.devServer.setupError`, {
          message: e instanceof Error ? e.message : '',
        })
      );
      return false;
    }
  }

  async devServerStart(): Promise<void> {
    try {
      await DevServerManagerV2.start({
        accountId: this.targetTestingAccountId,
        projectConfig: this.projectConfig,
      });
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      logger.error(
        i18n(`${i18nKey}.devServer.startError`, {
          message: e instanceof Error ? e.message : '',
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  devServerFileChange(filePath: string, event: string): void {
    try {
      DevServerManagerV2.fileChange({ filePath, event });
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      logger.error(
        i18n(`${i18nKey}.devServer.fileChangeError`, {
          message: e instanceof Error ? e.message : '',
        })
      );
    }
  }

  async devServerCleanup(): Promise<boolean> {
    try {
      await DevServerManagerV2.cleanup();
      return true;
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      logger.error(
        i18n(`${i18nKey}.devServer.cleanupError`, {
          message: e instanceof Error ? e.message : '',
        })
      );
      return false;
    }
  }
}

export default LocalDevManagerV2;
