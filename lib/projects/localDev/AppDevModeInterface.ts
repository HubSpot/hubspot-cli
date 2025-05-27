import { fetchAppInstallationData } from '@hubspot/local-dev-lib/api/localDevAuth';
import {
  fetchPublicAppsForPortal,
  fetchPublicAppProductionInstallCounts,
} from '@hubspot/local-dev-lib/api/appsDev';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';
import { DevModeUnifiedInterface as UIEDevModeInterface } from '@hubspot/ui-extensions-dev-server';
import { requestPorts } from '@hubspot/local-dev-lib/portManager';

import { APP_AUTH_TYPES, APP_DISTRIBUTION_TYPES } from '../../constants';
import { EXIT_CODES } from '../../enums/exitCodes';
import { isAppIRNode } from '../../projects/structure';
import { uiLine } from '../../ui';
import { logError } from '../../errorHandlers/index';
import { installAppPrompt } from '../../prompts/installAppPrompt';
import { confirmPrompt } from '../../prompts/promptUtils';
import { AppIRNode } from '../../../types/ProjectComponents';
import { lib } from '../../../lang/en';
import { uiLogger } from '../../ui/logger';
import LocalDevState from './LocalDevState';
import LocalDevLogger from './LocalDevLogger';
import {
  getOauthAppInstallUrl,
  getStaticAuthAppInstallUrl,
} from '../../app/urls';

type AppDevModeInterfaceConstructorOptions = {
  localDevState: LocalDevState;
  localDevLogger: LocalDevLogger;
};

class AppDevModeInterface {
  localDevState: LocalDevState;
  localDevLogger: LocalDevLogger;
  _appNode?: AppIRNode | null;
  appData?: PublicApp;
  marketplaceAppInstalls?: number;

  constructor(options: AppDevModeInterfaceConstructorOptions) {
    this.localDevState = options.localDevState;
    this.localDevLogger = options.localDevLogger;

    if (
      !this.localDevState.targetProjectAccountId ||
      !this.localDevState.projectConfig ||
      !this.localDevState.projectDir
    ) {
      uiLogger.log(lib.LocalDevManager.failedToInitialize);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  // Assumes only one app per project
  private get appNode(): AppIRNode | null {
    if (this._appNode === undefined) {
      this._appNode =
        Object.values(this.localDevState.projectNodes).find(isAppIRNode) ||
        null;
    }
    return this._appNode;
  }

  private getAppInstallUrl(): string {
    if (this.appNode?.config.auth.type === APP_AUTH_TYPES.OAUTH) {
      return getOauthAppInstallUrl({
        targetAccountId: this.localDevState.targetTestingAccountId,
        env: this.localDevState.env,
        clientId: this.appData!.clientId, // This is only called after checking that appData exists
        scopes: this.appNode.config.auth.requiredScopes,
        redirectUrls: this.appNode.config.auth.redirectUrls,
      });
    }
    return getStaticAuthAppInstallUrl({
      targetAccountId: this.localDevState.targetTestingAccountId,
      env: this.localDevState.env,
      appId: this.appNode!.uid,
    });
  }

  private async fetchAppData(): Promise<void> {
    const {
      data: { results: portalApps },
    } = await fetchPublicAppsForPortal(
      this.localDevState.targetProjectAccountId
    );

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

    this.appData = appData;
    this.marketplaceAppInstalls = uniquePortalInstallCount;
  }

  private async checkMarketplaceAppInstalls(): Promise<void> {
    if (!this.appData || !this.marketplaceAppInstalls) {
      return;
    }
    uiLine();

    uiLogger.warn(
      lib.LocalDevManager.activeInstallWarning.installCount(
        this.appData.name,
        this.marketplaceAppInstalls
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

    this.localDevLogger.addUploadWarning(
      lib.AppDevModeInterface.defaultMarketplaceAppWarning(
        this.marketplaceAppInstalls
      )
    );
  }

  private async checkTestAccountAppInstallation(): Promise<void> {
    if (!this.appNode || !this.appData) {
      return;
    }

    if (this.appNode.config.auth.type === APP_AUTH_TYPES.OAUTH) {
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

      if (!isInstalledWithScopeGroups) {
        const installUrl = this.getAppInstallUrl();

        await installAppPrompt(installUrl, isReinstall);
      }
    } else {
      const installUrl = this.getAppInstallUrl();

      await installAppPrompt(installUrl, false);
    }
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

      await this.checkTestAccountAppInstallation();
    } catch (e) {
      logError(e);
    }

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

    return UIEDevModeInterface.cleanup();
  }
}

export default AppDevModeInterface;
