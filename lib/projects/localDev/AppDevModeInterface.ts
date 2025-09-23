import { fetchAppInstallationData } from '@hubspot/local-dev-lib/api/localDevAuth';
import {
  fetchPublicAppsForPortal,
  fetchPublicAppProductionInstallCounts,
  // installStaticAuthAppOnTestAccount,
} from '@hubspot/local-dev-lib/api/appsDev';
import { DevModeUnifiedInterface as UIEDevModeInterface } from '@hubspot/ui-extensions-dev-server';
import { requestPorts } from '@hubspot/local-dev-lib/portManager';
// import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';

import {
  APP_AUTH_TYPES,
  APP_DISTRIBUTION_TYPES,
  APP_INSTALLATION_STATES,
  LOCAL_DEV_SERVER_MESSAGE_TYPES,
} from '../../constants.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { isAppIRNode } from '../../projects/structure.js';
import { uiLine } from '../../ui/index.js';
import { logError } from '../../errorHandlers/index.js';
import {
  // installAppAutoPrompt,
  installAppBrowserPrompt,
} from '../../prompts/installAppPrompt.js';
import { confirmPrompt } from '../../prompts/promptUtils.js';
import { AppIRNode } from '../../../types/ProjectComponents.js';
import { lib } from '../../../lang/en.js';
import { uiLogger } from '../../ui/logger.js';
import LocalDevState from './LocalDevState.js';
import LocalDevLogger from './LocalDevLogger.js';
import {
  getOauthAppInstallUrl,
  getStaticAuthAppInstallUrl,
} from '../../app/urls.js';
import { AppLocalDevData } from '../../../types/LocalDev.js';
// import { isDeveloperTestAccount, isSandbox } from '../../accountTypes.js';
import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib';
import SpinniesManager from '../../ui/SpinniesManager.js';

type AppDevModeInterfaceConstructorOptions = {
  localDevState: LocalDevState;
  localDevLogger: LocalDevLogger;
};

class AppDevModeInterface {
  localDevState: LocalDevState;
  localDevLogger: LocalDevLogger;
  _appNode?: AppIRNode | null;
  marketplaceAppInstalls?: number;

  constructor(options: AppDevModeInterfaceConstructorOptions) {
    this.localDevState = options.localDevState;
    this.localDevLogger = options.localDevLogger;

    if (
      !this.localDevState.targetProjectAccountId ||
      !this.localDevState.projectConfig ||
      !this.localDevState.projectDir
    ) {
      uiLogger.error(lib.LocalDevManager.failedToInitialize);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  private getAppNodeFromProjectNodes(projectNodes: {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  }): AppIRNode | null {
    return Object.values(projectNodes).find(isAppIRNode) || null;
  }

  // Assumes only one app per project
  private get appNode(): AppIRNode | null {
    if (this._appNode === undefined) {
      this._appNode = this.getAppNodeFromProjectNodes(
        this.localDevState.projectNodes
      );
    }
    return this._appNode;
  }

  private get appData(): AppLocalDevData | undefined {
    if (!this.appNode) {
      return undefined;
    }
    return this.localDevState.getAppDataByUid(this.appNode.uid);
  }

  private set appData(appData: AppLocalDevData) {
    if (!this.appNode) {
      return;
    }
    this.localDevState.setAppDataForUid(this.appNode.uid, appData);
  }

  private isStaticAuthApp(): boolean {
    return (
      this.appNode?.config.auth.type.toLowerCase() === APP_AUTH_TYPES.STATIC
    );
  }

  private isOAuthApp(): boolean {
    return (
      this.appNode?.config.auth.type.toLowerCase() === APP_AUTH_TYPES.OAUTH
    );
  }

  // @TODO: Restore test account auto install functionality
  // private isAutomaticallyInstallable(): boolean {
  //   const targetTestingAccount = getAccountConfig(
  //     this.localDevState.targetTestingAccountId
  //   );

  //   if (!targetTestingAccount) {
  //     return false;
  //   }

  //   const isTestAccount =
  //     isDeveloperTestAccount(targetTestingAccount) ||
  //     isSandbox(targetTestingAccount);

  //   const hasCorrectParent =
  //     targetTestingAccount.parentAccountId ===
  //     this.localDevState.targetProjectAccountId;

  //   return (
  //     isTestAccount &&
  //     hasCorrectParent &&
  //     this.isStaticAuthApp()
  //   );
  // }

  private async getAppInstallUrl(): Promise<string> {
    if (this.appNode && this.isOAuthApp()) {
      return getOauthAppInstallUrl({
        targetAccountId: this.localDevState.targetTestingAccountId,
        env: this.localDevState.env,
        clientId: this.appData!.clientId, // This is only called after checking that appData exists
        scopes: this.appNode.config.auth.requiredScopes,
        redirectUrls: this.appNode.config.auth.redirectUrls,
      });
    }

    const {
      data: { results },
    } = await fetchPublicAppsForPortal(
      this.localDevState.targetProjectAccountId
    );
    const app = results.find(app => app.sourceId === this.appNode?.uid);

    if (!app) {
      uiLogger.error(
        lib.LocalDevManager.appNotFound(
          this.localDevState.targetProjectAccountId,
          this.appNode?.uid
        )
      );
      process.exit(EXIT_CODES.ERROR);
    }

    return getStaticAuthAppInstallUrl({
      targetAccountId: this.localDevState.targetTestingAccountId,
      env: this.localDevState.env,
      appId: app.id,
    });
  }

  private async fetchAppData(): Promise<void> {
    SpinniesManager.add('fetchAppData', {
      text: lib.AppDevModeInterface.fetchAppData.checking(
        this.appNode?.config.name || ''
      ),
    });

    let portalApps: PublicApp[] = [];

    try {
      const {
        data: { results },
      } = await fetchPublicAppsForPortal(
        this.localDevState.targetProjectAccountId
      );

      portalApps = results;
    } catch (e) {
      SpinniesManager.fail('fetchAppData', {
        text: lib.AppDevModeInterface.fetchAppData.error,
      });
      logError(e);
      process.exit(EXIT_CODES.ERROR);
    }

    const appData = portalApps.find(
      ({ sourceId }) => sourceId === this.appNode?.uid
    );

    if (!appData) {
      return;
    }

    const {
      data: { uniquePortalInstallCount },
    } = await fetchPublicAppProductionInstallCounts(
      appData.id,
      this.localDevState.targetProjectAccountId
    );

    this.appData = {
      id: appData.id,
      clientId: appData.clientId,
      name: appData.name,
      installationState: APP_INSTALLATION_STATES.NOT_INSTALLED,
      scopeGroupIds: appData.scopeGroupIds,
    };
    this.marketplaceAppInstalls = uniquePortalInstallCount;
  }

  private async checkMarketplaceAppInstalls(): Promise<void> {
    if (!this.appData || !this.marketplaceAppInstalls) {
      return;
    }

    SpinniesManager.fail('fetchAppData', {
      text: lib.AppDevModeInterface.fetchAppData.activeInstallations(
        this.appNode?.config.name || '',
        this.marketplaceAppInstalls
      ),
      failColor: 'yellow',
    });

    uiLine();
    uiLogger.log(lib.LocalDevManager.activeInstallWarning.explanation);
    uiLine();

    const proceed = await confirmPrompt(
      lib.LocalDevManager.activeInstallWarning.confirmationPrompt,
      { defaultAnswer: false }
    );

    if (!proceed) {
      process.exit(EXIT_CODES.SUCCESS);
    }

    this.localDevState.addUploadWarning(
      lib.AppDevModeInterface.defaultMarketplaceAppWarning(
        this.marketplaceAppInstalls
      )
    );
  }

  // @TODO: Restore test account auto install functionality
  // private async autoInstallStaticAuthApp(): Promise<void> {
  //   const shouldInstall = await installAppAutoPrompt();

  //   if (!shouldInstall) {
  //     uiLogger.log(lib.AppDevModeInterface.autoInstallDeclined);
  //     process.exit(EXIT_CODES.SUCCESS);
  //   }

  //   await installStaticAuthAppOnTestAccount(
  //     this.appData!.id,
  //     this.localDevState.targetTestingAccountId,
  //     this.appData!.scopeGroupIds
  //   );
  // }

  private async installAppOrOpenInstallUrl(
    isReinstall: boolean
  ): Promise<void> {
    // @TODO: Restore test account auto install functionality
    // if (this.isAutomaticallyInstallable()) {
    //   try {
    //     await this.autoInstallStaticAuthApp();
    //     uiLogger.success(
    //       lib.AppDevModeInterface.autoInstallSuccess(
    //         this.appData!.name,
    //         this.localDevState.targetTestingAccountId
    //       )
    //     );
    //     return;
    //   } catch (e) {
    //     uiLogger.error(
    //       lib.AppDevModeInterface.autoInstallError(
    //         this.appData!.name,
    //         this.localDevState.targetTestingAccountId
    //       )
    //     );
    //   }
    // }

    const staticAuthInstallOptions = this.isStaticAuthApp()
      ? {
          testingAccountId: this.localDevState.targetTestingAccountId,
          projectAccountId: this.localDevState.targetProjectAccountId,
          projectName: this.localDevState.projectConfig.name,
          appUid: this.appNode!.uid,
        }
      : undefined;

    const installUrl = await this.getAppInstallUrl();
    await installAppBrowserPrompt(
      installUrl,
      isReinstall,
      staticAuthInstallOptions
    );
  }

  private async checkTestAccountAppInstallation(): Promise<{
    needsInstall?: boolean;
    isReinstall?: boolean;
  }> {
    if (!this.appNode || !this.appData) {
      return {};
    }

    const {
      data: { isInstalledWithScopeGroups, previouslyAuthorizedScopeGroups },
    } = await fetchAppInstallationData(
      this.localDevState.targetTestingAccountId,
      this.localDevState.projectId,
      this.appNode.uid,
      this.appNode.config.auth.requiredScopes,
      this.appNode.config.auth.optionalScopes
    );

    const isReinstall = previouslyAuthorizedScopeGroups.length > 0;

    if (isInstalledWithScopeGroups) {
      this.appData = {
        ...this.appData,
        installationState: APP_INSTALLATION_STATES.INSTALLED,
      };
    } else if (isReinstall) {
      this.appData = {
        ...this.appData,
        installationState:
          APP_INSTALLATION_STATES.INSTALLED_WITH_OUTDATED_SCOPES,
      };
    }

    return { needsInstall: !isInstalledWithScopeGroups, isReinstall };
  }

  private onDevServerMessage = (message: string) => {
    if (message === LOCAL_DEV_SERVER_MESSAGE_TYPES.WEBSOCKET_SERVER_CONNECTED) {
      this.checkTestAccountAppInstallation();
    }
  };

  private onChangeProjectNodes = (nodes: {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  }) => {
    const newAppNode = this.getAppNodeFromProjectNodes(nodes);

    const oldDistribution = this.appNode?.config.distribution;
    const newDistribution = newAppNode?.config.distribution;

    const oldAuthType = this.appNode?.config.auth.type;
    const newAuthType = newAppNode?.config.auth.type;

    if (
      newDistribution?.toLowerCase() === APP_DISTRIBUTION_TYPES.MARKETPLACE &&
      oldDistribution?.toLowerCase() !== APP_DISTRIBUTION_TYPES.MARKETPLACE
    ) {
      this.localDevState.addUploadWarning(
        lib.AppDevModeInterface.distributionChanged
      );
    } else if (
      newAuthType?.toLowerCase() === APP_AUTH_TYPES.OAUTH &&
      oldAuthType?.toLowerCase() !== APP_AUTH_TYPES.OAUTH
    ) {
      this.localDevState.addUploadWarning(
        lib.AppDevModeInterface.authTypeChanged
      );
    }
  };

  private setUpStateListeners() {
    this.localDevState.addListener('devServerMessage', this.onDevServerMessage);
    this.localDevState.addListener('projectNodes', this.onChangeProjectNodes);
  }

  private removeStateListeners() {
    this.localDevState.removeListener(
      'devServerMessage',
      this.onDevServerMessage
    );
    this.localDevState.removeListener(
      'projectNodes',
      this.onChangeProjectNodes
    );
  }

  // @ts-expect-error TODO: reconcile types between CLI and UIE Dev Server
  // In the future, update UIE Dev Server to use LocalDevState
  async setup(args): Promise<void> {
    if (!this.appNode) {
      return;
    }

    try {
      await this.fetchAppData();

      if (
        this.appNode.config.distribution === APP_DISTRIBUTION_TYPES.MARKETPLACE
      ) {
        await this.checkMarketplaceAppInstalls();
      }

      const { needsInstall, isReinstall } =
        await this.checkTestAccountAppInstallation();

      if (needsInstall) {
        if (SpinniesManager.pick('fetchAppData')) {
          SpinniesManager.fail('fetchAppData', {
            text: lib.AppDevModeInterface.fetchAppData.notInstalled(
              this.appNode.config.name,
              this.localDevState.targetTestingAccountId
            ),
            failColor: 'white',
          });
        }
        await this.installAppOrOpenInstallUrl(isReinstall || false);
      } else {
        if (SpinniesManager.pick('fetchAppData')) {
          SpinniesManager.succeed('fetchAppData', {
            text: lib.AppDevModeInterface.fetchAppData.success(
              this.appNode.config.name,
              this.localDevState.targetTestingAccountId
            ),
          });
        }
        uiLogger.log('');
      }
    } catch (e) {
      logError(e);
    }

    this.setUpStateListeners();

    return UIEDevModeInterface.setup(args);
  }

  async start() {
    if (!this.appNode) {
      return;
    }

    return UIEDevModeInterface.start({
      accountId: this.localDevState.targetTestingAccountId,
      // @ts-expect-error TODO: reconcile types between CLI and UIE Dev Server
      projectConfig: this.localDevState.projectConfig,
      requestPorts,
    });
  }
  async fileChange(filePath: string, event: string) {
    if (!this.appNode) {
      return;
    }

    return UIEDevModeInterface.fileChange(filePath, event);
  }
  async cleanup() {
    if (!this.appNode) {
      return;
    }

    this.removeStateListeners();

    return UIEDevModeInterface.cleanup();
  }
}

export default AppDevModeInterface;
