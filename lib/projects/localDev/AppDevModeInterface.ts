import { fetchAppInstallationData } from '@hubspot/local-dev-lib/api/localDevAuth';
import {
  fetchPublicAppsForPortal,
  fetchPublicAppProductionInstallCounts,
} from '@hubspot/local-dev-lib/api/appsDev';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';
import { DevModeUnifiedInterface as UIEDevModeInterface } from '@hubspot/ui-extensions-dev-server';
import { requestPorts } from '@hubspot/local-dev-lib/portManager';

import { APP_DISTRIBUTION_TYPES } from '../../constants';
import { EXIT_CODES } from '../../enums/exitCodes';
import { isAppIRNode } from '../../projects/structure';
import { uiLine } from '../../ui';
import { logError } from '../../errorHandlers/index';
import { installPublicAppPrompt } from '../../prompts/installPublicAppPrompt';
import { confirmPrompt } from '../../prompts/promptUtils';
import { AppIRNode } from '../../../types/ProjectComponents';
import { lib } from '../../../lang/en';
import { uiLogger } from '../../ui/logger';
import { LocalDevState } from '../../../types/LocalDev';
import LocalDevLogger from './LocalDevLogger';

type AppDevModeInterfaceConstructorOptions = {
  localDevState: LocalDevState;
  localDevLogger: LocalDevLogger;
};

class AppDevModeInterface {
  localDevState: LocalDevState;
  localDevLogger: LocalDevLogger;
  _app?: AppIRNode | null;
  marketplaceAppData?: PublicApp;
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
  private get app(): AppIRNode | null {
    if (this._app === undefined) {
      this._app =
        Object.values(this.localDevState.projectNodes).find(isAppIRNode) ||
        null;
    }
    return this._app;
  }

  private async fetchMarketplaceAppData(): Promise<void> {
    const {
      data: { results: portalMarketplaceApps },
    } = await fetchPublicAppsForPortal(
      this.localDevState.targetProjectAccountId
    );

    const marketplaceAppData = portalMarketplaceApps.find(
      ({ sourceId }) => sourceId === this.app?.uid
    );

    if (!marketplaceAppData) {
      return;
    }

    const {
      data: { uniquePortalInstallCount },
    } = await fetchPublicAppProductionInstallCounts(
      marketplaceAppData.id,
      this.localDevState.targetProjectAccountId
    );

    this.marketplaceAppData = marketplaceAppData;
    this.marketplaceAppInstalls = uniquePortalInstallCount;
  }

  private async checkMarketplaceAppInstalls(): Promise<void> {
    if (!this.marketplaceAppData || !this.marketplaceAppInstalls) {
      return;
    }
    uiLine();

    uiLogger.warn(
      lib.LocalDevManager.activeInstallWarning.installCount(
        this.marketplaceAppData.name,
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

  private async checkMarketplaceAppInstallation(): Promise<void> {
    if (!this.app || !this.marketplaceAppData) {
      return;
    }

    const {
      data: { isInstalledWithScopeGroups, previouslyAuthorizedScopeGroups },
    } = await fetchAppInstallationData(
      this.localDevState.targetTestingAccountId,
      this.localDevState.projectId,
      this.app.uid,
      this.app.config.auth.requiredScopes,
      this.app.config.auth.optionalScopes
    );
    const isReinstall = previouslyAuthorizedScopeGroups.length > 0;

    if (!isInstalledWithScopeGroups) {
      await installPublicAppPrompt(
        this.localDevState.env,
        this.localDevState.targetTestingAccountId,
        this.marketplaceAppData.clientId,
        this.app.config.auth.requiredScopes,
        this.app.config.auth.redirectUrls,
        isReinstall
      );
    }
  }

  // @ts-expect-error TODO: reconcile types between CLI and UIE Dev Server
  // In the future, update UIE Dev Server to use LocalDevState
  async setup(args): Promise<void> {
    if (!this.app) {
      return;
    }

    if (this.app?.config.distribution === APP_DISTRIBUTION_TYPES.MARKETPLACE) {
      try {
        await this.fetchMarketplaceAppData();
        await this.checkMarketplaceAppInstalls();
        await this.checkMarketplaceAppInstallation();
      } catch (e) {
        logError(e);
      }
    }
    return UIEDevModeInterface.setup(args);
  }

  async start() {
    if (!this.app) {
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
    if (!this.app) {
      return;
    }

    return UIEDevModeInterface.fileChange(filePath, event);
  }
  async cleanup() {
    if (!this.app) {
      return;
    }

    return UIEDevModeInterface.cleanup();
  }
}

export default AppDevModeInterface;
