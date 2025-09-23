import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';
import chalk from 'chalk';
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
import { logger } from '@hubspot/local-dev-lib/logger';

import { PROJECT_CONFIG_FILE } from '../../constants.js';
import SpinniesManager from '../../ui/SpinniesManager.js';
import DevServerManager from './DevServerManager.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { getAccountHomeUrl } from '../urls.js';
import {
  componentIsApp,
  componentIsPublicApp,
  CONFIG_FILES,
  getAppCardConfigs,
  getComponentUid,
} from '../../projects/structure.js';
import {
  Component,
  ComponentTypes,
  ProjectConfig,
} from '../../../types/Projects.js';
import {
  UI_COLORS,
  uiCommandReference,
  uiAccountDescription,
  uiBetaTag,
  uiLink,
  uiLine,
} from '../../ui/index.js';
import { logError } from '../../errorHandlers/index.js';
import { installAppBrowserPrompt } from '../../prompts/installAppPrompt.js';
import { confirmPrompt } from '../../prompts/promptUtils.js';
import { handleKeypress } from '../../process.js';
import { lib } from '../../../lang/en.js';
import { uiLogger } from '../../ui/logger.js';
import { getOauthAppInstallUrl } from '../../app/urls.js';

const WATCH_EVENTS = {
  add: 'add',
  change: 'change',
  unlink: 'unlink',
  unlinkDir: 'unlinkDir',
};

type LocalDevManagerConstructorOptions = {
  targetAccountId: number;
  parentAccountId: number;
  projectConfig: ProjectConfig;
  projectDir: string;
  projectId: number;
  debug?: boolean;
  deployedBuild?: Build;
  isGithubLinked: boolean;
  runnableComponents: Component[];
  env: Environment;
};

class LocalDevManager {
  targetAccountId: number;
  targetProjectAccountId: number;
  projectConfig: ProjectConfig;
  projectDir: string;
  projectId: number;
  debug: boolean;
  deployedBuild?: Build;
  isGithubLinked: boolean;
  watcher: FSWatcher | null;
  uploadWarnings: { [key: string]: boolean };
  runnableComponents: Component[];
  activeApp: Component | null;
  activePublicAppData: PublicApp | null;
  env: Environment;
  publicAppActiveInstalls: number | null;
  projectSourceDir: string;
  mostRecentUploadWarning: string | null;

  constructor(options: LocalDevManagerConstructorOptions) {
    this.targetAccountId = options.targetAccountId;
    // The account that the project exists in. This is not always the targetAccountId
    this.targetProjectAccountId = options.parentAccountId;

    this.projectConfig = options.projectConfig;
    this.projectDir = options.projectDir;
    this.projectId = options.projectId;
    this.debug = options.debug || false;
    this.deployedBuild = options.deployedBuild;
    this.isGithubLinked = options.isGithubLinked;
    this.watcher = null;
    this.uploadWarnings = {};
    this.runnableComponents = options.runnableComponents;
    this.activeApp = null;
    this.activePublicAppData = null;
    this.env = options.env;
    this.publicAppActiveInstalls = null;
    this.mostRecentUploadWarning = null;

    this.projectSourceDir = path.join(
      this.projectDir,
      this.projectConfig.srcDir
    );

    if (!this.targetAccountId || !this.projectConfig || !this.projectDir) {
      uiLogger.log(lib.LocalDevManager.failedToInitialize);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  async setActiveApp(appUid?: string): Promise<void> {
    if (!appUid) {
      uiLogger.error(lib.LocalDevManager.missingUid);
      process.exit(EXIT_CODES.ERROR);
    }
    this.activeApp =
      this.runnableComponents.find(component => {
        return getComponentUid(component) === appUid;
      }) || null;

    if (componentIsPublicApp(this.activeApp)) {
      try {
        await this.setActivePublicAppData();
        await this.checkActivePublicAppInstalls();
        await this.checkPublicAppInstallation();
      } catch (e) {
        logError(e);
      }
    }
  }

  async setActivePublicAppData(): Promise<void> {
    if (!this.activeApp) {
      return;
    }

    const {
      data: { results: portalPublicApps },
    } = await fetchPublicAppsForPortal(this.targetProjectAccountId);

    const activePublicAppData = portalPublicApps.find(
      ({ sourceId }) => sourceId === getComponentUid(this.activeApp)
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

    uiLogger.warn(
      lib.LocalDevManager.activeInstallWarning.installCount(
        this.activePublicAppData.name,
        this.publicAppActiveInstalls
      )
    );
    uiLogger.log(lib.LocalDevManager.activeInstallWarning.explanation);
    uiLine();

    const proceed = await confirmPrompt(
      lib.LocalDevManager.activeInstallWarning.confirmationPrompt,
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
      uiLogger.error(
        lib.LocalDevManager.noDeployedBuild(
          this.projectConfig.name,
          uiAccountDescription(this.targetProjectAccountId),
          this.getUploadCommand()
        )
      );
      uiLogger.log('');
      process.exit(EXIT_CODES.SUCCESS);
    }

    const setupSucceeded = await this.devServerSetup();

    if (!setupSucceeded) {
      process.exit(EXIT_CODES.ERROR);
    } else if (!this.debug) {
      console.clear();
    }

    uiBetaTag(lib.LocalDevManager.betaMessage);

    uiLogger.log(
      uiLink(
        lib.LocalDevManager.learnMoreLocalDevServer,
        'https://developers.hubspot.com/docs/platform/project-cli-commands#start-a-local-development-server'
      )
    );

    uiLogger.log('');
    uiLogger.log(
      chalk.hex(UI_COLORS.SORBET)(
        lib.LocalDevManager.running(
          this.projectConfig.name,
          uiAccountDescription(this.targetAccountId)
        )
      )
    );
    uiLogger.log(
      lib.LocalDevManager.viewProjectLink(
        this.projectConfig.name,
        this.targetProjectAccountId
      )
    );

    if (this.activeApp?.type === ComponentTypes.PublicApp) {
      uiLogger.log(
        uiLink(
          lib.LocalDevManager.viewTestAccountLink,
          getAccountHomeUrl(this.targetAccountId)
        )
      );
    }

    uiLogger.log('');
    uiLogger.log(lib.LocalDevManager.quitHelper);
    uiLine();
    uiLogger.log('');

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
        text: lib.LocalDevManager.exitingStart,
      });
    }
    await this.stopWatching();

    const cleanupSucceeded = await this.devServerCleanup();

    if (!cleanupSucceeded) {
      if (showProgress) {
        SpinniesManager.fail('cleanupMessage', {
          text: lib.LocalDevManager.exitingFail,
        });
      }
      process.exit(EXIT_CODES.ERROR);
    }

    if (showProgress) {
      SpinniesManager.succeed('cleanupMessage', {
        text: lib.LocalDevManager.exitingSucceed,
      });
    }
    process.exit(EXIT_CODES.SUCCESS);
  }

  async checkPublicAppInstallation(): Promise<void> {
    if (!componentIsPublicApp(this.activeApp) || !this.activePublicAppData) {
      return;
    }

    const {
      data: { isInstalledWithScopeGroups, previouslyAuthorizedScopeGroups },
    } = await fetchAppInstallationData(
      this.targetAccountId,
      this.projectId,
      this.activeApp.config.uid,
      this.activeApp.config.auth.requiredScopes,
      this.activeApp.config.auth.optionalScopes
    );
    const isReinstall = previouslyAuthorizedScopeGroups.length > 0;

    if (!isInstalledWithScopeGroups) {
      const installUrl = getOauthAppInstallUrl({
        targetAccountId: this.targetAccountId,
        env: this.env,
        clientId: this.activePublicAppData.clientId,
        scopes: this.activeApp.config.auth.requiredScopes,
        redirectUrls: this.activeApp.config.auth.redirectUrls,
      });
      await installAppBrowserPrompt(installUrl, isReinstall);
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
    let warning: string;

    if (reason) {
      warning = reason;
    } else {
      warning =
        componentIsPublicApp(this.activeApp) &&
        this.publicAppActiveInstalls &&
        this.publicAppActiveInstalls > 0
          ? lib.LocalDevManager.uploadWarning.defaultPublicAppWarning(
              this.publicAppActiveInstalls,
              this.publicAppActiveInstalls === 1 ? 'install' : 'installs'
            )
          : lib.LocalDevManager.uploadWarning.defaultWarning;
    }

    // Avoid logging the warning to the console if it is currently the most
    // recently logged warning. We do not want to spam the console with the same message.
    if (!this.uploadWarnings[warning]) {
      uiLogger.log('');
      uiLogger.warn(lib.LocalDevManager.uploadWarning.header(warning));
      uiLogger.log(lib.LocalDevManager.uploadWarning.stopDev);
      if (this.isGithubLinked) {
        uiLogger.log(lib.LocalDevManager.uploadWarning.pushToGithub);
      } else {
        uiLogger.log(
          lib.LocalDevManager.uploadWarning.runUpload(this.getUploadCommand())
        );
      }
      uiLogger.log(lib.LocalDevManager.uploadWarning.restartDev);

      this.mostRecentUploadWarning = warning;
      this.uploadWarnings[warning] = true;
    }
  }

  monitorConsoleOutput(): void {
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);

    type StdoutCallback = (err?: Error | null) => void;

    // Need to provide both overloads for process.stdout.write to satisfy TS
    function customStdoutWrite(
      this: LocalDevManager,
      buffer: Uint8Array | string,
      cb?: StdoutCallback
    ): boolean;
    function customStdoutWrite(
      this: LocalDevManager,
      str: Uint8Array | string,
      encoding?: BufferEncoding,
      cb?: StdoutCallback
    ): boolean;
    function customStdoutWrite(
      this: LocalDevManager,
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

    const missingComponents: string[] = [];

    this.runnableComponents
      .filter(componentIsApp)
      .forEach(({ type, config, path }) => {
        if (Object.values(ComponentTypes).includes(type)) {
          const cardConfigs = getAppCardConfigs(config, path);

          if (!deployedComponentNames.includes(config.name)) {
            missingComponents.push(
              `${lib.LocalDevManager.uploadWarning.appLabel} ${config.name}`
            );
          }

          cardConfigs.forEach(cardConfig => {
            if (
              cardConfig.data &&
              cardConfig.data.title &&
              !deployedComponentNames.includes(cardConfig.data.title)
            ) {
              missingComponents.push(
                `${lib.LocalDevManager.uploadWarning.uiExtensionLabel} ${
                  cardConfig.data.title
                }`
              );
            }
          });
        }
      });

    if (missingComponents.length) {
      this.logUploadWarning(
        lib.LocalDevManager.uploadWarning.missingComponents(
          missingComponents.join(', ')
        )
      );
    }
  }

  startWatching(): void {
    this.watcher = chokidar.watch(this.projectDir, {
      ignoreInitial: true,
    });

    const configPaths = this.runnableComponents
      .filter(({ type }) => Object.values(ComponentTypes).includes(type))
      .map(component => {
        const appConfigPath = path.join(
          component.path,
          CONFIG_FILES[component.type]
        );
        return appConfigPath;
      });

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
      await DevServerManager.setup({
        components: this.runnableComponents,
        onUploadRequired: this.logUploadWarning.bind(this),
        accountId: this.targetAccountId,
        setActiveApp: this.setActiveApp.bind(this),
      });
      return true;
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      uiLogger.error(
        lib.LocalDevManager.devServer.setupError(
          e instanceof Error ? e.message : ''
        )
      );
      return false;
    }
  }

  async devServerStart(): Promise<void> {
    try {
      await DevServerManager.start({
        accountId: this.targetAccountId,
        projectConfig: this.projectConfig,
      });
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      uiLogger.error(
        lib.LocalDevManager.devServer.startError(
          e instanceof Error ? e.message : ''
        )
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  devServerFileChange(filePath: string, event: string): void {
    try {
      DevServerManager.fileChange({ filePath, event });
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      uiLogger.error(
        lib.LocalDevManager.devServer.fileChangeError(
          e instanceof Error ? e.message : ''
        )
      );
    }
  }

  async devServerCleanup(): Promise<boolean> {
    try {
      await DevServerManager.cleanup();
      return true;
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      uiLogger.error(
        lib.LocalDevManager.devServer.cleanupError(
          e instanceof Error ? e.message : ''
        )
      );
      return false;
    }
  }
}

export default LocalDevManager;
