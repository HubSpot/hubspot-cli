import { requestPorts } from '@hubspot/local-dev-lib/portManager';
import { logger } from '@hubspot/local-dev-lib/logger';
import { DevModeUnifiedInterface as UIEDevModeInterface } from '@hubspot/ui-extensions-dev-server';

import LocalDevState from './LocalDevState.js';
import {
  getHubSpotApiOrigin,
  getHubSpotWebsiteOrigin,
} from '@hubspot/local-dev-lib/urls';

type UIExtensionsDevModeInterfaceConstructorOptions = {
  localDevState: LocalDevState;
};

class UIExtensionsDevModeInterface {
  localDevState: LocalDevState;

  constructor(options: UIExtensionsDevModeInterfaceConstructorOptions) {
    this.localDevState = options.localDevState;
  }

  async setup(): Promise<void> {
    return UIEDevModeInterface.setup({
      // @ts-expect-error TODO: reconcile types between CLI and UIE Dev Server
      components: this.localDevState.projectNodes,
      profileData: this.localDevState.projectProfileData,
      logger,
      urls: {
        api: getHubSpotApiOrigin(this.localDevState.env),
        web: getHubSpotWebsiteOrigin(this.localDevState.env),
      },
    });
  }

  async start(): Promise<void> {
    return UIEDevModeInterface.start({
      accountId: this.localDevState.targetTestingAccountId,
      // @ts-expect-error TODO: reconcile types between CLI and UIE Dev Server
      projectConfig: this.localDevState.projectConfig,
      requestPorts,
    });
  }

  async fileChange(filePath: string, event: string): Promise<void> {
    return UIEDevModeInterface.fileChange(filePath, event);
  }

  async cleanup(): Promise<void> {
    return UIEDevModeInterface.cleanup();
  }
}

export default UIExtensionsDevModeInterface;
