import { fetchAppInstallationData } from '@hubspot/local-dev-lib/api/localDevAuth';
import {
  fetchAppMetadataByUid,
  fetchPublicAppProductionInstallCounts,
  installStaticAuthAppOnTestAccount,
} from '@hubspot/local-dev-lib/api/appsDev';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
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
  installAppAutoPrompt,
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
import { isDeveloperTestAccount, isSandbox } from '../../accountTypes.js';
import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib';
import SpinniesManager from '../../ui/SpinniesManager.js';
import { isServerRunningAtUrl } from '../../http.js';

type AppDevModeInterfaceConstructorOptions = {
  localDevState: LocalDevState;
  localDevLogger: LocalDevLogger;
};

class AppDevModeInterface {
  localDevState: LocalDevState;
  localDevLogger: LocalDevLogger;
  _appNode?: AppIRNode | null;
  marketplaceAppInstalls?: number;
  private appInstallResolve?: () => void;

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

  private get appData(): AppLocalDevData {
    // These checks are primarily for type safety
    // App data will never be accessed before being set
    if (!this.appNode) {
      uiLogger.log(lib.AppDevModeInterface.appDataNotFound);
      process.exit(EXIT_CODES.ERROR);
    }

    const data = this.localDevState.getAppDataByUid(this.appNode.uid);
    if (!data) {
      uiLogger.log(lib.AppDevModeInterface.appDataNotFound);
      process.exit(EXIT_CODES.ERROR);
    }
    return data;
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

  private isAutomaticallyInstallable(): boolean {
    const targetTestingAccount = getAccountConfig(
      this.localDevState.targetTestingAccountId
    );

    if (!targetTestingAccount) {
      return false;
    }

    const isTestAccount =
      isDeveloperTestAccount(targetTestingAccount) ||
      isSandbox(targetTestingAccount);

    const hasCorrectParent =
      targetTestingAccount.parentAccountId ===
      this.localDevState.targetProjectAccountId;

    return isTestAccount && hasCorrectParent && this.isStaticAuthApp();
  }

  private async getAppInstallUrl(): Promise<string> {
    if (this.appNode && this.isOAuthApp()) {
      return getOauthAppInstallUrl({
        targetAccountId: this.localDevState.targetTestingAccountId,
        env: this.localDevState.env,
        clientId: this.appData.clientId,
        scopes: this.appNode.config.auth.requiredScopes,
        redirectUrls: this.appNode.config.auth.redirectUrls,
      });
    }

    return getStaticAuthAppInstallUrl({
      targetAccountId: this.localDevState.targetTestingAccountId,
      env: this.localDevState.env,
      appId: this.appData.id,
    });
  }

  private async fetchAppData(): Promise<void> {
    SpinniesManager.add('fetchAppData', {
      text: lib.AppDevModeInterface.fetchAppData.checking(
        this.appNode?.config.name || ''
      ),
    });

    let appData: PublicApp;

    try {
      const { data } = await fetchAppMetadataByUid(
        this.appNode!.uid,
        this.localDevState.targetProjectAccountId
      );
      appData = data;
    } catch (e) {
      SpinniesManager.fail('fetchAppData', {
        text: lib.AppDevModeInterface.fetchAppData.error,
      });
      logError(e);
      process.exit(EXIT_CODES.ERROR);
    }

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
      installationState: APP_INSTALLATION_STATES.UNKNOWN,
      scopeGroupIds: appData.scopeGroupIds,
    };
    this.marketplaceAppInstalls = uniquePortalInstallCount;
  }

  private async checkMarketplaceAppInstalls(): Promise<void> {
    if (!this.marketplaceAppInstalls) {
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

  private async waitUntilAppIsInstalled(installUrl: string): Promise<void> {
    uiLogger.log(
      lib.AppDevModeInterface.waitUntilAppIsInstalled.link(installUrl)
    );

    SpinniesManager.add('waitUntilAppIsInstalled', {
      text: lib.AppDevModeInterface.waitUntilAppIsInstalled.waiting,
    });

    await new Promise<void>(resolve => {
      this.appInstallResolve = resolve;
    });

    SpinniesManager.succeed('waitUntilAppIsInstalled', {
      text: lib.AppDevModeInterface.waitUntilAppIsInstalled.success(
        this.appNode?.config.name || '',
        this.localDevState.targetTestingAccountId
      ),
    });
  }

  private async autoInstallStaticAuthApp(): Promise<boolean> {
    const shouldInstall = await installAppAutoPrompt();

    if (!shouldInstall) {
      uiLogger.log(lib.AppDevModeInterface.autoInstallDeclined);
      process.exit(EXIT_CODES.SUCCESS);
    }

    uiLogger.log('');

    SpinniesManager.add('autoInstallStaticAuthApp', {
      text: lib.AppDevModeInterface.autoInstallStaticAuthApp.installing(
        this.appData.name,
        this.localDevState.targetTestingAccountId
      ),
    });

    try {
      await installStaticAuthAppOnTestAccount(
        this.appData.id,
        this.localDevState.targetTestingAccountId,
        this.appData.scopeGroupIds
      );

      SpinniesManager.succeed('autoInstallStaticAuthApp', {
        text: lib.AppDevModeInterface.autoInstallStaticAuthApp.success(
          this.appData.name,
          this.localDevState.targetTestingAccountId
        ),
      });
      return true;
    } catch (e) {
      SpinniesManager.fail('autoInstallStaticAuthApp', {
        text: lib.AppDevModeInterface.autoInstallStaticAuthApp.error(
          this.appData.name,
          this.localDevState.targetTestingAccountId
        ),
        failColor: 'white',
      });
      return false;
    }
  }

  private async installAppOrOpenInstallUrl(
    isReinstall: boolean
  ): Promise<void> {
    if (this.isAutomaticallyInstallable()) {
      const installSuccess = await this.autoInstallStaticAuthApp();

      if (installSuccess) {
        return;
      }
    }

    const installUrl = await this.getAppInstallUrl();
    await installAppBrowserPrompt(installUrl, isReinstall);

    if (!isReinstall) {
      await this.waitUntilAppIsInstalled(installUrl);
    }
  }

  private async checkTestAccountAppInstallation(): Promise<{
    needsInstall?: boolean;
    isReinstall?: boolean;
  }> {
    if (!this.appNode) {
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
    } else {
      this.appData = {
        ...this.appData,
        installationState: APP_INSTALLATION_STATES.NOT_INSTALLED,
      };
    }

    return { needsInstall: !isInstalledWithScopeGroups, isReinstall };
  }

  private async validateOauthAppRedirectUrl(): Promise<void> {
    const redirectUrl = this.appNode?.config.auth.redirectUrls[0];

    if (!redirectUrl) {
      return;
    }

    const serverIsRunningAtRedirectUrl =
      await isServerRunningAtUrl(redirectUrl);

    if (!serverIsRunningAtRedirectUrl) {
      uiLogger.log('');
      uiLogger.error(
        lib.AppDevModeInterface.oauthAppRedirectUrlError(redirectUrl)
      );
      process.exit(EXIT_CODES.ERROR);
    }
  }

  private resolveAppInstallPromise(): void {
    if (this.appInstallResolve) {
      this.appInstallResolve();
      this.appInstallResolve = undefined;
    }
  }

  private handleAppInstallSuccessDevServerMessage(): void {
    this.resolveAppInstallPromise();

    this.appData = {
      ...this.appData,
      installationState: APP_INSTALLATION_STATES.INSTALLED,
    };
  }

  private handleAppInstallInitiatedDevServerMessage(): void {
    this.resolveAppInstallPromise();
  }

  private handleAppInstallFailureDevServerMessage(): void {
    uiLogger.error(lib.AppDevModeInterface.installationFailed);
    process.exit(EXIT_CODES.ERROR);
  }

  private onDevServerMessage = async (message: string) => {
    if (message === LOCAL_DEV_SERVER_MESSAGE_TYPES.WEBSOCKET_SERVER_CONNECTED) {
      await this.checkTestAccountAppInstallation();
    } else if (
      message === LOCAL_DEV_SERVER_MESSAGE_TYPES.STATIC_AUTH_APP_INSTALL_SUCCESS
    ) {
      this.handleAppInstallSuccessDevServerMessage();
    } else if (
      message === LOCAL_DEV_SERVER_MESSAGE_TYPES.STATIC_AUTH_APP_INSTALL_FAILURE
    ) {
      this.handleAppInstallFailureDevServerMessage();
    } else if (
      message === LOCAL_DEV_SERVER_MESSAGE_TYPES.OAUTH_APP_INSTALL_INITIATED
    ) {
      this.handleAppInstallInitiatedDevServerMessage();
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

  async setup(): Promise<void> {
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

        if (this.isOAuthApp()) {
          await this.validateOauthAppRedirectUrl();
        }

        this.localDevState.addListener(
          'devServerMessage',
          this.onDevServerMessage
        );
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
  }

  async start() {
    this.localDevState.addListener('projectNodes', this.onChangeProjectNodes);
  }

  async cleanup() {
    this.removeStateListeners();
  }
}

export default AppDevModeInterface;
