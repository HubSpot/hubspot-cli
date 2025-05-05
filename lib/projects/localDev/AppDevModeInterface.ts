import { fetchAppInstallationData } from '@hubspot/local-dev-lib/api/localDevAuth';
import {
  fetchPublicAppsForPortal,
  fetchPublicAppProductionInstallCounts,
} from '@hubspot/local-dev-lib/api/appsDev';
import { PublicApp } from '@hubspot/local-dev-lib/types/Apps';
import { DevModeUnifiedInterface as UIEDevModeInterface } from '@hubspot/ui-extensions-dev-server';

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
  logger: LocalDevLogger;
};

class AppDevModeInterface {
  localDevState: LocalDevState;
  logger: LocalDevLogger;
  activeApp: AppIRNode | null;
  activePublicAppData: PublicApp | null;
  publicAppActiveInstalls: number | null;

  constructor(options: AppDevModeInterfaceConstructorOptions) {
    this.localDevState = options.localDevState;
    this.logger = options.logger;
    this.activeApp = null;
    this.activePublicAppData = null;
    this.publicAppActiveInstalls = null;

    if (
      !this.localDevState.targetProjectAccountId ||
      !this.localDevState.projectConfig ||
      !this.localDevState.projectDir
    ) {
      uiLogger.log(lib.LocalDevManager.failedToInitialize);
      process.exit(EXIT_CODES.ERROR);
    }
  }

  async setActiveApp(appUid?: string): Promise<void> {
    if (!appUid) {
      uiLogger.error(lib.LocalDevManager.missingUid);
      process.exit(EXIT_CODES.ERROR);
    }
    const app =
      Object.values(this.localDevState.projectNodes).find(
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
    } = await fetchPublicAppsForPortal(
      this.localDevState.targetProjectAccountId
    );

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
      this.localDevState.targetProjectAccountId
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
        this.publicAppActiveInstalls,

        this.publicAppActiveInstalls === 1 ? 'account' : 'accounts'
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

  async checkPublicAppInstallation(): Promise<void> {
    if (!this.activeApp || !this.activePublicAppData) {
      return;
    }

    const {
      data: { isInstalledWithScopeGroups, previouslyAuthorizedScopeGroups },
    } = await fetchAppInstallationData(
      this.localDevState.targetTestingAccountId,
      this.localDevState.projectId,
      this.activeApp.uid,
      this.activeApp.config.auth.requiredScopes,
      this.activeApp.config.auth.optionalScopes
    );
    const isReinstall = previouslyAuthorizedScopeGroups.length > 0;

    if (!isInstalledWithScopeGroups) {
      await installPublicAppPrompt(
        this.localDevState.env,
        this.localDevState.targetTestingAccountId,
        this.activePublicAppData.clientId,
        this.activeApp.config.auth.requiredScopes,
        this.activeApp.config.auth.redirectUrls,
        isReinstall
      );
    }
  }

  setup({ promptUser, uiLogger, urls }): void {
    return UIEDevModeInterface.setup();
  }

  async start() {}
  async fileChange(filePath: string, event: string) {}
  async cleanup() {}
}

export default AppDevModeInterface;
